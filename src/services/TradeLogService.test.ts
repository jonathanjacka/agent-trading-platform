import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TradeLogService, TradeLogData } from './TradeLogService.js';
import { DatabaseService } from './database/index.js';
import { MemoryService } from './memory/index.js';

// Mock MemoryService
vi.mock('./memory/index.js', () => ({
  MemoryService: {
    getInstance: vi.fn().mockReturnValue({
      generateMemoryFromTrade: vi.fn(),
    }),
  },
}));

describe('TradeLogService', () => {
  let tradeLogService: TradeLogService;
  let db: DatabaseService;

  beforeEach(() => {
    // Reset singletons
    // @ts-ignore
    DatabaseService.instance = undefined;

    db = DatabaseService.getInstance(':memory:');

    // Initialize test accounts
    db.createAccount('TestTrader', 10000, 'growth');
    db.createAccount('Leonardo', 10000, 'growth');
    db.createAccount('Michelangelo', 10000, 'value');

    tradeLogService = new TradeLogService(db);
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  describe('logTrade', () => {
    it('should log a successful buy trade', () => {
      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
        rationale: 'Value investment',
      };

      const logId = tradeLogService.logTrade(tradeData);

      expect(logId).toBeGreaterThan(0);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('BUY');
      expect(logs[0].symbol).toBe('AAPL');
      expect(logs[0].quantity).toBe(10);
      expect(logs[0].price).toBe(150);
      expect(logs[0].success).toBe(true);
    });

    it('should log a successful sell trade', () => {
      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'GOOGL',
        quantity: 5,
        price: 175.0,
        success: true,
        executionTimeMs: 85,
        rationale: 'Taking profits',
      };

      const logId = tradeLogService.logTrade(tradeData);

      expect(logId).toBeGreaterThan(0);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('SELL');
    });

    it('should log a failed trade', () => {
      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 100,
        success: false,
        errorMessage: 'Insufficient funds',
        executionTimeMs: 50,
      };

      const logId = tradeLogService.logTrade(tradeData);

      expect(logId).toBeGreaterThan(0);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error_message).toBe('Insufficient funds');
    });

    it('should log a HOLD action', () => {
      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'HOLD',
        success: true,
        executionTimeMs: 200,
        rationale: 'Market conditions unfavorable',
      };

      const logId = tradeLogService.logTrade(tradeData);

      expect(logId).toBeGreaterThan(0);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      expect(logs[0].action).toBe('HOLD');
      expect(logs[0].symbol).toBeNull();
    });

    it('should log an ERROR action', () => {
      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'ERROR',
        success: false,
        errorMessage: 'API unavailable',
        executionTimeMs: 30,
      };

      const logId = tradeLogService.logTrade(tradeData);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      expect(logs[0].action).toBe('ERROR');
    });

    it('should store market data snapshot as JSON', () => {
      const marketSnapshot = {
        price: 150.0,
        marketCap: 2500000000000,
        volume: 50000000,
      };

      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
        marketDataSnapshot: marketSnapshot,
      };

      tradeLogService.logTrade(tradeData);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      const storedSnapshot = JSON.parse(logs[0].market_data_snapshot!);
      expect(storedSnapshot.price).toBe(150.0);
      expect(storedSnapshot.marketCap).toBe(2500000000000);
    });

    it('should store portfolio before and after as JSON', () => {
      const portfolioBefore = { cash: 10000, totalValue: 10000 };
      const portfolioAfter = { cash: 8500, totalValue: 10000 };

      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
        portfolioBefore,
        portfolioAfter,
      };

      tradeLogService.logTrade(tradeData);

      const logs = tradeLogService.getTradeLogs('TestTrader');
      const before = JSON.parse(logs[0].portfolio_before!);
      const after = JSON.parse(logs[0].portfolio_after!);

      expect(before.cash).toBe(10000);
      expect(after.cash).toBe(8500);
    });

    it('should trigger memory generation for logged trade', () => {
      const memoryService = MemoryService.getInstance();

      const tradeData: TradeLogData = {
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
      };

      tradeLogService.logTrade(tradeData);

      expect(memoryService.generateMemoryFromTrade).toHaveBeenCalled();
    });
  });

  describe('getTradeLogs', () => {
    beforeEach(() => {
      // Add several trades
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'GOOGL',
        quantity: 5,
        price: 175.0,
        success: true,
        executionTimeMs: 90,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 5,
        price: 160.0,
        success: true,
        executionTimeMs: 80,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'MSFT',
        quantity: 20,
        success: false,
        errorMessage: 'Insufficient funds',
        executionTimeMs: 50,
      });
    });

    it('should return all logs for a trader', () => {
      const logs = tradeLogService.getTradeLogs('TestTrader');
      expect(logs).toHaveLength(4);
    });

    it('should respect limit option', () => {
      const logs = tradeLogService.getTradeLogs('TestTrader', { limit: 2 });
      expect(logs).toHaveLength(2);
    });

    it('should filter by symbol', () => {
      const logs = tradeLogService.getTradeLogs('TestTrader', {
        symbol: 'AAPL',
      });
      expect(logs).toHaveLength(2);
      expect(logs.every((l) => l.symbol === 'AAPL')).toBe(true);
    });

    it('should filter by success status', () => {
      const successLogs = tradeLogService.getTradeLogs('TestTrader', {
        success: true,
      });
      expect(successLogs).toHaveLength(3);

      const failedLogs = tradeLogService.getTradeLogs('TestTrader', {
        success: false,
      });
      expect(failedLogs).toHaveLength(1);
    });

    it('should return empty array for trader with no logs', () => {
      const logs = tradeLogService.getTradeLogs('NewTrader');
      expect(logs).toHaveLength(0);
    });
  });

  describe('getAllTradeLogs', () => {
    beforeEach(() => {
      tradeLogService.logTrade({
        traderName: 'Leonardo',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'Michelangelo',
        action: 'BUY',
        symbol: 'GOOGL',
        quantity: 5,
        price: 175.0,
        success: true,
        executionTimeMs: 90,
      });
    });

    it('should return logs from all traders', () => {
      const logs = tradeLogService.getAllTradeLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);

      const traderNames = [...new Set(logs.map((l) => l.trader_name))];
      expect(traderNames).toContain('Leonardo');
      expect(traderNames).toContain('Michelangelo');
    });

    it('should respect limit parameter', () => {
      const logs = tradeLogService.getAllTradeLogs(1);
      expect(logs).toHaveLength(1);
    });
  });

  describe('getAnalytics', () => {
    it('should return empty analytics for trader with no logs', () => {
      const analytics = tradeLogService.getAnalytics('TestTrader');

      expect(analytics.traderName).toBe('TestTrader');
      expect(analytics.totalTrades).toBe(0);
      expect(analytics.successfulTrades).toBe(0);
      expect(analytics.failedTrades).toBe(0);
      expect(analytics.winRate).toBe(0);
      expect(analytics.mostTradedSymbol).toBeNull();
    });

    it('should calculate basic trade counts', () => {
      // Add successful trades
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'GOOGL',
        quantity: 5,
        price: 175.0,
        success: true,
        executionTimeMs: 90,
      });

      // Add failed trade
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'MSFT',
        quantity: 20,
        success: false,
        errorMessage: 'Insufficient funds',
        executionTimeMs: 50,
      });

      const analytics = tradeLogService.getAnalytics('TestTrader');

      expect(analytics.totalTrades).toBe(3);
      expect(analytics.successfulTrades).toBe(2);
      expect(analytics.failedTrades).toBe(1);
      expect(analytics.winRate).toBeCloseTo(2 / 3, 5);
    });

    it('should calculate average execution time', () => {
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 5,
        price: 160.0,
        success: true,
        executionTimeMs: 200,
      });

      const analytics = tradeLogService.getAnalytics('TestTrader');

      expect(analytics.avgExecutionTimeMs).toBe(150);
    });

    it('should identify most traded symbol', () => {
      // AAPL traded 3 times
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150.0,
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 5,
        price: 160.0,
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 5,
        price: 155.0,
        success: true,
        executionTimeMs: 100,
      });

      // GOOGL traded 1 time
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'GOOGL',
        quantity: 5,
        price: 175.0,
        success: true,
        executionTimeMs: 100,
      });

      const analytics = tradeLogService.getAnalytics('TestTrader');

      expect(analytics.mostTradedSymbol).toBe('AAPL');
    });

    it('should calculate average trade size', () => {
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100.0, // $1000
        success: true,
        executionTimeMs: 100,
      });

      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'GOOGL',
        quantity: 20,
        price: 100.0, // $2000
        success: true,
        executionTimeMs: 100,
      });

      const analytics = tradeLogService.getAnalytics('TestTrader');

      expect(analytics.avgTradeSize).toBe(1500); // Average of 1000 and 2000
    });

    it('should calculate profit/loss from matched trades', () => {
      // Buy 10 @ $100 = $1000 cost
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100.0,
        success: true,
        executionTimeMs: 100,
      });

      // Sell 10 @ $120 = $1200 proceeds = $200 profit
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 120.0,
        success: true,
        executionTimeMs: 100,
      });

      const analytics = tradeLogService.getAnalytics('TestTrader');

      expect(analytics.totalProfitLoss).toBe(200);
      expect(analytics.bestTradeGain).toBe(200);
    });
  });

  describe('getAllAnalytics', () => {
    it('should return analytics for all predefined traders', () => {
      const allAnalytics = tradeLogService.getAllAnalytics();

      expect(allAnalytics).toHaveLength(4);

      const traderNames = allAnalytics.map((a) => a.traderName);
      expect(traderNames).toContain('Leonardo');
      expect(traderNames).toContain('Michelangelo');
      expect(traderNames).toContain('Raphael');
      expect(traderNames).toContain('Donatello');
    });
  });
});
