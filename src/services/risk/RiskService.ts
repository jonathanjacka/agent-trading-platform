/**
 * Risk Management Service
 *
 * Main orchestrator that provides risk analysis for trading agents.
 * This is the public API - all sub-analyzers are implementation details.
 *
 * Key capabilities:
 * 1. Position Risk Analysis - Individual position risk assessment
 * 2. Portfolio Risk Analysis - Overall portfolio risk and concentration
 * 3. Trade Risk Evaluation - Pre-trade risk checks with approval/blockers
 * 4. Risk Limits Management - Configurable risk parameters
 */

import { Logger } from '../../utils/logger.js';

// Sub-services
import { PositionRiskAnalyzer } from './PositionRiskAnalyzer.js';
import { PortfolioRiskAnalyzer } from './PortfolioRiskAnalyzer.js';
import { TradeRiskEvaluator } from './TradeRiskEvaluator.js';
import {
  PositionSizingCalculator,
  type SizingStrategyValue,
  SIZING_STRATEGY,
} from './PositionSizingCalculator.js';

// Constants
import { DEFAULT_RISK_LIMITS } from './constants.js';

// Types
import type {
  RiskLimits,
  PortfolioData,
  PositionRisk,
  PortfolioRisk,
  TradeRiskEvaluation,
  TradeTypeValue,
  PositionSizeRecommendation,
} from './types.js';

export class RiskService {
  // Sub-analyzers
  private readonly positionAnalyzer: PositionRiskAnalyzer;
  private readonly portfolioAnalyzer: PortfolioRiskAnalyzer;
  private readonly tradeEvaluator: TradeRiskEvaluator;
  private readonly positionSizer: PositionSizingCalculator;

  // Current limits
  private limits: RiskLimits;

  constructor(customLimits?: Partial<RiskLimits>) {
    this.limits = { ...DEFAULT_RISK_LIMITS, ...customLimits };

    // Initialize sub-analyzers with current limits
    this.positionAnalyzer = new PositionRiskAnalyzer(this.limits);
    this.portfolioAnalyzer = new PortfolioRiskAnalyzer(this.limits);
    this.tradeEvaluator = new TradeRiskEvaluator(this.limits);
    this.positionSizer = new PositionSizingCalculator(this.limits);

    Logger.info('RiskService initialized');
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API - Position Analysis
  // ═══════════════════════════════════════════════════════

  /**
   * Analyze risk for a specific position
   */
  analyzePositionRisk(
    symbol: string,
    portfolio: PortfolioData
  ): PositionRisk | null {
    return this.positionAnalyzer.analyze(symbol, portfolio);
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API - Portfolio Analysis
  // ═══════════════════════════════════════════════════════

  /**
   * Analyze overall portfolio risk
   */
  analyzePortfolioRisk(portfolio: PortfolioData): PortfolioRisk {
    return this.portfolioAnalyzer.analyze(portfolio);
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API - Trade Evaluation
  // ═══════════════════════════════════════════════════════

  /**
   * Evaluate risk of a proposed trade BEFORE execution
   */
  evaluateTradeRisk(
    tradeType: TradeTypeValue,
    symbol: string,
    quantity: number,
    estimatedPrice: number,
    portfolio: PortfolioData
  ): TradeRiskEvaluation {
    return this.tradeEvaluator.evaluate(
      tradeType,
      symbol,
      quantity,
      estimatedPrice,
      portfolio
    );
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API - Position Sizing
  // ═══════════════════════════════════════════════════════

  /**
   * Calculate recommended position size for a symbol
   * @param symbol - Stock symbol to size
   * @param estimatedPrice - Current/estimated price per share
   * @param portfolio - Current portfolio state
   * @param strategy - Sizing strategy (conservative, moderate, max_allowed)
   */
  suggestPositionSize(
    symbol: string,
    estimatedPrice: number,
    portfolio: PortfolioData,
    strategy: SizingStrategyValue = SIZING_STRATEGY.MODERATE
  ): PositionSizeRecommendation {
    return this.positionSizer.calculate(
      symbol,
      estimatedPrice,
      portfolio,
      strategy
    );
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API - Risk Limits
  // ═══════════════════════════════════════════════════════

  /**
   * Get current risk limits
   */
  getRiskLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Update risk limits
   */
  setRiskLimits(newLimits: Partial<RiskLimits>): RiskLimits {
    this.limits = { ...this.limits, ...newLimits };

    // Update all sub-analyzers with new limits
    this.positionAnalyzer.updateLimits(this.limits);
    this.portfolioAnalyzer.updateLimits(this.limits);
    this.tradeEvaluator.updateLimits(this.limits);
    this.positionSizer.updateLimits(this.limits);

    Logger.info(`Risk limits updated: ${JSON.stringify(this.limits)}`);
    return this.getRiskLimits();
  }
}
