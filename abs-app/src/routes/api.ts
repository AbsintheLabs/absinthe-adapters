import { Request, Response } from 'express';
import { logToFile, logToConsole } from '../utils/logger';

/**
 * POST /api/log - Logs the request body
 */
export const logRequestHandler = (req: Request, res: Response): void => {
    // Log to console
    logToConsole('Request body', req.body);

    // Log to file
    logToFile(req.body);

    res.status(200).json({
        success: true,
        message: 'Request logged successfully'
    });
};

/**
 * GET /health - Health check endpoint
 */
export const healthCheckHandler = (req: Request, res: Response): void => {
    res.status(200).json({ status: 'UP' });
}; 