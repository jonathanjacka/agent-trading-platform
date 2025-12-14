import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { PushoverService } from '../services/PushoverService.js';

const pushover = new PushoverService();

/**
 * Global error handler middleware
 * Catches all unhandled errors in Express routes
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errorId = generateErrorId();

  Logger.error(
    `[${errorId}] Unhandled error in ${req.method} ${req.path}:`,
    err
  );

  // Send Pushover notification for server errors
  pushover
    .sendNotification(
      `🚨 Server Error [${errorId}]\n\n${req.method} ${req.path}\n\n${err.message}`
    )
    .catch(() => {
      // Don't let notification failure cause more issues
    });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    errorId,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * Handle 404 for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Setup process-level error handlers for uncaught exceptions
 * Call this once at app startup
 */
export function setupProcessErrorHandlers() {
  process.on('uncaughtException', async (err) => {
    Logger.error('Uncaught Exception:', err);

    await pushover
      .sendNotification(
        `💥 CRASH: Uncaught Exception\n\n${err.message}\n\n${err.stack?.slice(0, 200)}`
      )
      .catch(() => {});

    // Give time for notification to send, then exit
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    Logger.error('Unhandled Rejection:', message);

    await pushover
      .sendNotification(`⚠️ Unhandled Promise Rejection\n\n${message}`)
      .catch(() => {});
  });

  Logger.info('Process error handlers initialized');
}

function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}`;
}
