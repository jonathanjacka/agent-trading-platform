/**
 * Performance Analytics Service Tests
 * Comprehensive tests for analytics calculations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceAnalyticsService } from './PerformanceAnalyticsService.js';
import { TradeLogService } from '../TradeLogService.js';
import { DatabaseService } from '../database/index.js';
import { TIME_PERIOD } from './constants.js';

// Mock MemoryService (used by TradeLogService)
vi.mock('../memory/index.js', () => ({
  MemoryService: {
    getInstance: vi.fn().mockReturnValue({
      generateMemoryFromTrade: vi.fn(),
    }),
  },
}));

describe('PerformanceAnalyticsService', () => {
  let analyticsService: PerformanceAnalyticsService;
  let tradeLogService: TradeLogService;
  let db: DatabaseService;

  beforeEach(() => {
    // Reset singletons
    // @ts-ignore
    DatabaseService.instance = undefined;

    db = DatabaseService.getInstance(':memory:');
    db.createAccount('TestTrader', 10000, 'growth');

    tradeLogService = new TradeLogService(db);
    analyticsService = new PerformanceAnalyticsService(tradeLogService);
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════
  // EMPTY STATE TESTS
  // ═══════════════════════════════════════════════════════

  describe('empty state', () => {
    it('should return default values for trader with no trades', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.traderName).toBe('TestTrader');
      expect(summary.totalTrades).toBe(0);
      expect(summary.winningTrades).toBe(0);
      expect(summary.losingTrades).toBe(0);
      expect(summary.winRate).toBe(0);
      expect(summary.symbolStats).toHaveLength(0);
      expect(summary.recentTrades).toHaveLength(0);
    });

    it('should have zero drawdown with no trades', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.drawdown.maxDrawdown).toBe(0);
      expect(summary.drawdown.maxDrawdownPercent).toBe(0);
    });

    it('should return null sharpe ratio with insufficient data', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.sharpeRatio).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════
  // BASIC TRADE METRICS
  // ═══════════════════════════════════════════════════════

  describe('trade statistics', () => {
    beforeEach(() => {
      // Log some test trades
      // Buy AAPL at $100
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: JSON.stringify({
          cash: 10000,
          totalValue: 10000,
          totalHoldingsValue: 0,
          holdings: [],
        }),
        portfolioAfter: JSON.stringify({
          cash: 9000,
          totalValue: 10000,
          totalHoldingsValue: 1000,
          holdings: [
            {
              symbol: 'AAPL',
              quantity: 10,
              avgPrice: 100,
              currentPrice: 100,
              currentValue: 1000,
              gain: 0,
              gainPercent: 0,
            },
          ],
        }),
      });

      // Sell AAPL at $120 (winning trade)
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 5,
        price: 120,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: JSON.stringify({
          cash: 9000,
          totalValue: 10200,
          totalHoldingsValue: 1200,
          holdings: [
            {
              symbol: 'AAPL',
              quantity: 10,
              avgPrice: 100,
              currentPrice: 120,
              currentValue: 1200,
              gain: 200,
              gainPercent: 20,
            },
          ],
        }),
        portfolioAfter: JSON.stringify({
          cash: 9600,
          totalValue: 10200,
          totalHoldingsValue: 600,
          holdings: [
            {
              symbol: 'AAPL',
              quantity: 5,
              avgPrice: 100,
              currentPrice: 120,
              currentValue: 600,
              gain: 100,
              gainPercent: 20,
            },
          ],
        }),
      });
    });

    it('should count total trades correctly', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.totalTrades).toBe(2);
    });

    it('should calculate winning trade correctly', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      // Sold 5 shares at $120 that cost $100 = $100 profit
      expect(summary.winningTrades).toBe(1);
      expect(summary.avgWin).toBe(100); // 5 * ($120 - $100)
    });

    it('should include trades in recent activity', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.recentTrades).toHaveLength(2);
      expect(summary.recentTrades[0].action).toBe('SELL');
      expect(summary.recentTrades[0].symbol).toBe('AAPL');
    });
  });

  // ═══════════════════════════════════════════════════════
  // WIN RATE CALCULATION
  // ═══════════════════════════════════════════════════════

  describe('win rate', () => {
    it('should calculate 100% win rate for all profitable sells', () => {
      // Buy
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });

      // Sell at profit
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        success: true,
        executionTimeMs: 50,
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.winRate).toBe(1); // 100%
      expect(summary.winningTrades).toBe(1);
      expect(summary.losingTrades).toBe(0);
    });

    it('should calculate 0% win rate for all losing sells', () => {
      // Buy
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });

      // Sell at loss
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 80,
        success: true,
        executionTimeMs: 50,
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.winRate).toBe(0);
      expect(summary.winningTrades).toBe(0);
      expect(summary.losingTrades).toBe(1);
    });

    it('should calculate 50% win rate correctly', () => {
      // Buy AAPL
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });

      // Sell AAPL at profit
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 120,
        success: true,
        executionTimeMs: 50,
      });

      // Buy MSFT
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'MSFT',
        quantity: 10,
        price: 200,
        success: true,
        executionTimeMs: 50,
      });

      // Sell MSFT at loss
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'MSFT',
        quantity: 10,
        price: 180,
        success: true,
        executionTimeMs: 50,
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.winRate).toBe(0.5);
      expect(summary.winningTrades).toBe(1);
      expect(summary.losingTrades).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PROFIT FACTOR
  // ═══════════════════════════════════════════════════════

  describe('profit factor', () => {
    it('should calculate profit factor correctly', () => {
      // Buy and sell AAPL for $200 profit
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 120, // $200 profit
        success: true,
        executionTimeMs: 50,
      });

      // Buy and sell MSFT for $100 loss
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'MSFT',
        quantity: 10,
        price: 200,
        success: true,
        executionTimeMs: 50,
      });
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'MSFT',
        quantity: 10,
        price: 190, // $100 loss
        success: true,
        executionTimeMs: 50,
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      // Profit factor = gross profit / gross loss = 200 / 100 = 2
      expect(summary.profitFactor).toBe(2);
    });

    it('should return Infinity for profit factor with no losses', () => {
      // Only winning trade
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        success: true,
        executionTimeMs: 50,
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.profitFactor).toBe(Infinity);
    });
  });

  // ═══════════════════════════════════════════════════════
  // SYMBOL STATISTICS
  // ═══════════════════════════════════════════════════════

  describe('symbol statistics', () => {
    beforeEach(() => {
      // Trade AAPL (profitable)
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        success: true,
        executionTimeMs: 50,
      });

      // Trade MSFT (loss)
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'MSFT',
        quantity: 5,
        price: 200,
        success: true,
        executionTimeMs: 50,
      });
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'MSFT',
        quantity: 5,
        price: 180,
        success: true,
        executionTimeMs: 50,
      });
    });

    it('should calculate per-symbol stats', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.symbolStats).toHaveLength(2);

      const aaplStats = summary.symbolStats.find(
        (s: { symbol: string }) => s.symbol === 'AAPL'
      );
      const msftStats = summary.symbolStats.find(
        (s: { symbol: string }) => s.symbol === 'MSFT'
      );

      expect(aaplStats).toBeDefined();
      expect(aaplStats!.realizedPnL).toBe(500); // 10 * ($150 - $100)
      expect(aaplStats!.winRate).toBe(1);

      expect(msftStats).toBeDefined();
      expect(msftStats!.realizedPnL).toBe(-100); // 5 * ($180 - $200)
      expect(msftStats!.winRate).toBe(0);
    });

    it('should identify top winners correctly', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.topWinners).toHaveLength(1);
      expect(summary.topWinners[0].symbol).toBe('AAPL');
      expect(summary.topWinners[0].realizedPnL).toBe(500);
    });

    it('should identify top losers correctly', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.topLosers).toHaveLength(1);
      expect(summary.topLosers[0].symbol).toBe('MSFT');
      expect(summary.topLosers[0].realizedPnL).toBe(-100);
    });
  });

  // ═══════════════════════════════════════════════════════
  // DRAWDOWN CALCULATION
  // ═══════════════════════════════════════════════════════

  describe('drawdown', () => {
    it('should calculate max drawdown from equity curve', () => {
      // Create trades with portfolio snapshots showing drawdown
      // Start at $10,000
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: {
          cash: 10000,
          totalValue: 10000,
          totalHoldingsValue: 0,
          holdings: [],
        },
        portfolioAfter: {
          cash: 9000,
          totalValue: 10000,
          totalHoldingsValue: 1000,
          holdings: [],
        },
      });

      // Value goes up to $10,500
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'MSFT',
        quantity: 5,
        price: 100,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: {
          cash: 9000,
          totalValue: 10500,
          totalHoldingsValue: 1500,
          holdings: [],
        },
        portfolioAfter: {
          cash: 8500,
          totalValue: 10500,
          totalHoldingsValue: 2000,
          holdings: [],
        },
      });

      // Value drops to $9,500 (drawdown from peak of $10,500)
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 5,
        price: 80,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: {
          cash: 8500,
          totalValue: 9800,
          totalHoldingsValue: 1300,
          holdings: [],
        },
        portfolioAfter: {
          cash: 8900,
          totalValue: 9500,
          totalHoldingsValue: 600,
          holdings: [],
        },
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      // Max drawdown = $10,500 - $9,500 = $1,000
      expect(summary.drawdown.maxDrawdown).toBe(1000);
      expect(summary.drawdown.peakValue).toBe(10500);
      expect(summary.drawdown.troughValue).toBe(9500);
    });
  });

  // ═══════════════════════════════════════════════════════
  // TIME PERIOD FILTERING
  // ═══════════════════════════════════════════════════════

  describe('time period filtering', () => {
    it('should filter by all_time period', () => {
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader', {
        period: TIME_PERIOD.ALL_TIME,
      });

      expect(summary.period).toBe('all_time');
      expect(summary.periodStart).toBeNull();
      expect(summary.totalTrades).toBe(1);
    });

    it('should accept custom date range', () => {
      const startDate = new Date('2025-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      const summary = analyticsService.getPerformanceSummary('TestTrader', {
        startDate,
        endDate,
      });

      expect(summary.periodStart).toBe(startDate);
      expect(summary.periodEnd).toBe(endDate);
    });
  });

  // ═══════════════════════════════════════════════════════
  // RECENT TRADES LIMIT
  // ═══════════════════════════════════════════════════════

  describe('recent trades limit', () => {
    beforeEach(() => {
      // Create 15 trades
      for (let i = 0; i < 15; i++) {
        tradeLogService.logTrade({
          traderName: 'TestTrader',
          action: 'BUY',
          symbol: `SYM${i}`,
          quantity: 1,
          price: 100,
          success: true,
          executionTimeMs: 50,
        });
      }
    });

    it('should respect default limit of 10 recent trades', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.recentTrades).toHaveLength(10);
    });

    it('should respect custom recent trades limit', () => {
      const summary = analyticsService.getPerformanceSummary('TestTrader', {
        recentTradesLimit: 5,
      });

      expect(summary.recentTrades).toHaveLength(5);
    });
  });

  // ═══════════════════════════════════════════════════════
  // RETURN CALCULATIONS
  // ═══════════════════════════════════════════════════════

  describe('return calculations', () => {
    it('should calculate total return from portfolio snapshots', () => {
      // Initial portfolio value: $10,000
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 100,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: {
          cash: 10000,
          totalValue: 10000,
          totalHoldingsValue: 0,
          holdings: [],
        },
        portfolioAfter: {
          cash: 9000,
          totalValue: 10000,
          totalHoldingsValue: 1000,
          holdings: [],
        },
      });

      // Final portfolio value: $11,000
      tradeLogService.logTrade({
        traderName: 'TestTrader',
        action: 'SELL',
        symbol: 'AAPL',
        quantity: 10,
        price: 200,
        success: true,
        executionTimeMs: 50,
        portfolioBefore: {
          cash: 9000,
          totalValue: 11000,
          totalHoldingsValue: 2000,
          holdings: [],
        },
        portfolioAfter: {
          cash: 11000,
          totalValue: 11000,
          totalHoldingsValue: 0,
          holdings: [],
        },
      });

      const summary = analyticsService.getPerformanceSummary('TestTrader');

      expect(summary.initialValue).toBe(10000);
      expect(summary.currentValue).toBe(11000);
      expect(summary.totalReturn).toBe(1000);
      expect(summary.totalReturnPercent).toBe(10);
    });
  });
});
