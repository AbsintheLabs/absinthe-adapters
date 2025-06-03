import { Request, Response } from 'express';
import { logToFile, logToConsole } from '../utils/logger';
import { kafkaService } from '../services/kafka';
import { validationService } from '../services/validation';
import { config } from '../config';

/**
 * POST /api/log - Logs the request body and sends to Kafka
 */
export const logRequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        // Validate the request body against the schema
        const validationResult = validationService.validateRequest(req.body);

        if (!validationResult.isValid) {
            res.status(400).json({
                success: false,
                message: 'Request validation failed',
                errors: validationResult.errors
            });
            return;
        }

        console.log(`✅ Valid ${validationResult.eventType} event received`);

        const topic = validationResult.eventType === 'transaction' ? config.kafka.transactionsTopic : config.kafka.twbTopic;

        // Send to Kafka topic
        await kafkaService.sendMessage(
            topic,
            req.body,
            req.headers['x-api-key'] as string // Use API key as message key for partitioning
        );

        res.status(200).json({
            success: true,
            message: `${validationResult.eventType} event logged and sent to Kafka successfully`,
            eventType: validationResult.eventType
        });
    } catch (error) {
        console.error('Error processing request:', error);

        res.status(500).json({
            success: false,
            message: 'Internal server error while processing request',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /health - Health check endpoint
 */
export const healthCheckHandler = (req: Request, res: Response): void => {
    res.status(200).json({ status: 'UP' });
};

/**
 * POST /api/validate - Validates request body without processing
 */
export const validateRequestHandler = (req: Request, res: Response): void => {
    try {
        const validationResult = validationService.validateRequest(req.body);

        if (!validationResult.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationResult.errors,
                supportedEventTypes: validationService.getSupportedEventTypes()
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `✅ Valid ${validationResult.eventType} event`,
            eventType: validationResult.eventType
        });
    } catch (error) {
        console.error('Error during validation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during validation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 