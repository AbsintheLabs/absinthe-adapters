import fs from 'fs';
import path from 'path';
import { LOG_FILE_PATH } from './consts';
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private context?: string;
  private logFile?: string;

  constructor(context?: string, logFile?: string) {
    this.context = context;
    this.logFile = logFile;

    if (this.logFile) {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = this.context ? `[${this.context}] ` : '';

    let logMessage = `${timestamp} ${levelName} ${contextStr}${message}`;

    if (data) {
      if (data instanceof Error) {
        logMessage += ` - ${data.message}`;
        if (data.stack) {
          logMessage += `\n${data.stack}`;
        }
      } else {
        logMessage += ` - ${JSON.stringify(this.sanitize(data))}`;
      }
    }

    // Console output
    const consoleMethod = level >= LogLevel.ERROR ? console.error : console.log;
    consoleMethod(logMessage);

    // File output
    if (this.logFile) {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    }
  }

  private sanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));
    if (typeof obj === 'object') {
      // Handle special objects that can't be iterated with for...in
      if (obj instanceof Headers) {
        const headersObj: any = {};
        obj.forEach((value, key) => {
          headersObj[key] = value;
        });
        return headersObj;
      }
      if (obj instanceof URLSearchParams) {
        return Object.fromEntries(obj);
      }
      if (obj instanceof Map) {
        return Object.fromEntries(obj);
      }
      if (obj instanceof Set) {
        return Array.from(obj);
      }
      // Check if it's a plain object (not a class instance)
      if (Object.getPrototypeOf(obj) === null || Object.getPrototypeOf(obj) === Object.prototype) {
        const result: any = {};
        for (const key in obj) {
          try {
            result[key] = this.sanitize(obj[key]);
          } catch (e) {
            // If accessing the property fails, skip it
            result[key] = '[Unable to serialize]';
          }
        }
        return result;
      }
      // For other objects (class instances), try to convert to string or get basic info
      if (
        obj.toString &&
        typeof obj.toString === 'function' &&
        obj.toString !== Object.prototype.toString
      ) {
        return obj.toString();
      }
      // Fallback: return a simple representation
      return '[Object]';
    }
    return obj;
  }
}

// Default logger instance
export const logger = new Logger(undefined, LOG_FILE_PATH);

// Create logger with context
export const createLogger = (context: string) => {
  return new Logger(context, LOG_FILE_PATH);
};
