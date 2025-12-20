import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccountService } from './index.js';
import { DatabaseService } from '../database/index.js';
import { MarketDataService } from '../MarketDataService.js';

// Mock PushoverService
vi.mock('../PushoverService.js', () => ({
  PushoverService: class MockPushoverService {
    notifyTrade = vi.fn().mockResolvedValue(undefined);
    notifyTradeError = vi.fn().mockResolvedValue(undefined);
    sendNotification = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock TradeLogService
vi.mock('../TradeLogService.js', () => ({
  TradeLogService: class MockTradeLogService {
    logTrade = vi.fn();
  },
}));

describe('AccountService', () => {
  let accountService: AccountService;
  let db: DatabaseService;
  let mockMarketData: MarketDataService;

  beforeEach(() => {
    // Reset singletons
    // @ts-ignore
    DatabaseService.instance = undefined;

    db = DatabaseService.getInstance(':memory:');

    // Create mock market data service
    mockMarketData = {
      getEstimatedPrice: vi.fn().mockResolvedValue({
        symbol: 'AAPL',
        estimatedPrice: 150.0,
        marketCap: 2500000000000,
        sharesOutstanding: 16000000000,
        note: 'Mock price',
      }),
    } as unknown as MarketDataService;

    accountService = new AccountService(db, mockMarketData);
  });

  afterEach(() => {
    db.close();
  });

  describe('Account Initialization', () => {
    it('should initialize a new account', async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');

      const account = db.getAccount('TestTrader');
      expect(account).toBeDefined();
      expect(account!.cash).toBe(10000);
      expect(account!.initial_balance).toBe(10000);
      expect(account!.strategy).toBe('growth');
    });

    it('should not reinitialize an existing account', async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');
      await accountService.initializeAccount('TestTrader', 50000, 'value');

      const account = db.getAccount('TestTrader');
      expect(account!.cash).toBe(10000); // Original balance preserved
      expect(account!.strategy).toBe('growth'); // Original strategy preserved
    });

    it('should initialize multiple accounts independently', async () => {
      await accountService.initializeAccount('Trader1', 10000, 'growth');
      await accountService.initializeAccount('Trader2', 25000, 'value');

      const account1 = db.getAccount('Trader1');
      const account2 = db.getAccount('Trader2');

      expect(account1!.cash).toBe(10000);
      expect(account2!.cash).toBe(25000);
    });
  });

  describe('Portfolio Operations', () => {
    beforeEach(async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');
    });

    it('should return portfolio with no holdings', async () => {
      const portfolio = await accountService.getPortfolio('TestTrader');

      expect(portfolio.traderName).toBe('TestTrader');
      expect(portfolio.cash).toBe(10000);
      expect(portfolio.holdings).toHaveLength(0);
      expect(portfolio.totalHoldingsValue).toBe(0);
      expect(portfolio.totalValue).toBe(10000);
      expect(portfolio.totalGain).toBe(0);
      expect(portfolio.totalGainPercent).toBe(0);
    });

    it('should throw error for non-existent account', async () => {
      await expect(accountService.getPortfolio('NonExistent')).rejects.toThrow(
        'Account not found: NonExistent'
      );
    });

    it('should calculate portfolio with holdings', async () => {
      // Add a holding directly to test portfolio calculation
      db.upsertHolding('TestTrader', 'AAPL', 10, 140.0);
      db.updateAccountCash('TestTrader', 8600); // 10000 - (10 * 140)

      const portfolio = await accountService.getPortfolio('TestTrader');

      expect(portfolio.cash).toBe(8600);
      expect(portfolio.holdings).toHaveLength(1);
      expect(portfolio.holdings[0].symbol).toBe('AAPL');
      expect(portfolio.holdings[0].quantity).toBe(10);
      expect(portfolio.holdings[0].avgPrice).toBe(140);
      expect(portfolio.holdings[0].currentPrice).toBe(150); // From mock
      expect(portfolio.holdings[0].currentValue).toBe(1500); // 10 * 150
      expect(portfolio.holdings[0].gain).toBe(100); // 1500 - 1400
      expect(portfolio.totalHoldingsValue).toBe(1500);
      expect(portfolio.totalValue).toBe(10100); // 8600 + 1500
    });

    it('should record portfolio snapshot', async () => {
      await accountService.recordPortfolioSnapshot('TestTrader');

      const history = accountService.getPortfolioHistory('TestTrader');
      expect(history).toHaveLength(1);
      expect(history[0].total_value).toBe(10000);
      expect(history[0].pnl).toBe(0);
    });
  });

  describe('Buy Stock Operations', () => {
    beforeEach(async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');
    });

    it('should execute successful buy order', async () => {
      const result = await accountService.buyStock(
        'TestTrader',
        'AAPL',
        10,
        'Value investment'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Bought 10 shares of AAPL');

      // Verify account state
      const account = db.getAccount('TestTrader');
      expect(account!.cash).toBe(8500); // 10000 - (10 * 150)

      // Verify holding
      const holding = db.getHolding('TestTrader', 'AAPL');
      expect(holding).toBeDefined();
      expect(holding!.quantity).toBe(10);
      expect(holding!.avg_price).toBe(150);

      // Verify transaction recorded
      const transactions = db.getTransactions('TestTrader');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('BUY');
      expect(transactions[0].symbol).toBe('AAPL');
      expect(transactions[0].quantity).toBe(10);
    });

    it('should reject buy order with insufficient funds', async () => {
      const result = await accountService.buyStock(
        'TestTrader',
        'AAPL',
        100, // Would cost $15,000
        'Too expensive'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient funds');

      // Verify no changes made
      const account = db.getAccount('TestTrader');
      expect(account!.cash).toBe(10000);

      const holding = db.getHolding('TestTrader', 'AAPL');
      expect(holding).toBeUndefined();
    });

    it('should reject buy order for non-existent account', async () => {
      await expect(
        accountService.buyStock('NonExistent', 'AAPL', 10, 'Test')
      ).rejects.toThrow('Account not found: NonExistent');
    });

    it('should average down existing position', async () => {
      // First buy at $150 (uses default mock)
      await accountService.buyStock('TestTrader', 'AAPL', 10, 'Initial');

      // Reset and set up new mock for second buy at $100
      vi.mocked(mockMarketData.getEstimatedPrice).mockReset();
      vi.mocked(mockMarketData.getEstimatedPrice).mockResolvedValue({
        symbol: 'AAPL',
        estimatedPrice: 100.0,
        marketCap: 2500000000000,
        sharesOutstanding: 16000000000,
        note: 'Mock price',
      });

      // Second buy at $100
      await accountService.buyStock('TestTrader', 'AAPL', 10, 'Average down');

      const holding = db.getHolding('TestTrader', 'AAPL');
      expect(holding!.quantity).toBe(20);
      // Average price: (10*150 + 10*100) / 20 = 125
      expect(holding!.avg_price).toBe(125);

      const account = db.getAccount('TestTrader');
      // 10000 - 1500 - 1000 = 7500
      expect(account!.cash).toBe(7500);
    });

    it('should handle multiple different stocks', async () => {
      await accountService.buyStock('TestTrader', 'AAPL', 10, 'Tech');
      await accountService.buyStock('TestTrader', 'GOOGL', 5, 'Tech');

      const holdings = db.getHoldings('TestTrader');
      expect(holdings).toHaveLength(2);

      const account = db.getAccount('TestTrader');
      // 10000 - 1500 - 750 = 7750
      expect(account!.cash).toBe(7750);
    });
  });

  describe('Sell Stock Operations', () => {
    beforeEach(async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');
      // Set up initial position
      db.upsertHolding('TestTrader', 'AAPL', 20, 100.0);
      db.updateAccountCash('TestTrader', 8000); // 10000 - 2000
    });

    it('should execute successful sell order', async () => {
      const result = await accountService.sellStock(
        'TestTrader',
        'AAPL',
        10,
        'Taking profits'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Sold 10 shares of AAPL');
      expect(result.message).toContain('Gain:');

      // Verify account state
      const account = db.getAccount('TestTrader');
      expect(account!.cash).toBe(9500); // 8000 + (10 * 150)

      // Verify holding reduced
      const holding = db.getHolding('TestTrader', 'AAPL');
      expect(holding!.quantity).toBe(10);
      expect(holding!.avg_price).toBe(100); // Avg price unchanged

      // Verify transaction recorded
      const transactions = db.getTransactions('TestTrader');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('SELL');
    });

    it('should remove holding when selling all shares', async () => {
      const result = await accountService.sellStock(
        'TestTrader',
        'AAPL',
        20,
        'Exit position'
      );

      expect(result.success).toBe(true);

      const holding = db.getHolding('TestTrader', 'AAPL');
      expect(holding).toBeUndefined();

      const account = db.getAccount('TestTrader');
      expect(account!.cash).toBe(11000); // 8000 + (20 * 150)
    });

    it('should reject sell order for non-existent holding', async () => {
      const result = await accountService.sellStock(
        'TestTrader',
        'GOOGL',
        10,
        'No position'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('No holdings found for GOOGL');
    });

    it('should reject sell order for insufficient shares', async () => {
      const result = await accountService.sellStock(
        'TestTrader',
        'AAPL',
        30, // Only have 20
        'Too many'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient shares');
      expect(result.message).toContain('Have 20');

      // Verify no changes made
      const holding = db.getHolding('TestTrader', 'AAPL');
      expect(holding!.quantity).toBe(20);
    });

    it('should reject sell order for non-existent account', async () => {
      await expect(
        accountService.sellStock('NonExistent', 'AAPL', 10, 'Test')
      ).rejects.toThrow('Account not found: NonExistent');
    });

    it('should calculate correct gain percentage', async () => {
      // Selling at $150, bought at $100 = 50% gain
      const result = await accountService.sellStock(
        'TestTrader',
        'AAPL',
        10,
        'Profit taking'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('+50.00%');
    });
  });

  describe('Transaction History', () => {
    beforeEach(async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');
    });

    it('should return empty history for new account', () => {
      const history = accountService.getTransactionHistory('TestTrader');
      expect(history).toHaveLength(0);
    });

    it('should track all transactions', async () => {
      await accountService.buyStock('TestTrader', 'AAPL', 10, 'Buy 1');
      await accountService.buyStock('TestTrader', 'GOOGL', 5, 'Buy 2');

      db.upsertHolding('TestTrader', 'MSFT', 10, 100);
      await accountService.sellStock('TestTrader', 'MSFT', 5, 'Sell');

      const history = accountService.getTransactionHistory('TestTrader');
      expect(history).toHaveLength(3);
    });

    it('should respect limit parameter', async () => {
      await accountService.buyStock('TestTrader', 'AAPL', 10, 'Buy 1');
      await accountService.buyStock('TestTrader', 'GOOGL', 5, 'Buy 2');
      await accountService.buyStock('TestTrader', 'MSFT', 5, 'Buy 3');

      const history = accountService.getTransactionHistory('TestTrader', 2);
      expect(history).toHaveLength(2);
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await accountService.initializeAccount('TestTrader', 10000, 'growth');
    });

    it('should log messages for trader', () => {
      accountService.log('TestTrader', 'INFO', 'Test message');

      const logs = db.getLogs('TestTrader');
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('INFO');
      expect(logs[0].message).toBe('Test message');
    });
  });
});
