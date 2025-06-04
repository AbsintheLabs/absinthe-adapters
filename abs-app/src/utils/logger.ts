import fs from 'fs';
import path from 'path';
import { config } from '../config';

/**
 * Ensures the log directory exists
 */
export const ensureLogDirectory = (): void => {
    const logDir = path.dirname(config.logFilePath || 'mock-log-file.log');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
};

/**
 * Logs data to file with timestamp
 */
export const logToFile = (data: any): void => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${JSON.stringify(data)}\n`;

    fs.appendFile(config.logFilePath || 'mock-log-file.log', logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
};

/**
 * Logs data to console (processed for BigInt)
 */
export const logToConsole = (label: string, data: any): void => {
    console.log(`${label}:`, data);
}; 