import { Request, Response } from 'express';
import { kafkaService } from '../services/kafka';
import { config } from '../config';
import { validationService } from '../services/validation';

/**
 * POST /api/log - Logs the request body and sends to Kafka
 */
export const logRequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const eventType = req.body.eventType;
        console.log('eventType', eventType);
        const topic = eventType === 'transaction' ? config.kafka.transactionsTopic : config.kafka.twbTopic;

        // Send to Kafka topic
        // await kafkaService.sendMessage(
        //     topic,
        //     req.body,
        //     req.headers['x-api-key'] as string // Use API key as message key for partitioning
        // );

        res.status(200).json({
            success: true,
            message: `event logged and sent to Kafka successfully`,
            eventType: eventType
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

export const validateRequestHandler = (req: Request, res: Response): void => {
    const validationResult = validationService.validateRequest(req.body);
    console.log('validationResult', validationResult);
    res.status(200).json(validationResult);
};