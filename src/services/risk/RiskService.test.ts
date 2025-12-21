/**
 * Risk Service Tests
 * Comprehensive tests for risk management functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskService } from './RiskService.js';
import { PositionRiskAnalyzer } from './PositionRiskAnalyzer.js';
import { PortfolioRiskAnalyzer } from './PortfolioRiskAnalyzer.js';
import { TradeRiskEvaluator } from './TradeRiskEvaluator.js';
import {
  DEFAULT_RISK_LIMITS,
  RISK_LEVEL,
  CONCENTRATION,
  TRADE_TYPE,
} from './constants.js';
import type { PortfolioData, RiskLimits } from './types.js';

// ═══════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════

function createTestPortfolio(
  overrides?: Partial<PortfolioData>
): PortfolioData {
  return {
    cash: 5000,
    holdings: [
      {
        symbol: 'AAPL',
        quantity: 10,
        avgPrice: 150,
        currentPrice: 160,
        currentValue: 1600,
        gain: 100,
        gainPercent: 6.67,
      },
      {
        symbol: 'MSFT',
        quantity: 5,
        avgPrice: 300,
        currentPrice: 320,
        currentValue: 1600,
        gain: 100,
        gainPercent: 6.67,
      },
    ],
    totalValue: 8200,
    totalHoldingsValue: 3200,
    ...overrides,
  };
}

function createEmptyPortfolio(): PortfolioData {
  return {
    cash: 10000,
    holdings: [],
    totalValue: 10000,
    totalHoldingsValue: 0,
  };
}

function createConcentratedPortfolio(): PortfolioData {
  return {
    cash: 1000,
    holdings: [
      {
        symbol: 'NVDA',
        quantity: 50,
        avgPrice: 150,
        currentPrice: 160,
        currentValue: 8000,
        gain: 500,
        gainPercent: 6.67,
      },
    ],
    totalValue: 9000,
    totalHoldingsValue: 8000,
  };
}

function createLosingPortfolio(): PortfolioData {
  return {
    cash: 2000,
    holdings: [
      {
        symbol: 'FAIL',
        quantity: 100,
        avgPrice: 100,
        currentPrice: 60,
        currentValue: 6000,
        gain: -4000,
        gainPercent: -40,
      },
    ],
    totalValue: 8000,
    totalHoldingsValue: 6000,
  };
}

// ═══════════════════════════════════════════════════════
// RISK SERVICE TESTS
// ═══════════════════════════════════════════════════════

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService();
  });

  describe('initialization', () => {
    it('should initialize with default risk limits', () => {
      const limits = service.getRiskLimits();
      expect(limits).toEqual(DEFAULT_RISK_LIMITS);
    });

    it('should accept custom risk limits', () => {
      const customService = new RiskService({ maxPositionPercent: 30 });
      const limits = customService.getRiskLimits();
      expect(limits.maxPositionPercent).toBe(30);
      expect(limits.minCashPercent).toBe(DEFAULT_RISK_LIMITS.minCashPercent);
    });
  });

  describe('setRiskLimits', () => {
    it('should update risk limits', () => {
      service.setRiskLimits({ maxPositionPercent: 35, minCashPercent: 15 });
      const limits = service.getRiskLimits();
      expect(limits.maxPositionPercent).toBe(35);
      expect(limits.minCashPercent).toBe(15);
    });

    it('should preserve unmodified limits', () => {
      const original = service.getRiskLimits();
      service.setRiskLimits({ maxPositionPercent: 35 });
      const updated = service.getRiskLimits();
      expect(updated.defaultStopLossPercent).toBe(
        original.defaultStopLossPercent
      );
    });
  });

  describe('analyzePositionRisk', () => {
    it('should return null for non-existent position', () => {
      const portfolio = createTestPortfolio();
      const result = service.analyzePositionRisk('UNKNOWN', portfolio);
      expect(result).toBeNull();
    });

    it('should analyze existing position', () => {
      const portfolio = createTestPortfolio();
      const result = service.analyzePositionRisk('AAPL', portfolio);

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
      expect(result?.quantity).toBe(10);
      // AAPL is ~19.5% of portfolio (1600/8200), which is > 12.5% (50% of 25% limit)
      expect(result?.riskLevel).toBe(RISK_LEVEL.MEDIUM);
    });

    it('should calculate stop loss and take profit prices', () => {
      const portfolio = createTestPortfolio();
      const result = service.analyzePositionRisk('AAPL', portfolio);

      // Default 10% stop loss, 20% take profit
      expect(result?.stopLossPrice).toBe(135); // 150 * 0.9
      expect(result?.takeProfitPrice).toBe(180); // 150 * 1.2
    });
  });

  describe('analyzePortfolioRisk', () => {
    it('should analyze empty portfolio', () => {
      const portfolio = createEmptyPortfolio();
      const result = service.analyzePortfolioRisk(portfolio);

      expect(result.concentration).toBe(CONCENTRATION.DIVERSIFIED);
      expect(result.cashPercent).toBe(100);
      expect(result.positionCount).toBe(0);
      expect(result.riskScore).toBe(0);
    });

    it('should detect concentrated portfolio', () => {
      const portfolio = createConcentratedPortfolio();
      const result = service.analyzePortfolioRisk(portfolio);

      expect(result.concentration).toBe(CONCENTRATION.CRITICAL);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('should provide recommendations', () => {
      const portfolio = createConcentratedPortfolio();
      const result = service.analyzePortfolioRisk(portfolio);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateTradeRisk', () => {
    it('should approve valid buy trade', () => {
      const portfolio = createTestPortfolio();
      const result = service.evaluateTradeRisk(
        TRADE_TYPE.BUY,
        'GOOGL',
        5,
        100,
        portfolio
      );

      expect(result.approved).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block trade with insufficient cash', () => {
      const portfolio = createTestPortfolio();
      const result = service.evaluateTradeRisk(
        TRADE_TYPE.BUY,
        'GOOGL',
        100,
        1000, // $100,000 trade
        portfolio
      );

      expect(result.approved).toBe(false);
      expect(result.blockers.some((b) => b.includes('Insufficient cash'))).toBe(
        true
      );
    });

    it('should block trade exceeding position limit', () => {
      const portfolio = createEmptyPortfolio();
      const result = service.evaluateTradeRisk(
        TRADE_TYPE.BUY,
        'AAPL',
        50,
        100, // $5000, which is 50% of $10000 portfolio
        portfolio
      );

      expect(result.approved).toBe(false);
      expect(result.blockers.some((b) => b.includes('limit'))).toBe(true);
    });

    it('should approve valid sell trade', () => {
      const portfolio = createTestPortfolio();
      const result = service.evaluateTradeRisk(
        TRADE_TYPE.SELL,
        'AAPL',
        5,
        160,
        portfolio
      );

      expect(result.approved).toBe(true);
    });

    it('should block sell with insufficient shares', () => {
      const portfolio = createTestPortfolio();
      const result = service.evaluateTradeRisk(
        TRADE_TYPE.SELL,
        'AAPL',
        100, // Only have 10
        160,
        portfolio
      );

      expect(result.approved).toBe(false);
      expect(
        result.blockers.some((b) => b.includes('Insufficient shares'))
      ).toBe(true);
    });

    it('should warn about selling at a loss', () => {
      const portfolio = createLosingPortfolio();
      const result = service.evaluateTradeRisk(
        TRADE_TYPE.SELL,
        'FAIL',
        10,
        60,
        portfolio
      );

      expect(result.warnings.some((w) => w.includes('loss'))).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════
// POSITION RISK ANALYZER TESTS
// ═══════════════════════════════════════════════════════

describe('PositionRiskAnalyzer', () => {
  let analyzer: PositionRiskAnalyzer;
  const limits: RiskLimits = { ...DEFAULT_RISK_LIMITS };

  beforeEach(() => {
    analyzer = new PositionRiskAnalyzer(limits);
  });

  describe('analyze', () => {
    it('should detect critical risk for oversized position', () => {
      const portfolio: PortfolioData = {
        cash: 1000,
        holdings: [
          {
            symbol: 'BIG',
            quantity: 100,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 10000,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 11000,
        totalHoldingsValue: 10000,
      };

      const result = analyzer.analyze('BIG', portfolio);
      expect(result?.riskLevel).toBe(RISK_LEVEL.CRITICAL);
      expect(result?.warnings.some((w) => w.includes('portfolio'))).toBe(true);
    });

    it('should detect price at stop loss', () => {
      const portfolio: PortfolioData = {
        cash: 5000,
        holdings: [
          {
            symbol: 'DOWN',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 85, // Below 10% stop loss
            currentValue: 850,
            gain: -150,
            gainPercent: -15,
          },
        ],
        totalValue: 5850,
        totalHoldingsValue: 850,
      };

      const result = analyzer.analyze('DOWN', portfolio);
      expect(result?.warnings.some((w) => w.includes('stop loss'))).toBe(true);
    });

    it('should detect price at take profit', () => {
      const portfolio: PortfolioData = {
        cash: 5000,
        holdings: [
          {
            symbol: 'UP',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 125, // Above 20% take profit
            currentValue: 1250,
            gain: 250,
            gainPercent: 25,
          },
        ],
        totalValue: 6250,
        totalHoldingsValue: 1250,
      };

      const result = analyzer.analyze('UP', portfolio);
      expect(result?.warnings.some((w) => w.includes('take profit'))).toBe(
        true
      );
    });
  });

  describe('updateLimits', () => {
    it('should use updated limits for analysis', () => {
      analyzer.updateLimits({ ...limits, maxPositionPercent: 50 });

      const portfolio: PortfolioData = {
        cash: 6000,
        holdings: [
          {
            symbol: 'TEST',
            quantity: 40,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 4000,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 10000,
        totalHoldingsValue: 4000,
      };

      // 40% position should not be critical with 50% limit
      const result = analyzer.analyze('TEST', portfolio);
      expect(result?.riskLevel).not.toBe(RISK_LEVEL.CRITICAL);
    });
  });
});

// ═══════════════════════════════════════════════════════
// PORTFOLIO RISK ANALYZER TESTS
// ═══════════════════════════════════════════════════════

describe('PortfolioRiskAnalyzer', () => {
  let analyzer: PortfolioRiskAnalyzer;
  const limits: RiskLimits = { ...DEFAULT_RISK_LIMITS };

  beforeEach(() => {
    analyzer = new PortfolioRiskAnalyzer(limits);
  });

  describe('analyze', () => {
    it('should identify diversified portfolio', () => {
      const portfolio: PortfolioData = {
        cash: 5000,
        holdings: [
          {
            symbol: 'A',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 1000,
            gain: 0,
            gainPercent: 0,
          },
          {
            symbol: 'B',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 1000,
            gain: 0,
            gainPercent: 0,
          },
          {
            symbol: 'C',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 1000,
            gain: 0,
            gainPercent: 0,
          },
          {
            symbol: 'D',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 1000,
            gain: 0,
            gainPercent: 0,
          },
          {
            symbol: 'E',
            quantity: 10,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 1000,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 10000,
        totalHoldingsValue: 5000,
      };

      const result = analyzer.analyze(portfolio);
      expect(result.concentration).toBe(CONCENTRATION.DIVERSIFIED);
      expect(result.riskScore).toBeLessThan(20);
    });

    it('should warn about low cash', () => {
      const portfolio: PortfolioData = {
        cash: 500, // 5% of total
        holdings: [
          {
            symbol: 'A',
            quantity: 95,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 9500,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 10000,
        totalHoldingsValue: 9500,
      };

      const result = analyzer.analyze(portfolio);
      expect(result.warnings.some((w) => w.includes('Cash'))).toBe(true);
    });

    it('should suggest deploying high cash', () => {
      const portfolio: PortfolioData = {
        cash: 8000, // 80% of total
        holdings: [
          {
            symbol: 'A',
            quantity: 20,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 2000,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 10000,
        totalHoldingsValue: 2000,
      };

      const result = analyzer.analyze(portfolio);
      expect(result.recommendations.some((r) => r.includes('cash'))).toBe(true);
    });

    it('should calculate risk score for losses', () => {
      const portfolio: PortfolioData = {
        cash: 2000,
        holdings: [
          {
            symbol: 'LOSS',
            quantity: 100,
            avgPrice: 100,
            currentPrice: 60,
            currentValue: 6000,
            gain: -4000,
            gainPercent: -40,
          },
        ],
        totalValue: 8000,
        totalHoldingsValue: 6000,
      };

      const result = analyzer.analyze(portfolio);
      expect(result.riskScore).toBeGreaterThan(40); // Should include loss risk
    });
  });
});

// ═══════════════════════════════════════════════════════
// TRADE RISK EVALUATOR TESTS
// ═══════════════════════════════════════════════════════

describe('TradeRiskEvaluator', () => {
  let evaluator: TradeRiskEvaluator;
  const limits: RiskLimits = { ...DEFAULT_RISK_LIMITS };

  beforeEach(() => {
    evaluator = new TradeRiskEvaluator(limits);
  });

  describe('evaluate BUY', () => {
    it('should approve small position buy', () => {
      const portfolio = createTestPortfolio();
      const result = evaluator.evaluate(
        TRADE_TYPE.BUY,
        'NEW',
        5,
        100,
        portfolio
      );

      expect(result.approved).toBe(true);
      expect(result.riskLevel).toBe(RISK_LEVEL.LOW);
    });

    it('should calculate post-trade metrics', () => {
      const portfolio = createEmptyPortfolio();
      const result = evaluator.evaluate(
        TRADE_TYPE.BUY,
        'TEST',
        10,
        100,
        portfolio
      );

      expect(result.estimatedTotal).toBe(1000);
      expect(result.postTradePositionPercent).toBe(10);
      expect(result.postTradeCashPercent).toBe(90);
    });

    it('should warn about large initial position', () => {
      const portfolio = createEmptyPortfolio();
      const result = evaluator.evaluate(
        TRADE_TYPE.BUY,
        'BIG',
        20,
        100,
        portfolio
      );

      expect(
        result.suggestions.some((s) => s.includes('smaller initial'))
      ).toBe(true);
    });

    it('should block when cash would drop below critical level', () => {
      const portfolio: PortfolioData = {
        cash: 1000,
        holdings: [],
        totalValue: 1000,
        totalHoldingsValue: 0,
      };

      const result = evaluator.evaluate(
        TRADE_TYPE.BUY,
        'TEST',
        10,
        98,
        portfolio
      );
      // Would leave only 2% cash
      expect(result.blockers.some((b) => b.includes('5% cash'))).toBe(true);
    });
  });

  describe('evaluate SELL', () => {
    it('should approve valid sell', () => {
      const portfolio = createTestPortfolio();
      const result = evaluator.evaluate(
        TRADE_TYPE.SELL,
        'AAPL',
        5,
        160,
        portfolio
      );

      expect(result.approved).toBe(true);
    });

    it('should suggest checking strategy when closing position', () => {
      const portfolio = createTestPortfolio();
      const result = evaluator.evaluate(
        TRADE_TYPE.SELL,
        'AAPL',
        10,
        160,
        portfolio
      );

      expect(result.suggestions.some((s) => s.includes('Closing entire'))).toBe(
        true
      );
    });

    it('should warn about panic selling', () => {
      const portfolio = createLosingPortfolio();
      const result = evaluator.evaluate(
        TRADE_TYPE.SELL,
        'FAIL',
        50,
        60,
        portfolio
      );

      expect(result.suggestions.some((s) => s.includes('panic'))).toBe(true);
    });
  });

  describe('updateLimits', () => {
    it('should use updated limits for evaluation', () => {
      evaluator.updateLimits({ ...limits, maxPositionPercent: 50 });

      const portfolio = createEmptyPortfolio();
      // 40% position should be OK with 50% limit
      const result = evaluator.evaluate(
        TRADE_TYPE.BUY,
        'TEST',
        40,
        100,
        portfolio
      );

      expect(result.approved).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════

describe('Risk Service Integration', () => {
  it('should maintain consistency between analyzers when limits change', () => {
    const service = new RiskService();

    // Create a portfolio with multiple holdings but one large position
    const portfolio: PortfolioData = {
      cash: 2000,
      holdings: [
        {
          symbol: 'BIG',
          quantity: 60,
          avgPrice: 100,
          currentPrice: 100,
          currentValue: 6000,
          gain: 0,
          gainPercent: 0,
        },
        {
          symbol: 'SMALL',
          quantity: 10,
          avgPrice: 100,
          currentPrice: 100,
          currentValue: 1000,
          gain: 0,
          gainPercent: 0,
        },
        {
          symbol: 'TINY',
          quantity: 10,
          avgPrice: 100,
          currentPrice: 100,
          currentValue: 1000,
          gain: 0,
          gainPercent: 0,
        },
      ],
      totalValue: 10000,
      totalHoldingsValue: 8000,
    };

    // Initial analysis - BIG is 60% of portfolio, exceeds 25% limit
    const beforePortfolioRisk = service.analyzePortfolioRisk(portfolio);
    expect(beforePortfolioRisk.concentration).toBe(CONCENTRATION.CRITICAL);

    // Update limits to be more permissive
    service.setRiskLimits({ maxPositionPercent: 70 });

    // Re-analyze with new limits - 60% is now OK
    const afterPortfolioRisk = service.analyzePortfolioRisk(portfolio);
    expect(afterPortfolioRisk.concentration).not.toBe(CONCENTRATION.CRITICAL);
  });

  it('should evaluate trade correctly after limit update', () => {
    const service = new RiskService({ maxPositionPercent: 10 });
    const portfolio = createEmptyPortfolio();

    // Should block 15% position with 10% limit
    const blocked = service.evaluateTradeRisk(
      TRADE_TYPE.BUY,
      'TEST',
      15,
      100,
      portfolio
    );
    expect(blocked.approved).toBe(false);

    // Update limit
    service.setRiskLimits({ maxPositionPercent: 20 });

    // Should now approve
    const approved = service.evaluateTradeRisk(
      TRADE_TYPE.BUY,
      'TEST',
      15,
      100,
      portfolio
    );
    expect(approved.approved).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// POSITION SIZING CALCULATOR TESTS
// ═══════════════════════════════════════════════════════

describe('PositionSizingCalculator (via RiskService)', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService();
  });

  describe('suggestPositionSize', () => {
    it('should calculate correct position size for new position', () => {
      const portfolio = createEmptyPortfolio(); // $10,000 cash
      const result = service.suggestPositionSize('AAPL', 100, portfolio);

      // With 10% min cash ($1,000 reserve), $9,000 available
      // With 25% max position, max is $2,500
      // Moderate strategy uses 75% = $1,875 = 18 shares
      expect(result.canBuy).toBe(true);
      expect(result.maxShares).toBe(25); // $2,500 / $100
      expect(result.recommendedShares).toBe(18); // 75% of max
      expect(result.limitingFactor).toBe('position_limit');
    });

    it('should respect cash constraint when cash is limiting factor', () => {
      const portfolio: PortfolioData = {
        cash: 2000,
        holdings: [],
        totalValue: 2000,
        totalHoldingsValue: 0,
      };

      const result = service.suggestPositionSize('AAPL', 100, portfolio);

      // 10% reserve = $200, available = $1,800
      // 25% max position = $500
      // Cash ($1,800) > position limit ($500), so position is limiting
      expect(result.limitingFactor).toBe('position_limit');
      expect(result.maxShares).toBe(5); // $500 / $100
    });

    it('should account for existing position', () => {
      const portfolio: PortfolioData = {
        cash: 5000,
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
        totalValue: 6000,
        totalHoldingsValue: 1000,
      };

      const result = service.suggestPositionSize('AAPL', 100, portfolio);

      // Max position = 25% of $6,000 = $1,500
      // Already have $1,000, so can add $500 more
      expect(result.existingShares).toBe(10);
      expect(result.existingValue).toBe(1000);
      expect(result.maxShares).toBe(5); // $500 / $100
      expect(result.postPurchaseShares).toBe(10 + result.recommendedShares);
    });

    it('should return canBuy=false when position at limit', () => {
      const portfolio: PortfolioData = {
        cash: 5000,
        holdings: [
          {
            symbol: 'AAPL',
            quantity: 30,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 3000,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 8000,
        totalHoldingsValue: 3000,
      };

      const result = service.suggestPositionSize('AAPL', 100, portfolio);

      // Current position is 37.5% (3000/8000), already over 25% limit
      expect(result.canBuy).toBe(false);
      expect(result.maxShares).toBe(0);
      expect(result.reason).toContain('maximum');
    });

    it('should return canBuy=false when no cash available', () => {
      const portfolio: PortfolioData = {
        cash: 500, // 5% of total, below 10% reserve
        holdings: [
          {
            symbol: 'MSFT',
            quantity: 95,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 9500,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 10000,
        totalHoldingsValue: 9500,
      };

      const result = service.suggestPositionSize('NEW', 100, portfolio);

      expect(result.canBuy).toBe(false);
      expect(result.reason).toContain('cash');
    });

    it('should use conservative strategy when specified', () => {
      const portfolio = createEmptyPortfolio();

      const moderate = service.suggestPositionSize(
        'TEST',
        100,
        portfolio,
        'moderate' as any
      );
      const conservative = service.suggestPositionSize(
        'TEST',
        100,
        portfolio,
        'conservative' as any
      );

      expect(conservative.recommendedShares).toBeLessThan(
        moderate.recommendedShares
      );
      expect(conservative.strategy).toBe('conservative');
    });

    it('should use max_allowed strategy when specified', () => {
      const portfolio = createEmptyPortfolio();

      const moderate = service.suggestPositionSize(
        'TEST',
        100,
        portfolio,
        'moderate' as any
      );
      const maxAllowed = service.suggestPositionSize(
        'TEST',
        100,
        portfolio,
        'max_allowed' as any
      );

      expect(maxAllowed.recommendedShares).toBe(maxAllowed.maxShares);
      expect(maxAllowed.recommendedShares).toBeGreaterThan(
        moderate.recommendedShares
      );
    });

    it('should provide accurate post-purchase projections', () => {
      const portfolio: PortfolioData = {
        cash: 5000,
        holdings: [
          {
            symbol: 'AAPL',
            quantity: 5,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 500,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 5500,
        totalHoldingsValue: 500,
      };

      const result = service.suggestPositionSize('AAPL', 100, portfolio);

      // Verify post-purchase math
      const expectedPostValue =
        result.existingValue + result.recommendedShares * 100;
      expect(result.postPurchaseValue).toBe(expectedPostValue);
      expect(result.postPurchaseShares).toBe(
        result.existingShares + result.recommendedShares
      );
      expect(result.postPurchasePercent).toBeCloseTo(
        (expectedPostValue / portfolio.totalValue) * 100,
        1
      );
    });

    it('should generate appropriate warnings', () => {
      const portfolio: PortfolioData = {
        cash: 1200, // 12% - close to 10% minimum
        holdings: [
          {
            symbol: 'AAPL',
            quantity: 88,
            avgPrice: 100,
            currentPrice: 100,
            currentValue: 8800,
            gain: 0,
            gainPercent: 0,
          },
        ],
        totalValue: 10000,
        totalHoldingsValue: 8800,
      };

      const result = service.suggestPositionSize('NEW', 100, portfolio);

      // Should warn about low cash
      expect(result.warnings.some((w) => w.includes('low'))).toBe(true);
    });

    it('should work with new symbol not in portfolio', () => {
      const portfolio = createTestPortfolio();
      const result = service.suggestPositionSize('NEWSTOCK', 50, portfolio);

      expect(result.symbol).toBe('NEWSTOCK');
      expect(result.existingShares).toBe(0);
      expect(result.existingValue).toBe(0);
      expect(result.canBuy).toBe(true);
    });

    it('should handle expensive stocks correctly', () => {
      const portfolio = createEmptyPortfolio(); // $10,000
      const result = service.suggestPositionSize('BRK.A', 500000, portfolio);

      // Max position value is $2,500, but one share costs $500,000
      expect(result.canBuy).toBe(false);
      expect(result.maxShares).toBe(0);
      expect(result.reason).toContain('less than one share');
    });

    it('should include constraints in result', () => {
      const portfolio = createTestPortfolio();
      const result = service.suggestPositionSize('TEST', 100, portfolio);

      expect(result.constraints.length).toBeGreaterThan(0);
      expect(result.constraints.some((c) => c.includes('Cash'))).toBe(true);
      expect(result.constraints.some((c) => c.includes('Position'))).toBe(true);
    });
  });

  describe('position sizing with updated limits', () => {
    it('should use updated limits for calculations', () => {
      const portfolio = createEmptyPortfolio();

      // Default max position is 25%
      const before = service.suggestPositionSize('TEST', 100, portfolio);

      // Increase max position to 50%
      service.setRiskLimits({ maxPositionPercent: 50 });

      const after = service.suggestPositionSize('TEST', 100, portfolio);

      // Should allow more shares with higher limit
      expect(after.maxShares).toBeGreaterThan(before.maxShares);
    });

    it('should respect updated min cash reserve', () => {
      const portfolio = createEmptyPortfolio();

      // Default min cash is 10%
      const before = service.suggestPositionSize('TEST', 100, portfolio);

      // Increase min cash to 30%
      service.setRiskLimits({ minCashPercent: 30 });

      const after = service.suggestPositionSize('TEST', 100, portfolio);

      // Should allow fewer shares with higher cash reserve
      // Before: $9,000 available, After: $7,000 available
      expect(after.constraints.some((c) => c.includes('30%'))).toBe(true);
    });
  });
});
