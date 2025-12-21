/**
 * Portfolio Risk Analyzer
 * Analyzes overall portfolio risk including concentration and diversification
 */

import {
  CONCENTRATION,
  RISK_SCORE_WEIGHTS,
  PORTFOLIO_THRESHOLDS,
  POSITION_THRESHOLDS,
} from './constants.js';
import type {
  RiskLimits,
  PortfolioData,
  PortfolioRisk,
  LargestPosition,
  ConcentrationValue,
} from './types.js';

export class PortfolioRiskAnalyzer {
  constructor(private limits: RiskLimits) {}

  /**
   * Update the risk limits used for analysis
   */
  updateLimits(limits: RiskLimits): void {
    this.limits = limits;
  }

  /**
   * Analyze overall portfolio risk
   */
  analyze(portfolio: PortfolioData): PortfolioRisk {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const cashPercent = (portfolio.cash / portfolio.totalValue) * 100;
    const investedPercent = 100 - cashPercent;

    // Find largest position
    const largestPosition = this.findLargestPosition(portfolio);
    const maxPercent = largestPosition?.percent || 0;

    // Assess concentration
    const concentration = this.assessConcentration(
      portfolio,
      maxPercent,
      largestPosition,
      warnings,
      recommendations
    );

    // Check cash levels
    this.assessCashLevels(cashPercent, warnings, recommendations);

    // Calculate P&L metrics
    const { totalUnrealizedPnL, totalUnrealizedPnLPercent } =
      this.calculatePnL(portfolio);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      concentration,
      cashPercent,
      totalUnrealizedPnLPercent
    );

    return {
      totalValue: portfolio.totalValue,
      cashPercent,
      investedPercent,
      positionCount: portfolio.holdings.length,
      largestPosition,
      concentration,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercent,
      riskScore,
      warnings,
      recommendations,
    };
  }

  /**
   * Find the largest position in the portfolio
   */
  private findLargestPosition(
    portfolio: PortfolioData
  ): LargestPosition | null {
    let largestPosition: LargestPosition | null = null;
    let maxPercent = 0;

    for (const holding of portfolio.holdings) {
      const percent = (holding.currentValue / portfolio.totalValue) * 100;
      if (percent > maxPercent) {
        maxPercent = percent;
        largestPosition = { symbol: holding.symbol, percent };
      }
    }

    return largestPosition;
  }

  /**
   * Assess portfolio concentration level
   */
  private assessConcentration(
    portfolio: PortfolioData,
    maxPercent: number,
    largestPosition: LargestPosition | null,
    warnings: string[],
    recommendations: string[]
  ): ConcentrationValue {
    // All cash = diversified
    if (portfolio.holdings.length === 0) {
      return CONCENTRATION.DIVERSIFIED;
    }

    // Single holding = critical
    if (portfolio.holdings.length === 1) {
      warnings.push('Portfolio has only one holding - no diversification');
      recommendations.push('Consider adding positions in different sectors');
      return CONCENTRATION.CRITICAL;
    }

    // Largest position exceeds limit
    if (maxPercent > this.limits.maxPositionPercent) {
      warnings.push(
        `Largest position (${largestPosition?.symbol}) is ${maxPercent.toFixed(1)}% of portfolio`
      );
      recommendations.push(
        `Consider reducing ${largestPosition?.symbol} position`
      );
      return CONCENTRATION.CRITICAL;
    }

    // Approaching limit
    if (
      maxPercent >
      this.limits.maxPositionPercent *
        POSITION_THRESHOLDS.APPROACHING_LIMIT_FACTOR
    ) {
      warnings.push('Portfolio is concentrated in few positions');
      return CONCENTRATION.CONCENTRATED;
    }

    // Few positions
    if (
      portfolio.holdings.length < PORTFOLIO_THRESHOLDS.MIN_DIVERSIFIED_POSITIONS
    ) {
      recommendations.push(
        'Consider adding more positions for diversification'
      );
      return CONCENTRATION.MODERATE;
    }

    return CONCENTRATION.DIVERSIFIED;
  }

  /**
   * Assess cash levels and generate warnings/recommendations
   */
  private assessCashLevels(
    cashPercent: number,
    warnings: string[],
    recommendations: string[]
  ): void {
    if (cashPercent < this.limits.minCashPercent) {
      warnings.push(
        `Cash is only ${cashPercent.toFixed(1)}% (minimum: ${this.limits.minCashPercent}%)`
      );
      recommendations.push('Consider raising cash for opportunities');
    }

    if (cashPercent > PORTFOLIO_THRESHOLDS.HIGH_CASH_PERCENT) {
      recommendations.push(
        'High cash position - consider deploying capital if opportunities exist'
      );
    }
  }

  /**
   * Calculate total unrealized P&L
   */
  private calculatePnL(portfolio: PortfolioData): {
    totalUnrealizedPnL: number;
    totalUnrealizedPnLPercent: number;
  } {
    const totalUnrealizedPnL = portfolio.holdings.reduce(
      (sum, h) => sum + h.gain,
      0
    );

    const totalCostBasis = portfolio.holdings.reduce(
      (sum, h) => sum + h.quantity * h.avgPrice,
      0
    );

    const totalUnrealizedPnLPercent =
      totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0;

    return { totalUnrealizedPnL, totalUnrealizedPnLPercent };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(
    concentration: ConcentrationValue,
    cashPercent: number,
    totalUnrealizedPnLPercent: number
  ): number {
    let riskScore = 0;

    // Concentration risk (0-40 points)
    riskScore += this.getConcentrationScore(concentration);

    // Cash risk (0-20 points)
    riskScore += this.getCashScore(cashPercent);

    // Loss risk (0-40 points)
    riskScore += this.getLossScore(totalUnrealizedPnLPercent);

    return riskScore;
  }

  /**
   * Get risk score contribution from concentration
   */
  private getConcentrationScore(concentration: ConcentrationValue): number {
    switch (concentration) {
      case CONCENTRATION.CRITICAL:
        return RISK_SCORE_WEIGHTS.CONCENTRATION_CRITICAL;
      case CONCENTRATION.CONCENTRATED:
        return RISK_SCORE_WEIGHTS.CONCENTRATION_HIGH;
      case CONCENTRATION.MODERATE:
        return RISK_SCORE_WEIGHTS.CONCENTRATION_MODERATE;
      default:
        return 0;
    }
  }

  /**
   * Get risk score contribution from cash level
   */
  private getCashScore(cashPercent: number): number {
    if (cashPercent < this.limits.minCashPercent) {
      return RISK_SCORE_WEIGHTS.CASH_LOW;
    }
    if (cashPercent < this.limits.minCashPercent * 2) {
      return RISK_SCORE_WEIGHTS.CASH_MODERATE;
    }
    return 0;
  }

  /**
   * Get risk score contribution from unrealized losses
   */
  private getLossScore(totalUnrealizedPnLPercent: number): number {
    if (totalUnrealizedPnLPercent < PORTFOLIO_THRESHOLDS.LOSS_SEVERE_PERCENT) {
      return RISK_SCORE_WEIGHTS.LOSS_SEVERE;
    }
    if (totalUnrealizedPnLPercent < PORTFOLIO_THRESHOLDS.LOSS_HIGH_PERCENT) {
      return RISK_SCORE_WEIGHTS.LOSS_HIGH;
    }
    if (
      totalUnrealizedPnLPercent < PORTFOLIO_THRESHOLDS.LOSS_MODERATE_PERCENT
    ) {
      return RISK_SCORE_WEIGHTS.LOSS_MODERATE;
    }
    return 0;
  }
}
