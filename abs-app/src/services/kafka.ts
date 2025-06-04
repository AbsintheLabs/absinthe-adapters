import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { readFileSync } from 'fs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { config } from '../config';
import snappy from 'kafkajs-snappy';
import { CompressionCodecs } from 'kafkajs';

/**
 * Kafka service for handling message production with Schema Registry
 */
export class KafkaService {
    private kafka: Kafka;
    private producer: Producer;
    private registry: SchemaRegistry;
    private isConnected: boolean = false;
    private schemaIds: Map<string, number> = new Map();

    constructor() {
        if (!config.kafka.brokers) {
            throw new Error('KAFKA_BROKERS must be set in your .env');
        }
        CompressionCodecs[CompressionTypes.Snappy] = snappy;

        this.kafka = new Kafka({
            clientId: config.kafka.clientId,
            brokers: config.kafka.brokers.split(','),
            // Optional: Add retry and timeout configurations
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });

        this.producer = this.kafka.producer({
            maxInFlightRequests: 5,    // Default - allows pipelining for better throughput
            idempotent: true,          // Prevents duplicates with minimal perf impact
        });
        console.log("config.kafka.schemaRegistryUrl", config.kafka.schemaRegistryUrl);
        // Initialize Schema Registry
        this.registry = new SchemaRegistry({ 
            host: config.kafka.schemaRegistryUrl 
        });
    }

    /**
     * Ensure schema is registered and return schema ID
     */
    public async ensureSchema(subject: string, avscPath: string): Promise<number> {
        if (this.schemaIds.has(subject)) {
            //todo: add refresh
            return this.schemaIds.get(subject)!;
        }

        const schemaString = readFileSync(avscPath, 'utf8');

        try {
            const id = await this.registry.getLatestSchemaId(subject);
            console.log(`Schema already registered with ID ${id} for subject ${subject}`);
            this.schemaIds.set(subject, id);
            return id;
        } catch (e) {
            const { id } = await this.registry.register({ 
                type: SchemaType.AVRO, 
                schema: schemaString 
            }, { subject });
            console.log(`Registered new schema with ID ${id} for subject ${subject}`);
            this.schemaIds.set(subject, id);
            return id;
        }
    }

    /**
     * Initialize schemas for all subjects
     */
    public async initializeSchemas(): Promise<void> {
        try {
            // Register Base schema first
            await this.ensureSchema('base-value', './src/schemas/base.avsc');
            
            // Register schemas with explicit references
            await this.ensureSchemaWithReference('transaction-value', './src/schemas/transaction.avsc', [
                { name: 'network.absinthe.adapters.Base', subject: 'base-value', version: 1 }
            ]);
            
            await this.ensureSchemaWithReference('timeWeightedBalance-value', './src/schemas/timeWeightedBalance.avsc', [
                { name: 'network.absinthe.adapters.Base', subject: 'base-value', version: 1 }
            ]);
            
            console.log('All schemas initialized successfully');
        } catch (error) {
            console.error('Error initializing schemas:', error);
            throw error;
        }
    }

    /**
     * Register schema with references
     */
    private async ensureSchemaWithReference(subject: string, avscPath: string, references: any[]): Promise<number> {
        if (this.schemaIds.has(subject)) {
            return this.schemaIds.get(subject)!;
        }

        const schemaString = readFileSync(avscPath, 'utf8');

        try {
            const id = await this.registry.getLatestSchemaId(subject);
            this.schemaIds.set(subject, id);
            return id;
        } catch (e) {
            const { id } = await this.registry.register({ 
                type: SchemaType.AVRO, 
                schema: schemaString,
                references: references
            }, { subject });
            console.log(`Registered schema with references, ID ${id} for subject ${subject}`);
            this.schemaIds.set(subject, id);
            return id;
        }
    }

    /**
     * Connect to Kafka
     */
    public async connect(): Promise<void> {
        if (!this.isConnected) {
            await this.producer.connect();
            await this.initializeSchemas(); // Initialize schemas on connect
            this.isConnected = true;
            console.log('Kafka producer connected and schemas initialized');
        }
    }

    /**
     * Disconnect from Kafka
     */
    public async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.producer.disconnect();
            this.isConnected = false;
            console.log('Kafka producer disconnected');
        }
    }

    /**
     * Send a message to a Kafka topic
     */
    public async sendMessage(topic: string, data: any, key: string): Promise<void> {
        try {
            // Ensure producer is connected
            await this.connect();

            // Create message
            const message = {
                key: key,
                value: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    data: data
                }),
            };

            // Send message
            await this.producer.send({
                topic,
                messages: [message],
                compression: CompressionTypes.Snappy,
            });

            console.log(`Message sent to topic '${topic}':`, data);
        } catch (error) {
            console.error('Error sending message to Kafka:', error);
            throw error;
        }
    }

    // fixme: I don't like that we have separate implementations for single and multiple messages.--
    /**
     * Send multiple messages to a Kafka topic
     *///todo: add type safety
    public async sendMessages(topic: string, data: any, key: string): Promise<void> {
        try {
            await this.connect();

            const kafkaMessages = data.map((event: any) => ({
                key: key,
                value: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    data: event
                }),
            }));
            await this.producer.send({
                topic,
                messages: kafkaMessages
            });

            console.log(`${data.length} messages sent to topic '${topic}'`);
        } catch (error) {
            console.error('Error sending messages to Kafka:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const kafkaService = new KafkaService(); 