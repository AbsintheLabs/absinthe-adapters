import dotenv from 'dotenv';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
dotenv.config();

const awsConfig = {
  region: process.env.AWS_REIGON,
  ssmName: process.env.AWS_SSM_NAME,
  ssmEnv: process.env.AWS_SSM_ENV,
  ssmPathAdminSecret: process.env.AWS_SSM_PATH_ADMIN_SECRET,
};

const ssm = new SSMClient({ region: awsConfig.region });

export async function loadSecrets() {
  const command = new GetParameterCommand({
    Name: `${awsConfig.ssmName}/${awsConfig.ssmEnv}/${awsConfig.ssmPathAdminSecret}`,
    WithDecryption: true,
  });

  const response = await ssm.send(command);
  const adminSecret = response.Parameter?.Value;
  process.env.ADMIN_SECRET = adminSecret;

  console.log('adminSecret', process.env.ADMIN_SECRET);
  return process.env.ADMIN_SECRET;
}

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
  baseUrl: process.env.BASE_URL,
  adminSecret: process.env.ADMIN_SECRET,
  environment: process.env.ENVIRONMENT,
  redisUrl: process.env.REDIS_URL,
};

export interface Config {
  port: string;
  logFilePath: string;
  kafka: {
    transactionsTopic: string;
    twbTopic: string;
    clientId: string;
    brokers: string;
    schemaRegistryUrl: string;
    baseSchema: string;
    transactionSchema: string;
    twbSchema: string;
  };
  baseUrl: string;
  adminSecret: string;
  environment: string;
  redisUrl: string;
}
