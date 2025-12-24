/**
 * Account Service
 * Manages trading accounts, portfolios, and trade execution
 *
 * This service provides a unified interface for:
 * - Account initialization and management
 * - Portfolio retrieval with real-time prices
 * - Buy/Sell order execution with logging
 * - Transaction history tracking
 *
 * Usage:
 *   const accountService = new AccountService(db, marketData);
 *   await accountService.initializeAccount('trader', 10000, 'growth');
 *   const result = await accountService.buyStock('trader', 'AAPL', 10, 'Value play');
 */

import { DatabaseService } from '../database/index.js';
import { MarketDataService } from '../marketData/index.js';
import { TradeLogService } from '../TradeLogService.js';
import { PushoverService } from '../PushoverService.js';
import { PortfolioManager } from './PortfolioManager.js';
import { TradeExecutor } from './TradeExecutor.js';
import { Logger } from '../../utils/logger.js';

// Re-export types for convenience
export * from './types.js';

export class AccountService {
  private portfolioManager: PortfolioManager;
  private tradeExecutor: TradeExecutor;
  private tradeLogService: TradeLogService;

  constructor(
    private db: DatabaseService,
    private marketData: MarketDataService
  ) {
    this.tradeLogService = new TradeLogService(db);
    const pushoverService = new PushoverService();

    this.portfolioManager = new PortfolioManager(db, marketData);
    this.tradeExecutor = new TradeExecutor(
      db,
      marketData,
      this.tradeLogService,
      pushoverService,
      this.portfolioManager
    );
  }

  /**
   * Initialize a new trading account
   */
  public async initializeAccount(
    traderName: string,
    initialBalance: number,
    strategy: string
  ): Promise<void> {
    const existing = this.db.getAccount(traderName);
    if (existing) {
      Logger.warn(
        `Account ${traderName} already exists with balance $${existing.cash.toFixed(2)}`
      );
      return;
    }

    this.db.createAccount(traderName, initialBalance, strategy);
    Logger.success(
      `Initialized account for ${traderName} with $${initialBalance.toFixed(2)}`
    );
  }

  /**
   * Get complete portfolio summary with current market prices
   */
  public async getPortfolio(traderName: string) {
    return this.portfolioManager.getPortfolio(traderName);
  }

  /**
   * Execute a buy order
   */
  public async buyStock(
    traderName: string,
    symbol: string,
    quantity: number,
    rationale: string,
    prompt?: string
  ) {
    return this.tradeExecutor.executeBuy({
      traderName,
      symbol,
      quantity,
      rationale,
      prompt,
    });
  }

  /**
   * Execute a sell order
   */
  public async sellStock(
    traderName: string,
    symbol: string,
    quantity: number,
    rationale: string,
    prompt?: string
  ) {
    return this.tradeExecutor.executeSell({
      traderName,
      symbol,
      quantity,
      rationale,
      prompt,
    });
  }

  /**
   * Record current portfolio value as a snapshot
   */
  public async recordPortfolioSnapshot(traderName: string): Promise<void> {
    return this.portfolioManager.recordSnapshot(traderName);
  }

  /**
   * Get transaction history for a trader
   */
  public getTransactionHistory(traderName: string, limit: number = 50) {
    return this.db.getTransactions(traderName, limit);
  }

  /**
   * Get portfolio value history
   */
  public getPortfolioHistory(traderName: string, limit: number = 100) {
    return this.portfolioManager.getHistory(traderName, limit);
  }

  /**
   * Log a message for a trader
   */
  public log(traderName: string, type: string, message: string): void {
    this.db.createLog(traderName, type, message);
  }
}
