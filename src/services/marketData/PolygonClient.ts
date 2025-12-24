/**
 * Polygon API Client
 * Base client with caching for Polygon.io API
 */

import { restClient } from '@massive.com/client-js';
import { Logger } from '../../utils/logger.js';
import type { CacheEntry } from './types.js';

export class PolygonClient {
  private client: ReturnType<typeof restClient>;
  private apiKey: string;
  private tickerCache: Map<string, CacheEntry<unknown>> = new Map();
  private CACHE_TTL = 15 * 60 * 1000; // 15 minutes (matches data delay from API)

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('POLY_API_KEY is required for PolygonClient');
    }

    this.apiKey = apiKey;
    this.client = restClient(apiKey, 'https://api.massive.com', {
      pagination: false,
    });

    Logger.info('PolygonClient initialized (Stocks Starter) - 15min cache');
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getRestClient(): ReturnType<typeof restClient> {
    return this.client;
  }

  getCached<T>(key: string): T | null {
    const cached = this.tickerCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      Logger.info(`Using cached data for ${key}`);
      return cached.data as T;
    }
    return null;
  }

  setCache<T>(key: string, data: T): void {
    this.tickerCache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.tickerCache.clear();
    Logger.info('PolygonClient cache cleared');
  }
}
