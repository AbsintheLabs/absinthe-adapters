import { createClient, RedisClientType } from 'redis';

/**
 * Singleton Redis service that provides an idempotent, reusable connection
 * Handles connection management, reconnection, and graceful shutdown
 */
export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType | null = null;
  private isConnected = false;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of RedisService
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Get the Redis client - initializes connection if needed
   * This method is idempotent - safe to call multiple times
   */
  public async getClient(): Promise<RedisClientType> {
    if (this.isConnected && this.client) {
      return this.client;
    }

    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      if (this.client) {
        return this.client;
      }
    }

    return this.connect();
  }

  /**
   * Initialize Redis connection with retry logic
   * Idempotent - safe to call multiple times
   */
  public async connect(): Promise<RedisClientType> {
    if (this.isConnected && this.client) {
      return this.client;
    }

    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      if (this.client) {
        return this.client;
      }
    }

    this.isConnecting = true;

    this.connectionPromise = this.performConnection();
    await this.connectionPromise;

    this.isConnecting = false;
    this.connectionPromise = null;

    if (!this.client) {
      throw new Error('Failed to establish Redis connection');
    }

    return this.client;
  }

  /**
   * Internal method to perform the actual connection
   */
  private async performConnection(): Promise<void> {
    try {
      // Create client if it doesn't exist
      if (!this.client) {
        this.client = createClient({
          url: process.env.REDIS_URL,
          socket: {
            reconnectStrategy: (retries) => {
              // Exponential backoff with max delay of 5 seconds
              const delay = Math.min(retries * 100, 5000);
              console.log(`Redis reconnect attempt ${retries}, waiting ${delay}ms`);
              return delay;
            },
            connectTimeout: 10000, // 10 seconds
          },
          // Enable reconnection
          pingInterval: 30000, // Ping every 30 seconds to keep connection alive
        });

        // Set up event handlers
        this.setupEventHandlers();
      }

      // Connect if not already connected
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      this.isConnected = true;
      console.log('Redis connected successfully');
    } catch (error) {
      this.isConnected = false;
      console.error('Redis connection failed:', error);
      throw error;
    }
  }

  /**
   * Set up Redis client event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
      this.isConnected = false;
    });
  }

  /**
   * Check if Redis is connected
   */
  public isReady(): boolean {
    return this.isConnected && this.client?.isOpen === true;
  }

  /**
   * Gracefully disconnect from Redis
   * Idempotent - safe to call multiple times
   */
  public async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      try {
        await this.client.disconnect();
        console.log('Redis disconnected successfully');
      } catch (error) {
        console.error('Error disconnecting from Redis:', error);
      }
    }

    this.isConnected = false;
    this.client = null;
  }

  /**
   * Execute a Redis command with automatic connection handling
   * Ensures connection is established before executing the command
   */
  public async execute<T>(command: (client: RedisClientType) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    return command(client);
  }
}
