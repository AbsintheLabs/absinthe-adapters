import { createApp } from './app';
import { config } from './config';
import { kafkaService } from './services/kafka';

/**
 * Start the server
 */
const startServer = (): void => {
  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    // Close HTTP server
    server.close(async () => {
      console.log('HTTP server closed');

      try {
        // Disconnect Kafka producer
        await kafkaService.disconnect();
        console.log('Kafka producer disconnected');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Start the application
startServer();
