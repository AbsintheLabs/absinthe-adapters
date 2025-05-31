import { Kafka, Producer } from 'kafkajs';
import { handleBigIntSerialization } from '../utils/bigint';
import { config } from '../config';

/**
 * Kafka service for handling message production
 */
export class KafkaService {
    private kafka: Kafka;
    private producer: Producer;
    private isConnected: boolean = false;

    constructor() {
        if (!config.kafka.brokers) {
            throw new Error('KAFKA_BROKERS must be set in your .env');
        }

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
    }

    /**
     * Connect to Kafka
     */
    public async connect(): Promise<void> {
        if (!this.isConnected) {
            await this.producer.connect();
            this.isConnected = true;
            console.log('Kafka producer connected');
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
    public async sendMessage(topic: string, data: any, key?: string): Promise<void> {
        try {
            // Ensure producer is connected
            await this.connect();

            // Process data to handle BigInt serialization
            const processedData = handleBigIntSerialization(data);

            // Create message
            const message = {
                key: key || null,
                value: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    data: processedData
                }),
                timestamp: Date.now().toString()
            };

            // Send message
            await this.producer.send({
                topic,
                messages: [message]
            });

            console.log(`Message sent to topic '${topic}':`, processedData);
        } catch (error) {
            console.error('Error sending message to Kafka:', error);
            throw error;
        }
    }

    /**
     * Send multiple messages to a Kafka topic
     */
    public async sendMessages(topic: string, messages: Array<{ data: any; key?: string }>): Promise<void> {
        try {
            await this.connect();

            const kafkaMessages = messages.map(({ data, key }) => ({
                key: key || null,
                value: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    data: handleBigIntSerialization(data)
                }),
                timestamp: Date.now().toString()
            }));

            await this.producer.send({
                topic,
                messages: kafkaMessages
            });

            console.log(`${messages.length} messages sent to topic '${topic}'`);
        } catch (error) {
            console.error('Error sending messages to Kafka:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const kafkaService = new KafkaService(); 