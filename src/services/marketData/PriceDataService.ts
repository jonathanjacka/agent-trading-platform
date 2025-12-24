/**
 * Price Data Service
 * Handles price estimates and snapshots
 */

import { Logger } from '../../utils/logger.js';
import type { PolygonClient } from './PolygonClient.js';
import type { EstimatedPrice, PriceSnapshot } from './types.js';

export class PriceDataService {
  constructor(private client: PolygonClient) { }

  async getEstimatedPrice(symbol: string): Promise<EstimatedPrice> {
    try {
      // Try cache first
      let response = this.client.getCached<any>(symbol);
      if (!response) {
        response = await this.client.getRestClient().getTicker(symbol);
        this.client.setCache(symbol, response);
      }

      const marketCap = response.results.market_cap || 0;
      const sharesOutstanding = response.results.weighted_shares_outstanding || 1;
      const estimatedPrice = marketCap / sharesOutstanding;

      Logger.info(`Estimated price for ${symbol}: $${estimatedPrice.toFixed(2)}`);

      return {
        symbol,
        estimatedPrice,
        marketCap,
        sharesOutstanding,
        note: 'Estimated from market cap / shares outstanding. Updated daily, not real-time.',
      };
    } catch (error) {
      Logger.error(`Failed to estimate price for ${symbol}`, error);
      throw error;
    }
  }

  async getSnapshot(symbol: string): Promise<PriceSnapshot> {
    try {
      Logger.info(`Fetching snapshot for ${symbol}`);

      // Use previous day aggregates for Stocks Starter tier
      const baseUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev`;
      const params = new URLSearchParams({
        apiKey: this.client.getApiKey(),
      });

      const response = await fetch(`${baseUrl}?${params}`);
      const data = (await response.json()) as {
        status: string;
        results?: Array<{
          c: number;
          o: number;
          h: number;
          l: number;
          v: number;
          t: number;
        }>;
      };

      if (data.status !== 'OK' && data.status !== 'DELAYED') {
        throw new Error(`API returned status: ${data.status}`);
      }

      const result = data.results?.[0];
      if (!result) {
        throw new Error(`No snapshot data found for ${symbol}`);
      }

      const close = result.c;
      const open = result.o;
      const change = close - open;
      const changePercent = (change / open) * 100;

      return {
        symbol,
        price: close,
        change,
        changePercent,
        volume: result.v,
        open,
        high: result.h,
        low: result.l,
        previousClose: result.c,
        timestamp: new Date(result.t).toISOString(),
        note: 'Data from previous trading day (15-min delayed tier)',
      };
    } catch (error) {
      Logger.error(`Failed to get snapshot for ${symbol}`, error);
      throw new Error(
        `Unable to fetch snapshot for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
