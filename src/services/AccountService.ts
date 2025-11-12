import { DatabaseService } from './DatabaseService.js';
import { MarketDataService } from './MarketDataService.js';
import { Logger } from '../utils/logger.js';

export interface PortfolioSummary {
  traderName: string;
  cash: number;
  holdings: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    currentValue: number;
    gain: number;
    gainPercent: number;
  }>;
  totalHoldingsValue: number;
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
}

export class AccountService {
  constructor(
    private db: DatabaseService,
    private marketData: MarketDataService
  ) {}

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

  public async getPortfolio(traderName: string): Promise<PortfolioSummary> {
    const account = this.db.getAccount(traderName);
    if (!account) {
      throw new Error(`Account not found: ${traderName}`);
    }

    const holdings = this.db.getHoldings(traderName);
    const holdingsWithPrices = await Promise.all(
      holdings.map(async (holding) => {
        const priceData = await this.marketData.getEstimatedPrice(
          holding.symbol
        );
        const currentPrice = priceData.estimatedPrice;
        const currentValue = currentPrice * holding.quantity;
        const gain = currentValue - holding.avg_price * holding.quantity;
        const gainPercent =
          (gain / (holding.avg_price * holding.quantity)) * 100;

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
   * Execute a buy order
   */
  public async buyStock(
    traderName: string,
    symbol: string,
    quantity: number,
    rationale: string
  ): Promise<{ success: boolean; message: string }> {
    const account = this.db.getAccount(traderName);
    if (!account) {
      return { success: false, message: 'Account not found' };
    }

    // Get current price
    const priceData = await this.marketData.getEstimatedPrice(symbol);
    const price = priceData.estimatedPrice;
    const totalCost = price * quantity;

    // Check if enough cash
    if (account.cash < totalCost) {
      return {
        success: false,
        message: `Insufficient funds. Need $${totalCost.toFixed(2)}, have $${account.cash.toFixed(2)}`,
      };
    }

    // Get existing holding to calculate new average price
    const existingHolding = this.db.getHolding(traderName, symbol);
    let newQuantity: number;
    let newAvgPrice: number;

    if (existingHolding) {
      newQuantity = existingHolding.quantity + quantity;
      newAvgPrice =
        (existingHolding.avg_price * existingHolding.quantity +
          price * quantity) /
        newQuantity;
    } else {
      newQuantity = quantity;
      newAvgPrice = price;
    }

    // Update holdings
    this.db.upsertHolding(traderName, symbol, newQuantity, newAvgPrice);

    // Update cash
    this.db.updateAccountCash(traderName, account.cash - totalCost);

    // Record transaction
    this.db.createTransaction(
      traderName,
      symbol,
      quantity,
      price,
      'BUY',
      rationale
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
  }

  public async sellStock(
    traderName: string,
    symbol: string,
    quantity: number,
    rationale: string
  ): Promise<{ success: boolean; message: string }> {
    const account = this.db.getAccount(traderName);
    if (!account) {
      return { success: false, message: 'Account not found' };
    }

    // Check if holding exists
    const holding = this.db.getHolding(traderName, symbol);
    if (!holding) {
      return {
        success: false,
        message: `No holdings found for ${symbol}`,
      };
    }

    if (holding.quantity < quantity) {
      return {
        success: false,
        message: `Insufficient shares. Have ${holding.quantity}, trying to sell ${quantity}`,
      };
    }

    // Get current price
    const priceData = await this.marketData.getEstimatedPrice(symbol);
    const price = priceData.estimatedPrice;
    const totalProceeds = price * quantity;

    // Update holdings
    const newQuantity = holding.quantity - quantity;
    if (newQuantity === 0) {
      this.db.deleteHolding(traderName, symbol);
    } else {
      this.db.upsertHolding(traderName, symbol, newQuantity, holding.avg_price);
    }

    // Update cash
    this.db.updateAccountCash(traderName, account.cash + totalProceeds);

    // Record transaction
    this.db.createTransaction(
      traderName,
      symbol,
      quantity,
      price,
      'SELL',
      rationale
    );

    const gain = (price - holding.avg_price) * quantity;
    const gainPercent = (gain / (holding.avg_price * quantity)) * 100;

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
  }

  public async recordPortfolioSnapshot(traderName: string): Promise<void> {
    const portfolio = await this.getPortfolio(traderName);
    this.db.recordPortfolioValue(
      traderName,
      portfolio.totalValue,
      portfolio.totalGain
    );
  }

  public getTransactionHistory(traderName: string, limit: number = 50) {
    return this.db.getTransactions(traderName, limit);
  }

  public getPortfolioHistory(traderName: string, limit: number = 100) {
    return this.db.getPortfolioValues(traderName, limit);
  }

  public log(traderName: string, type: string, message: string): void {
    this.db.createLog(traderName, type, message);
  }
}
