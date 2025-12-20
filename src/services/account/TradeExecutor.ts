/**
 * Trade Executor
 * Handles buy and sell order execution with logging and notifications
 */

import type { DatabaseService } from '../database/index.js';
import type { MarketDataService } from '../MarketDataService.js';
import type { TradeLogService } from '../TradeLogService.js';
import type { PushoverService } from '../PushoverService.js';
import type { PortfolioManager } from './PortfolioManager.js';
import type {
  TradeResult,
  TradeParams,
  PortfolioSummary,
  MarketDataSnapshot,
} from './types.js';
import { Logger } from '../../utils/logger.js';

export class TradeExecutor {
  constructor(
    private db: DatabaseService,
    private marketData: MarketDataService,
    private tradeLogService: TradeLogService,
    private pushoverService: PushoverService,
    private portfolioManager: PortfolioManager
  ) {}

  /**
   * Execute a buy order
   */
  async executeBuy(params: TradeParams): Promise<TradeResult> {
    const { traderName, symbol, quantity, rationale, prompt } = params;
    const startTime = Date.now();
    let portfolioBefore: PortfolioSummary | undefined;
    let priceData: { estimatedPrice: number; marketCap?: number } | undefined;
    let price: number | undefined;

    try {
      portfolioBefore = await this.portfolioManager.getPortfolio(traderName);

      const account = this.db.getAccount(traderName);
      if (!account) {
        return this.handleBuyError(
          params,
          startTime,
          'Account not found',
          portfolioBefore
        );
      }

      // Get current price
      priceData = await this.marketData.getEstimatedPrice(symbol);
      price = priceData.estimatedPrice;
      const totalCost = price * quantity;

      // Check if enough cash
      if (account.cash < totalCost) {
        const errorMessage = `Insufficient funds. Need $${totalCost.toFixed(2)}, have $${account.cash.toFixed(2)}`;
        return this.handleBuyError(
          params,
          startTime,
          errorMessage,
          portfolioBefore,
          price,
          this.createMarketSnapshot(priceData, price)
        );
      }

      // Calculate new position
      const existingHolding = this.db.getHolding(traderName, symbol);
      const { newQuantity, newAvgPrice } = this.calculateNewPosition(
        existingHolding,
        quantity,
        price
      );

      // Execute the trade
      this.db.upsertHolding(traderName, symbol, newQuantity, newAvgPrice);
      this.db.updateAccountCash(traderName, account.cash - totalCost);
      this.db.createTransaction(
        traderName,
        symbol,
        quantity,
        price,
        'BUY',
        rationale
      );

      // Log success
      const portfolioAfter =
        await this.portfolioManager.getPortfolio(traderName);
      this.logSuccessfulTrade(
        params,
        'BUY',
        startTime,
        price,
        this.createMarketSnapshot(priceData, price),
        portfolioBefore,
        portfolioAfter
      );

      // Notify
      await this.pushoverService.notifyTrade(
        traderName,
        'BUY',
        symbol,
        quantity,
        price,
        totalCost
      );

      Logger.buyOrder(
        traderName,
        quantity,
        symbol,
        `@ $${price.toFixed(2)} = $${totalCost.toFixed(2)}`
      );

      return {
        success: true,
        message: `Bought ${quantity} shares of ${symbol} at $${price.toFixed(2)}`,
      };
    } catch (error) {
      return this.handleBuyException(
        params,
        startTime,
        error,
        portfolioBefore,
        price,
        priceData ? this.createMarketSnapshot(priceData, price!) : undefined
      );
    }
  }

  /**
   * Execute a sell order
   */
  async executeSell(params: TradeParams): Promise<TradeResult> {
    const { traderName, symbol, quantity, rationale, prompt } = params;
    const startTime = Date.now();
    let portfolioBefore: PortfolioSummary | undefined;
    let priceData: { estimatedPrice: number; marketCap?: number } | undefined;
    let price: number | undefined;

    try {
      portfolioBefore = await this.portfolioManager.getPortfolio(traderName);

      const account = this.db.getAccount(traderName);
      if (!account) {
        return this.handleSellError(
          params,
          startTime,
          'Account not found',
          portfolioBefore
        );
      }

      // Check if holding exists
      const holding = this.db.getHolding(traderName, symbol);
      if (!holding) {
        return this.handleSellError(
          params,
          startTime,
          `No holdings found for ${symbol}`,
          portfolioBefore
        );
      }

      if (holding.quantity < quantity) {
        return this.handleSellError(
          params,
          startTime,
          `Insufficient shares. Have ${holding.quantity}, trying to sell ${quantity}`,
          portfolioBefore
        );
      }

      // Get current price
      priceData = await this.marketData.getEstimatedPrice(symbol);
      price = priceData.estimatedPrice;
      const totalProceeds = price * quantity;

      // Update holdings
      const newQuantity = holding.quantity - quantity;
      if (newQuantity === 0) {
        this.db.deleteHolding(traderName, symbol);
      } else {
        this.db.upsertHolding(
          traderName,
          symbol,
          newQuantity,
          holding.avg_price
        );
      }

      // Update cash and record transaction
      this.db.updateAccountCash(traderName, account.cash + totalProceeds);
      this.db.createTransaction(
        traderName,
        symbol,
        quantity,
        price,
        'SELL',
        rationale
      );

      // Calculate gain
      const gain = (price - holding.avg_price) * quantity;
      const gainPercent = (gain / (holding.avg_price * quantity)) * 100;

      // Log success
      const portfolioAfter =
        await this.portfolioManager.getPortfolio(traderName);
      const snapshot = this.createMarketSnapshot(priceData, price);
      snapshot.gain = gain;
      snapshot.gainPercent = gainPercent;

      this.logSuccessfulTrade(
        params,
        'SELL',
        startTime,
        price,
        snapshot,
        portfolioBefore,
        portfolioAfter
      );

      // Notify
      await this.pushoverService.notifyTrade(
        traderName,
        'SELL',
        symbol,
        quantity,
        price,
        totalProceeds
      );

      Logger.sellOrder(
        traderName,
        quantity,
        symbol,
        `@ $${price.toFixed(2)} = $${totalProceeds.toFixed(2)} (${gainPercent >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%)`
      );

      return {
        success: true,
        message: `Sold ${quantity} shares of ${symbol} at $${price.toFixed(2)} (Gain: ${gainPercent >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%)`,
      };
    } catch (error) {
      return this.handleSellException(
        params,
        startTime,
        error,
        portfolioBefore,
        price,
        priceData ? this.createMarketSnapshot(priceData, price!) : undefined
      );
    }
  }

