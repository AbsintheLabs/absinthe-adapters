import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { readFileSync } from 'fs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { config } from '../config';
import snappy from 'kafkajs-snappy';
import { CompressionCodecs } from 'kafkajs';
import { TimeWeightedBalanceEvent, TransactionEvent } from '../types';
import { MessageType } from '../types/enums';

interface KafkaSubjectConfig {
  name: string;
  subject: string;
  version: number;
}

/**
 * Kafka service for handling message production with Schema Registry
 */
export class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private registry: SchemaRegistry;
  private isConnected: boolean = false;

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
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 5, // Default - allows pipelining for better throughput
      idempotent: true, // Prevents duplicates with minimal perf impact
    });
    // Initialize Schema Registry
    this.registry = new SchemaRegistry({
      host: config.kafka.schemaRegistryUrl,
    });
  }

  /**
   * Ensure schema is registered and return schema ID
   */
  public async ensureSchema(subject: string, avscPath: string): Promise<number> {
    const schemaString = readFileSync(avscPath, 'utf8');

    try {
      const { id } = await this.registry.register(
        {
          type: SchemaType.AVRO,
          schema: schemaString,
        },
        { subject },
      );
      console.log(`Registered new schema with ID ${id} for subject ${subject}`);
      return id;
    } catch (e) {
      console.error('Error registering schema:', e);
      throw e;
    }
  }

  /**
   * Initialize schemas for all subjects
   */
  public async initializeSchemas(): Promise<void> {
    try {
      // Register Base schema first and get actual version
      await this.ensureSchema('dev.base.v1-value', './src/schemas/base.avsc');
      const baseVersion = await this.getRegisteredVersion('dev.base.v1-value');

      // Register dependent schemas with correct base version
      await this.ensureSchemaWithReference(
        // todo: devx add in config
        'dev.transactions.v1-value',
        './src/schemas/transaction.avsc',
        [
          {
            name: 'network.absinthe.adapters.Base',
            subject: 'dev.base.v1-value',
            version: baseVersion,
          },
        ],
      );

      await this.ensureSchemaWithReference(
        'dev.time-wbalance.v1-value',
        './src/schemas/timeWeightedBalance.avsc',
        [
          {
            name: 'network.absinthe.adapters.Base',
            subject: 'dev.base.v1-value',
            version: baseVersion,
          },
        ],
      );
    } catch (error) {
      console.error('Error initializing schemas:', error);
      throw error;
    }
  }

  /**
   * Get the registered version by making direct API call
   */
  private async getRegisteredVersion(subject: string): Promise<number> {
    try {
      const response = await fetch(
        `${config.kafka.schemaRegistryUrl}/subjects/${subject}/versions/latest`,
      );
      const data = await response.json();
      return data.version;
    } catch (error) {
      console.warn(`Could not get version for ${subject}, defaulting to 1`, error);
      return 1;
    }
  }

  /**
   * Register schema with references
   */
  private async ensureSchemaWithReference(
    subject: string,
    avscPath: string,
    references: KafkaSubjectConfig[],
  ): Promise<number> {
    const schemaString = readFileSync(avscPath, 'utf8');

    try {
      const { id } = await this.registry.register(
        {
          type: SchemaType.AVRO,
          schema: schemaString,
          references: references,
        },
        { subject },
      );
      console.log(`Registered schema with references, ID ${id} for subject ${subject}`);
      return id;
    } catch (e) {
      console.error('Error registering schema with references:', e);
      throw e;
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
    }
  }

  /**
   * Disconnect from Kafka
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
    }
  }
  /**
   * Send multiple messages to a Kafka topic
   */
  public async sendMessages(
    topic: string,
    data: (TransactionEvent | TimeWeightedBalanceEvent)[],
    key: string,
  ): Promise<void> {
    if (!data || data.length === 0) {
      throw new Error('No data provided to send messages');
    }

    try {
      await this.connect();
      const schemaId = await this.getSchemaIdForData(data[0]);
      const kafkaMessages = await Promise.all(
        data.map(async (event) => ({
          key: key,
          value: await this.registry.encode(schemaId, event),
        })),
      );

      await this.producer.send({
        topic,
        messages: kafkaMessages,
        compression: CompressionTypes.Snappy,
      });

      console.log(`${data.length} Avro-encoded message(s) sent to topic '${topic}'`);
    } catch (error) {
      console.error('Error sending messages to Kafka:', error);
      throw error;
    }
  }

  /**
   * Get schema ID based on data type
   */
  private async getSchemaIdForData(
    data: TransactionEvent | TimeWeightedBalanceEvent,
  ): Promise<number> {
    const eventType = data.eventType;

    if (eventType === MessageType.TRANSACTION) {
      return this.registry.getLatestSchemaId('dev.transactions.v1-value');
    } else if (eventType === MessageType.TIME_WEIGHTED_BALANCE) {
      return this.registry.getLatestSchemaId('dev.time-wbalance.v1-value');
    }

    throw new Error(`Unknown event type: ${eventType}`);
  }
}

// Export singleton instance
export const kafkaService = new KafkaService();
