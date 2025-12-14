import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';

/**
 * Middleware to require API key for protected endpoints
 *
 * Expects header: X-API-Key: <your-secret>
 * Or query param: ?apiKey=<your-secret>
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiSecret = process.env.API_SECRET;

  // If no API_SECRET is configured, skip auth (for local dev)
  if (!apiSecret) {
    Logger.warn('API_SECRET not configured - auth disabled');
    return next();
  }

  // Check header first, then query param
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!providedKey) {
    Logger.warn(
      `Unauthorized request to ${req.method} ${req.path} - no API key`
    );
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Provide X-API-Key header.',
    });
  }

  if (providedKey !== apiSecret) {
    Logger.warn(
      `Unauthorized request to ${req.method} ${req.path} - invalid API key`
    );
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
  }

  next();
}

/**
 * List of paths that require authentication
 * Used for logging/documentation purposes
 */
export const protectedPaths = [
  'POST /api/traders/:name/trade',
  'POST /api/scheduler/trigger',
  'POST /api/scheduler/enable',
  'POST /api/scheduler/session',
  'POST /test-notification',
];
