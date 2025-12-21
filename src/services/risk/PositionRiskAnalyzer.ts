/**
 * Position Risk Analyzer
 * Analyzes risk for individual positions within a portfolio
 */

import { RISK_LEVEL, POSITION_THRESHOLDS } from './constants.js';
import type {
  RiskLimits,
  PortfolioData,
  PositionRisk,
  HoldingData,
} from './types.js';

export class PositionRiskAnalyzer {
  constructor(private limits: RiskLimits) {}

  /**
   * Update the risk limits used for analysis
   */
  updateLimits(limits: RiskLimits): void {
    this.limits = limits;
  }

  /**
   * Analyze risk for a specific position
   */
  analyze(symbol: string, portfolio: PortfolioData): PositionRisk | null {
    const holding = portfolio.holdings.find((h) => h.symbol === symbol);

    if (!holding) {
      return null;
    }

    const costBasis = holding.quantity * holding.avgPrice;
    const portfolioPercent =
      (holding.currentValue / portfolio.totalValue) * 100;

    // Calculate stop loss and take profit prices
    const stopLossPrice =
      holding.avgPrice * (1 - this.limits.defaultStopLossPercent / 100);
    const takeProfitPrice =
      holding.avgPrice * (1 + this.limits.defaultTakeProfitPercent / 100);

    // Assess risk level and generate warnings
    const { riskLevel, warnings } = this.assessRisk(
      holding,
      portfolioPercent,
      stopLossPrice,
      takeProfitPrice
    );

    return {
      symbol: holding.symbol,
      quantity: holding.quantity,
      avgPrice: holding.avgPrice,
      currentPrice: holding.currentPrice,
      currentValue: holding.currentValue,
      costBasis,
      unrealizedPnL: holding.gain,
      unrealizedPnLPercent: holding.gainPercent,
      portfolioPercent,
      riskLevel,
      warnings,
      stopLossPrice,
      takeProfitPrice,
    };
  }

  /**
   * Assess risk level and generate warnings for a position
   */
  private assessRisk(
    holding: HoldingData,
    portfolioPercent: number,
    stopLossPrice: number,
    takeProfitPrice: number
  ): { riskLevel: PositionRisk['riskLevel']; warnings: string[] } {
    const warnings: string[] = [];
    let riskLevel: PositionRisk['riskLevel'] = RISK_LEVEL.LOW;

    // Position concentration assessment
    riskLevel = this.assessConcentrationRisk(
      portfolioPercent,
      warnings,
      riskLevel
    );

    // Stop loss proximity assessment
    riskLevel = this.assessStopLossProximity(
      holding,
      stopLossPrice,
      warnings,
      riskLevel
    );

    // Take profit assessment
    this.assessTakeProfitTarget(holding, takeProfitPrice, warnings);

    // Unrealized loss assessment
    riskLevel = this.assessUnrealizedLoss(holding, warnings, riskLevel);

    return { riskLevel, warnings };
  }

  /**
   * Assess concentration risk for the position
   */
  private assessConcentrationRisk(
    portfolioPercent: number,
    warnings: string[],
    currentRiskLevel: PositionRisk['riskLevel']
  ): PositionRisk['riskLevel'] {
    if (portfolioPercent > this.limits.maxPositionPercent) {
      warnings.push(
        `Position is ${portfolioPercent.toFixed(1)}% of portfolio (limit: ${this.limits.maxPositionPercent}%)`
      );
      return RISK_LEVEL.CRITICAL;
    }

    if (
      portfolioPercent >
      this.limits.maxPositionPercent *
        POSITION_THRESHOLDS.APPROACHING_LIMIT_FACTOR
    ) {
      warnings.push(
        `Position approaching limit at ${portfolioPercent.toFixed(1)}% of portfolio`
      );
      return RISK_LEVEL.HIGH;
    }

    if (
      portfolioPercent >
      this.limits.maxPositionPercent * POSITION_THRESHOLDS.MEDIUM_RISK_FACTOR
    ) {
      return RISK_LEVEL.MEDIUM;
    }

    return currentRiskLevel;
  }

  /**
   * Assess proximity to stop loss price
   */
  private assessStopLossProximity(
    holding: HoldingData,
    stopLossPrice: number,
    warnings: string[],
    currentRiskLevel: PositionRisk['riskLevel']
  ): PositionRisk['riskLevel'] {
    if (holding.currentPrice <= stopLossPrice) {
      warnings.push(
        `Price ($${holding.currentPrice.toFixed(2)}) is at or below stop loss ($${stopLossPrice.toFixed(2)})`
      );
      return currentRiskLevel !== RISK_LEVEL.CRITICAL
        ? RISK_LEVEL.HIGH
        : currentRiskLevel;
    }

    if (
      holding.currentPrice <=
      stopLossPrice * POSITION_THRESHOLDS.STOP_LOSS_PROXIMITY_FACTOR
    ) {
      const percentAbove =
        ((holding.currentPrice - stopLossPrice) / stopLossPrice) * 100;
      warnings.push(
        `Price approaching stop loss level (${percentAbove.toFixed(1)}% above)`
      );
    }

    return currentRiskLevel;
  }

  /**
   * Check if price has reached take profit target
   */
  private assessTakeProfitTarget(
    holding: HoldingData,
    takeProfitPrice: number,
    warnings: string[]
  ): void {
    if (holding.currentPrice >= takeProfitPrice) {
      warnings.push(
        `Price ($${holding.currentPrice.toFixed(2)}) has reached take profit target ($${takeProfitPrice.toFixed(2)})`
      );
    }
  }

  /**
   * Assess unrealized loss risk
   */
  private assessUnrealizedLoss(
    holding: HoldingData,
    warnings: string[],
    currentRiskLevel: PositionRisk['riskLevel']
  ): PositionRisk['riskLevel'] {
    if (holding.gainPercent < POSITION_THRESHOLDS.SIGNIFICANT_LOSS_PERCENT) {
      warnings.push(
        `Significant unrealized loss of ${holding.gainPercent.toFixed(1)}%`
      );
      return currentRiskLevel === RISK_LEVEL.LOW
        ? RISK_LEVEL.MEDIUM
        : currentRiskLevel;
    }

    return currentRiskLevel;
  }
}