  /**
   * Calculate new position after a buy
   */
  private calculateNewPosition(
    existingHolding: { quantity: number; avg_price: number } | undefined,
    quantity: number,
    price: number
  ): { newQuantity: number; newAvgPrice: number } {
    if (existingHolding) {
      const newQuantity = existingHolding.quantity + quantity;
      const newAvgPrice =
        (existingHolding.avg_price * existingHolding.quantity +
          price * quantity) /
        newQuantity;
      return { newQuantity, newAvgPrice };
    }
    return { newQuantity: quantity, newAvgPrice: price };
  }

  /**
   * Create market data snapshot
   */
  private createMarketSnapshot(
    priceData: { estimatedPrice: number; marketCap?: number },
    price: number
  ): MarketDataSnapshot {
    return {
      price,
      marketCap: priceData.marketCap,
      estimatedPrice: priceData.estimatedPrice,
    };
  }

  /**
   * Log a successful trade
   */
  private logSuccessfulTrade(
    params: TradeParams,
    action: 'BUY' | 'SELL',
    startTime: number,
    price: number,
    marketDataSnapshot: MarketDataSnapshot,
    portfolioBefore: PortfolioSummary,
    portfolioAfter: PortfolioSummary
  ): void {
    this.tradeLogService.logTrade({
      traderName: params.traderName,
      prompt: params.prompt,
      action,
      symbol: params.symbol,
      quantity: params.quantity,
      price,
      success: true,
      executionTimeMs: Date.now() - startTime,
      rationale: params.rationale,
      marketDataSnapshot,
      portfolioBefore,
      portfolioAfter,
    });
  }

  /**
   * Handle buy error (validation failures)
   */
  private handleBuyError(
    params: TradeParams,
    startTime: number,
    errorMessage: string,
    portfolioBefore?: PortfolioSummary,
    price?: number,
    marketDataSnapshot?: MarketDataSnapshot
  ): TradeResult {
    this.tradeLogService.logTrade({
      traderName: params.traderName,
      prompt: params.prompt,
      action: errorMessage === 'Account not found' ? 'ERROR' : 'BUY',
      symbol: params.symbol,
      quantity: params.quantity,
      price,
      success: false,
      errorMessage,
      executionTimeMs: Date.now() - startTime,
      rationale: params.rationale,
      marketDataSnapshot,
      portfolioBefore,
    });
    return { success: false, message: errorMessage };
  }

  /**
   * Handle buy exception (unexpected errors)
   */
  private async handleBuyException(
    params: TradeParams,
    startTime: number,
    error: unknown,
    portfolioBefore?: PortfolioSummary,
    price?: number,
    marketDataSnapshot?: MarketDataSnapshot
  ): Promise<TradeResult> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    this.tradeLogService.logTrade({
      traderName: params.traderName,
      prompt: params.prompt,
      action: 'BUY',
      symbol: params.symbol,
      quantity: params.quantity,
      price,
      success: false,
      errorMessage,
      executionTimeMs: Date.now() - startTime,
      rationale: params.rationale,
      marketDataSnapshot,
      portfolioBefore,
    });

    await this.pushoverService.notifyTradeError(
      params.traderName,
      'BUY',
      params.symbol,
      params.quantity,
      errorMessage
    );

    Logger.error(`Buy order failed for ${params.traderName}`, error);
    throw error;
  }

  /**
   * Handle sell error (validation failures)
   */
  private handleSellError(
    params: TradeParams,
    startTime: number,
    errorMessage: string,
    portfolioBefore?: PortfolioSummary
  ): TradeResult {
    this.tradeLogService.logTrade({
      traderName: params.traderName,
      prompt: params.prompt,
      action: errorMessage === 'Account not found' ? 'ERROR' : 'SELL',
      symbol: params.symbol,
      quantity: params.quantity,
      success: false,
      errorMessage,
      executionTimeMs: Date.now() - startTime,
      rationale: params.rationale,
      portfolioBefore,
    });
    return { success: false, message: errorMessage };
  }

  /**
   * Handle sell exception (unexpected errors)
   */
  private async handleSellException(
    params: TradeParams,
    startTime: number,
    error: unknown,
    portfolioBefore?: PortfolioSummary,
    price?: number,
    marketDataSnapshot?: MarketDataSnapshot
  ): Promise<TradeResult> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    this.tradeLogService.logTrade({
      traderName: params.traderName,
      prompt: params.prompt,
      action: 'SELL',
      symbol: params.symbol,
      quantity: params.quantity,
      price,
      success: false,
      errorMessage,
      executionTimeMs: Date.now() - startTime,
      rationale: params.rationale,
      marketDataSnapshot,
      portfolioBefore,
    });

    await this.pushoverService.notifyTradeError(
      params.traderName,
      'SELL',
      params.symbol,
      params.quantity,
      errorMessage
    );

    Logger.error(`Sell order failed for ${params.traderName}`, error);
    throw error;
  }
}
