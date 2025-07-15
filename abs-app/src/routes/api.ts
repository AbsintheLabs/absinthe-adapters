import { Request, Response } from 'express';
import { kafkaService } from '../services/kafka';
import { config } from '../config';
import { MessageType } from '../types/enums';
// import { validationService } from '../services/validation';

/**
 * POST /api/log - Logs the request body and sends to Kafka
 */
export const logRequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    if (events.length === 0) {
      res.status(400).json({ success: false, message: 'No events provided' });
      return;
    }

    // Since all events are same topic, just check the first one
    const eventType = events[0].eventType;
    if (!eventType) {
      res.status(400).json({ success: false, message: 'eventType is required' });
      return;
    }

    const topic =
      eventType === MessageType.TRANSACTION
        ? config.kafka.transactionsTopic
        : config.kafka.twbTopic;

    const apiKey = req.headers['x-api-key'] as string;
    await kafkaService.sendMessages(topic, events, apiKey);

    res.status(200).json({
      success: true,
      message: `${events.length} event(s) logged and sent to Kafka successfully`,
      eventType: eventType,
      eventCount: events.length,
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while processing request',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /health - Health check endpoint
 */
export const healthCheckHandler = (req: Request, res: Response): void => {
  res.status(200).json({ status: 'UP' });
};
