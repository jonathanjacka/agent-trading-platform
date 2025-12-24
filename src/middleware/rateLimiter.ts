import rateLimit from 'express-rate-limit';
import { Logger } from '../utils/logger.js';

/**
 * Standard rate limiter for general API endpoints
 * Very generous limits - primarily for abuse prevention, not throttling normal use
 *
 * Behind Railway's proxy, we need to use X-Forwarded-For header for real IP
 */
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per 15 min (~2/second sustained)
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable validation for Railway deployment - service is behind proxy which normalizes IPs
  validate: { xForwardedForHeader: false },
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  // Use X-Forwarded-For header when behind proxy
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    return realIp || req.ip || 'unknown';
  },
  handler: (req, res, next, options) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    Logger.warn(`Rate limit exceeded for IP: ${realIp || req.ip}`);
    res.status(429).json(options.message);
  },
});

/**
 * Strict rate limiter for expensive operations (AI trades)
 * 30 requests per 15 minutes per IP - enough for active trading
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: {
    error: 'Too many trade requests',
    message: 'Trade endpoints are limited to prevent abuse',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable validation for Railway deployment - service is behind proxy which normalizes IPs
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    return realIp || req.ip || 'unknown';
  },
  handler: (req, res, next, options) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim();
    Logger.warn(
      `Strict rate limit exceeded for IP: ${realIp || req.ip} on ${req.path}`
    );
    res.status(429).json(options.message);
  },
});

