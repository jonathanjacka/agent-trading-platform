/**
 * Portfolio Manager
 * Handles portfolio retrieval and calculations
 */

import type { DatabaseService } from '../database/index.js';
import type { MarketDataService } from '../MarketDataService.js';
import type { PortfolioSummary, HoldingWithPrice } from './types.js';

export class PortfolioManager {
  constructor(
    private db: DatabaseService,
    private marketData: MarketDataService
  ) {}

  /**
   * Get complete portfolio summary with current market prices
   */
  async getPortfolio(traderName: string): Promise<PortfolioSummary> {
    const account = this.db.getAccount(traderName);
    if (!account) {
      throw new Error(`Account not found: ${traderName}`);
    }

    const holdings = this.db.getHoldings(traderName);
    const holdingsWithPrices = await this.enrichHoldingsWithPrices(holdings);

    const totalHoldingsValue = holdingsWithPrices.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    const totalValue = account.cash + totalHoldingsValue;
    const totalGain = totalValue - account.initial_balance;
    const totalGainPercent = (totalGain / account.initial_balance) * 100;

    return {
      traderName,
      cash: account.cash,
      holdings: holdingsWithPrices,
      totalHoldingsValue,
      totalValue,
      totalGain,
      totalGainPercent,
    };
  }

  /**
   * Enrich holdings with current market prices and gain calculations
   */
  private async enrichHoldingsWithPrices(
    holdings: Array<{
      symbol: string;
      quantity: number;
      avg_price: number;
    }>
  ): Promise<HoldingWithPrice[]> {
    return Promise.all(
      holdings.map(async (holding) => {
        const priceData = await this.marketData.getEstimatedPrice(
          holding.symbol
        );
        const currentPrice = priceData.estimatedPrice;
        const currentValue = currentPrice * holding.quantity;
        const costBasis = holding.avg_price * holding.quantity;
        const gain = currentValue - costBasis;
        const gainPercent = (gain / costBasis) * 100;

        return {
          symbol: holding.symbol,
          quantity: holding.quantity,
          avgPrice: holding.avg_price,
          currentPrice,
          currentValue,
          gain,
          gainPercent,
        };
      })
    );
  }

  /**
   * Record current portfolio value as a snapshot
   */
  async recordSnapshot(traderName: string): Promise<void> {
    const portfolio = await this.getPortfolio(traderName);
    this.db.recordPortfolioValue(
      traderName,
      portfolio.totalValue,
      portfolio.totalGain
    );
  }

  /**
   * Get portfolio value history
   */
  getHistory(traderName: string, limit: number = 100) {
    return this.db.getPortfolioValues(traderName, limit);
  }
}
