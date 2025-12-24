/**
 * Dividend Service
 * Handles dividend history and yield calculations
 */

import { Logger } from '../../utils/logger.js';
import type { PolygonClient } from './PolygonClient.js';
import type { PriceDataService } from './PriceDataService.js';
import type { DividendData, Dividend } from './types.js';

export class DividendService {
  constructor(
    private client: PolygonClient,
    private priceService: PriceDataService
  ) { }

  async getDividends(symbol: string, limit: number = 10): Promise<DividendData> {
    try {
      Logger.info(`Fetching dividends for ${symbol}`);

      const baseUrl = `https://api.polygon.io/v3/reference/dividends`;
      const params = new URLSearchParams({
        ticker: symbol,
        limit: limit.toString(),
        apiKey: this.client.getApiKey(),
      });

      const response = await fetch(`${baseUrl}?${params}`);
      const data = (await response.json()) as {
        status: string;
        results?: Array<{
          ex_dividend_date: string;
          pay_date: string;
          cash_amount: number;
          frequency: number;
        }>;
      };

      if (data.status !== 'OK' && data.status !== 'DELAYED') {
        throw new Error(`API returned status: ${data.status}`);
      }

      const dividends: Dividend[] = (data.results || []).map((d) => ({
        exDividendDate: d.ex_dividend_date,
        payDate: d.pay_date,
        cashAmount: d.cash_amount,
        frequency: this.mapDividendFrequency(d.frequency),
      }));

      // Calculate approximate yield if we have recent dividend data
      let latestYield: number | undefined;
      if (dividends.length > 0) {
        try {
          const priceData = await this.priceService.getEstimatedPrice(symbol);
          const annualDividend = this.calculateAnnualDividend(dividends);
          if (priceData.estimatedPrice > 0) {
            latestYield = (annualDividend / priceData.estimatedPrice) * 100;
          }
        } catch {
          // Yield calculation is optional
        }
      }

      return {
        symbol,
        dividends,
        latestYield,
      };
    } catch (error) {
      Logger.error(`Failed to get dividends for ${symbol}`, error);
      throw new Error(
        `Unable to fetch dividends for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private mapDividendFrequency(frequency: number): string {
    const freqMap: Record<number, string> = {
      1: 'Annual',
      2: 'Semi-Annual',
      4: 'Quarterly',
      12: 'Monthly',
    };
    return freqMap[frequency] || 'Unknown';
  }

  private calculateAnnualDividend(dividends: Dividend[]): number {
    if (dividends.length === 0) return 0;
    const latest = dividends[0];
    const multiplier: Record<string, number> = {
      Annual: 1,
      'Semi-Annual': 2,
      Quarterly: 4,
      Monthly: 12,
    };
    return latest.cashAmount * (multiplier[latest.frequency] || 4);
  }
}
