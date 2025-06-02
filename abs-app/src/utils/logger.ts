import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { handleBigIntSerialization } from './bigint';

/**
 * Ensures the log directory exists
 */
export const ensureLogDirectory = (): void => {
    const logDir = path.dirname(config.logFilePath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
};

/**
 * Logs data to file with timestamp
 */
export const logToFile = (data: any): void => {
    const processedData = handleBigIntSerialization(data);
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${JSON.stringify(processedData)}\n`;

    fs.appendFile(config.logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
};

/**
 * Logs data to console (processed for BigInt)
 */
export const logToConsole = (label: string, data: any): void => {
    const processedData = handleBigIntSerialization(data);
    console.log(`${label}:`, processedData);
}; 