/**
 * Trade Risk Evaluator
 * Evaluates risk of proposed trades BEFORE execution
 */

import { Logger } from '../../utils/logger.js';
import {
  RISK_LEVEL,
  TRADE_TYPE,
  TRADE_THRESHOLDS,
  POSITION_THRESHOLDS,
} from './constants.js';
import type {
  RiskLimits,
  PortfolioData,
  TradeRiskEvaluation,
  TradeTypeValue,
  RiskLevelValue,
  HoldingData,
} from './types.js';

interface TradeProjection {
  postTradePositionValue: number;
  postTradeCash: number;
  postTradeTotalValue: number;
  postTradePositionPercent: number;
  postTradeCashPercent: number;
  existingHolding: HoldingData | undefined;
}

export class TradeRiskEvaluator {
  constructor(private limits: RiskLimits) {}

  /**
   * Update the risk limits used for evaluation
   */
  updateLimits(limits: RiskLimits): void {
    this.limits = limits;
  }

  /**
   * Evaluate risk of a proposed trade BEFORE execution
   */
  evaluate(
    tradeType: TradeTypeValue,
    symbol: string,
    quantity: number,
    estimatedPrice: number,
    portfolio: PortfolioData
  ): TradeRiskEvaluation {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const suggestions: string[] = [];

    const estimatedTotal = quantity * estimatedPrice;

    // Project post-trade state
    const projection = this.projectTradeOutcome(
      tradeType,
      symbol,
      estimatedTotal,
      quantity,
      portfolio,
      blockers
    );

    // Assess risk level
    let riskLevel: RiskLevelValue = RISK_LEVEL.LOW;

    if (tradeType === TRADE_TYPE.BUY) {
      riskLevel = this.evaluateBuyRisk(
        symbol,
        projection,
        blockers,
        warnings,
        suggestions
      );
    } else {
      riskLevel = this.evaluateSellRisk(
        quantity,
        projection,
        warnings,
        suggestions
      );
    }

    const approved = blockers.length === 0;

    Logger.info(
      `Risk evaluation for ${tradeType} ${quantity} ${symbol}: ${approved ? 'APPROVED' : 'BLOCKED'} (${riskLevel})`
    );

    return {
      approved,
      tradeType,
      symbol,
      quantity,
      estimatedPrice,
      estimatedTotal,
      postTradePositionPercent: Math.max(
        0,
        projection.postTradePositionPercent
      ),
      postTradeCashPercent: Math.max(0, projection.postTradeCashPercent),
      riskLevel,
      warnings,
      blockers,
      suggestions,
    };
  }

  /**
   * Project the outcome of a trade
   */
  private projectTradeOutcome(
    tradeType: TradeTypeValue,
    symbol: string,
    estimatedTotal: number,
    quantity: number,
    portfolio: PortfolioData,
    blockers: string[]
  ): TradeProjection {
    const existingHolding = portfolio.holdings.find((h) => h.symbol === symbol);

    let postTradePositionValue: number;
    let postTradeCash: number;
    const postTradeTotalValue = portfolio.totalValue;

    if (tradeType === TRADE_TYPE.BUY) {
      postTradeCash = portfolio.cash - estimatedTotal;
      postTradePositionValue =
        (existingHolding?.currentValue || 0) + estimatedTotal;

      // Check if we have enough cash
      if (postTradeCash < 0) {
        blockers.push(
          `Insufficient cash: need $${estimatedTotal.toFixed(2)}, have $${portfolio.cash.toFixed(2)}`
        );
      }
    } else {
      // SELL
      postTradeCash = portfolio.cash + estimatedTotal;
      postTradePositionValue =
        (existingHolding?.currentValue || 0) - estimatedTotal;

      // Check if we have enough shares
      const existingQuantity = existingHolding?.quantity || 0;
      if (quantity > existingQuantity) {
        blockers.push(
          `Insufficient shares: want to sell ${quantity}, have ${existingQuantity}`
        );
      }
    }

    const postTradePositionPercent =
      (postTradePositionValue / postTradeTotalValue) * 100;
    const postTradeCashPercent = (postTradeCash / postTradeTotalValue) * 100;

    return {
      postTradePositionValue,
      postTradeCash,
      postTradeTotalValue,
      postTradePositionPercent,
      postTradeCashPercent,
      existingHolding,
    };
  }

