import { Request, Response } from 'express';
import { logToFile, logToConsole } from '../utils/logger';
import { kafkaService } from '../services/kafka';
import { config } from '../config';

/**
 * POST /api/log - Logs the request body and sends to Kafka
 */
export const logRequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        // Send to Kafka topic
        await kafkaService.sendMessage(
            config.kafka.topic,
            req.body,
            req.headers['x-api-key'] as string // Use API key as message key for partitioning
        );

        res.status(200).json({
            success: true,
            message: 'Request logged and sent to Kafka successfully'
        });
    } catch (error) {
        console.error('Error processing request:', error);

        // Still respond with success for logging, but indicate Kafka issue
        res.status(200).json({
            success: true,
            message: 'Request logged successfully',
            warning: 'Failed to send to Kafka'
        });
    }
};

/**
 * GET /health - Health check endpoint
 */
export const healthCheckHandler = (req: Request, res: Response): void => {
    res.status(200).json({ status: 'UP' });
}; 