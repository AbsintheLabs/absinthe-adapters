import dotenv from 'dotenv';
import { ApiKeys } from '../types';

dotenv.config();

export const config = {
  port: process.env.PORT,
  logFilePath: process.env.LOG_FILE_PATH,
  kafka: {
    transactionsTopic: process.env.KAFKA_TRANSACTIONS_TOPIC as string,
    twbTopic: process.env.KAFKA_TWB_TOPIC as string,
    clientId: process.env.KAFKA_CLIENT_ID,
    brokers: process.env.KAFKA_BROKERS,
    schemaRegistryUrl: process.env.KAFKA_SCHEMA_REGISTRY_URL as string,
    baseSchema: process.env.KAFKA_BASE_SUBJECT as string,
    transactionSchema: process.env.KAFKA_TRANSACTION_SUBJECT as string,
    twbSchema: process.env.KAFKA_TWB_SUBJECT as string,
  },
};

//todo: add proper auth service
// API keys configuration (in a real app, store these securely)
export const validApiKeys: ApiKeys = {
  api_key_1: { points: 10, duration: 1 }, // 10 requests per second
  api_key_2: { points: 10, duration: 10000000000000 }, // 10 requests per second
};