  /**
   * Evaluate risk specific to BUY trades
   */
  private evaluateBuyRisk(
    symbol: string,
    projection: TradeProjection,
    blockers: string[],
    warnings: string[],
    suggestions: string[]
  ): RiskLevelValue {
    let riskLevel: RiskLevelValue = RISK_LEVEL.LOW;

    // Position concentration check
    riskLevel = this.checkPositionConcentration(
      symbol,
      projection.postTradePositionPercent,
      blockers,
      warnings,
      riskLevel
    );

    // Cash level check
    riskLevel = this.checkCashLevel(
      projection.postTradeCashPercent,
      blockers,
      warnings,
      riskLevel
    );

    // Position sizing suggestion
    this.checkInitialPositionSize(
      projection.postTradePositionPercent,
      projection.existingHolding,
      suggestions
    );

    return riskLevel;
  }

  /**
   * Check position concentration risk
   */
  private checkPositionConcentration(
    symbol: string,
    postTradePositionPercent: number,
    blockers: string[],
    warnings: string[],
    currentRiskLevel: RiskLevelValue
  ): RiskLevelValue {
    if (postTradePositionPercent > this.limits.maxPositionPercent) {
      blockers.push(
        `Trade would make ${symbol} ${postTradePositionPercent.toFixed(1)}% of portfolio (limit: ${this.limits.maxPositionPercent}%)`
      );
      return RISK_LEVEL.CRITICAL;
    }

    if (
      postTradePositionPercent >
      this.limits.maxPositionPercent *
        POSITION_THRESHOLDS.APPROACHING_LIMIT_FACTOR
    ) {
      warnings.push(
        `Position would be ${postTradePositionPercent.toFixed(1)}% of portfolio, approaching limit`
      );
      return RISK_LEVEL.HIGH;
    }

    return currentRiskLevel;
  }

  /**
   * Check cash level after trade
   */
  private checkCashLevel(
    postTradeCashPercent: number,
    blockers: string[],
    warnings: string[],
    currentRiskLevel: RiskLevelValue
  ): RiskLevelValue {
    if (postTradeCashPercent < this.limits.minCashPercent) {
      warnings.push(
        `Cash would drop to ${postTradeCashPercent.toFixed(1)}% (minimum: ${this.limits.minCashPercent}%)`
      );

      if (postTradeCashPercent < TRADE_THRESHOLDS.CRITICAL_CASH_PERCENT) {
        blockers.push('Trade would leave less than 5% cash');
        return RISK_LEVEL.CRITICAL;
      }

      return currentRiskLevel === RISK_LEVEL.LOW
        ? RISK_LEVEL.MEDIUM
        : currentRiskLevel;
    }

    return currentRiskLevel;
  }

  /**
   * Check if initial position size is too large
   */
  private checkInitialPositionSize(
    postTradePositionPercent: number,
    existingHolding: HoldingData | undefined,
    suggestions: string[]
  ): void {
    if (
      postTradePositionPercent >
        TRADE_THRESHOLDS.LARGE_INITIAL_POSITION_PERCENT &&
      !existingHolding
    ) {
      suggestions.push(
        `Consider a smaller initial position (currently ${postTradePositionPercent.toFixed(1)}%)`
      );
    }
  }

  /**
   * Evaluate risk specific to SELL trades
   */
  private evaluateSellRisk(
    quantity: number,
    projection: TradeProjection,
    warnings: string[],
    suggestions: string[]
  ): RiskLevelValue {
    const { existingHolding } = projection;

    // Check if closing entire position
    if (existingHolding && quantity === existingHolding.quantity) {
      suggestions.push(
        'Closing entire position - ensure this aligns with your strategy'
      );
    }

    // Check if selling at a loss
    if (existingHolding && existingHolding.gainPercent < 0) {
      warnings.push(
        `Selling at ${existingHolding.gainPercent.toFixed(1)}% loss`
      );

      if (
        existingHolding.gainPercent < TRADE_THRESHOLDS.PANIC_SELL_LOSS_PERCENT
      ) {
        suggestions.push('Consider if this is a stop-loss or panic sell');
      }
    }

    // SELL trades are generally lower risk
    return RISK_LEVEL.LOW;
  }
}
