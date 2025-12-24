/**
 * Technical Indicator Service
 * Handles SMA, EMA, RSI, MACD indicators
 */

import { Logger } from '../../utils/logger.js';
import type { PolygonClient } from './PolygonClient.js';
import type { IndicatorType, IndicatorOptions, IndicatorResult } from './types.js';

export class TechnicalIndicatorService {
  constructor(private client: PolygonClient) { }

  async getIndicator(
    symbol: string,
    indicator: IndicatorType,
    options: IndicatorOptions = {}
  ): Promise<IndicatorResult> {
    const { window = 14, timespan = 'day', limit = 10 } = options;

    try {
      Logger.info(`Fetching ${indicator.toUpperCase()} for ${symbol}`);

      const baseUrl = `https://api.polygon.io/v1/indicators/${indicator}/${symbol}`;
      const params = new URLSearchParams({
        timespan,
        window: window.toString(),
        limit: limit.toString(),
        apiKey: this.client.getApiKey(),
      });

      const response = await fetch(`${baseUrl}?${params}`);
      const data = (await response.json()) as {
        status: string;
        results?: { values?: Array<{ timestamp: number; value: number }> };
      };

      if (data.status !== 'OK' && data.status !== 'DELAYED') {
        throw new Error(`API returned status: ${data.status}`);
      }

      const values = (data.results?.values || []).map((v) => ({
        timestamp: new Date(v.timestamp).toISOString(),
        value: v.value,
      }));

      return {
        symbol,
        indicator: indicator.toUpperCase(),
        values,
        window,
      };
    } catch (error) {
      Logger.error(`Failed to get ${indicator} for ${symbol}`, error);
      throw new Error(
        `Unable to fetch ${indicator} for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getSMA(symbol: string, window: number = 20, limit: number = 10): Promise<IndicatorResult> {
    return this.getIndicator(symbol, 'sma', { window, limit });
  }

  async getEMA(symbol: string, window: number = 20, limit: number = 10): Promise<IndicatorResult> {
    return this.getIndicator(symbol, 'ema', { window, limit });
  }

  async getRSI(symbol: string, window: number = 14, limit: number = 10): Promise<IndicatorResult> {
    return this.getIndicator(symbol, 'rsi', { window, limit });
  }

  async getMACD(symbol: string, limit: number = 10): Promise<IndicatorResult> {
    return this.getIndicator(symbol, 'macd', { limit });
  }
}
