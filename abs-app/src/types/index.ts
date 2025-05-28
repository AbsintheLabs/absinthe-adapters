export interface ApiKeyConfig {
    points: number;
    duration: number;
}

export interface ApiKeys {
    [key: string]: ApiKeyConfig;
}

export interface RateLimiters {
    [key: string]: any; // RateLimiterMemory type
}

export interface LogEntry {
    timestamp: string;
    data: any;
} 