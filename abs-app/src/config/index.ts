import dotenv from 'dotenv';
import path from 'path';
import { ApiKeys } from '../types';

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    logFilePath: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/requests.log'),
};

// API keys configuration (in a real app, store these securely)
export const validApiKeys: ApiKeys = {
    'api_key_1': { points: 10, duration: 1 }, // 10 requests per second
    'api_key_2': { points: 10, duration: 10000000000000 } // 10 requests per second
}; 