// Log levels enum
export enum LogLevel {
  SILLY = 0,
  TRACE = 1,
  DEBUG = 2,
  INFO = 3,
  WARN = 4,
  ERROR = 5,
  FATAL = 6,
}

// Helper function to get formatted timestamp
const getTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

// Get current log level from environment variable
const getCurrentLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  switch (level) {
    case 'silly':
      return LogLevel.SILLY;
    case 'trace':
      return LogLevel.TRACE;
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'fatal':
      return LogLevel.FATAL;
    default:
      return LogLevel.INFO; // Default to INFO level
  }
};

// Helper function to check if a log level should be output
const shouldLog = (level: LogLevel): boolean => {
  return level >= getCurrentLogLevel();
};

// Console-based logger with timestamps and level filtering
const createLogger = () => ({
  silly: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.SILLY)) {
      console.debug(`${getTimestamp()} [SILLY] ${message}`, ...args);
    }
  },
  trace: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.TRACE)) {
      console.debug(`${getTimestamp()} [TRACE] ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(`${getTimestamp()} [DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.INFO)) {
      console.info(`${getTimestamp()} [INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(`${getTimestamp()} [WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(`${getTimestamp()} [ERROR] ${message}`, ...args);
    }
  },
  fatal: (message: string, ...args: any[]) => {
    if (shouldLog(LogLevel.FATAL)) {
      console.error(`${getTimestamp()} [FATAL] ${message}`, ...args);
    }
  },
});

// Export the logger instance
export const log = createLogger();
