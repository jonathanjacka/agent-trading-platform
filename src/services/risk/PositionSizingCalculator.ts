/**
 * Position Sizing Calculator
 * Calculates optimal position sizes based on risk limits and portfolio state
 */

import { RISK_LEVEL } from './constants.js';
import type {
  RiskLimits,
  PortfolioData,
  PositionSizeRecommendation,
  RiskLevelValue,
} from './types.js';

// ═══════════════════════════════════════════════════════
// POSITION SIZING STRATEGY
// ═══════════════════════════════════════════════════════

export const SIZING_STRATEGY = {
  /** Use all available capacity up to max position limit */
  MAX_ALLOWED: 'max_allowed',
  /** Conservative: use only 50% of available capacity */
  CONSERVATIVE: 'conservative',
  /** Moderate: use 75% of available capacity */
  MODERATE: 'moderate',
} as const;

export type SizingStrategyValue =
  (typeof SIZING_STRATEGY)[keyof typeof SIZING_STRATEGY];

// Strategy multipliers
const STRATEGY_MULTIPLIERS: Record<SizingStrategyValue, number> = {
  [SIZING_STRATEGY.MAX_ALLOWED]: 1.0,
  [SIZING_STRATEGY.MODERATE]: 0.75,
  [SIZING_STRATEGY.CONSERVATIVE]: 0.5,
};

export class PositionSizingCalculator {
  constructor(private limits: RiskLimits) {}

  /**
   * Update the risk limits used for calculations
   */
  updateLimits(limits: RiskLimits): void {
    this.limits = limits;
  }

  /**
   * Calculate recommended position size for a symbol
   */
  calculate(
    symbol: string,
    estimatedPrice: number,
    portfolio: PortfolioData,
    strategy: SizingStrategyValue = SIZING_STRATEGY.MODERATE
  ): PositionSizeRecommendation {
    const constraints: string[] = [];
    const warnings: string[] = [];

    // Find existing position if any
    const existingHolding = portfolio.holdings.find((h) => h.symbol === symbol);
    const existingValue = existingHolding?.currentValue ?? 0;
    const existingShares = existingHolding?.quantity ?? 0;

    // Calculate constraint limits
    const cashConstraint = this.calculateCashConstraint(portfolio, constraints);
    const positionConstraint = this.calculatePositionConstraint(
      portfolio,
      existingValue,
      constraints
    );

    // The binding constraint is the minimum of all constraints
    const maxPurchaseValue = Math.min(cashConstraint, positionConstraint);

    // Apply strategy multiplier
    const strategyMultiplier = STRATEGY_MULTIPLIERS[strategy];
    const recommendedValue = maxPurchaseValue * strategyMultiplier;

    // Calculate shares
    const maxShares = Math.floor(maxPurchaseValue / estimatedPrice);
    const recommendedShares = Math.floor(recommendedValue / estimatedPrice);

    // Determine limiting factor
    const limitingFactor = this.determineLimitingFactor(
      cashConstraint,
      positionConstraint
    );

    // Generate warnings
    this.generateWarnings(
      maxShares,
      recommendedShares,
      existingShares,
      existingValue,
      portfolio,
      warnings
    );

    // Calculate risk level for this purchase
    const riskLevel = this.assessPurchaseRisk(
      recommendedShares,
      estimatedPrice,
      portfolio,
      existingValue
    );

    // Calculate post-purchase metrics
    const postPurchaseValue =
      existingValue + recommendedShares * estimatedPrice;
    const postPurchasePercent =
      (postPurchaseValue / portfolio.totalValue) * 100;

    return {
      symbol,
      estimatedPrice,
      strategy,
      // Share recommendations
      maxShares,
      recommendedShares,
      // Value recommendations
      maxValue: maxShares * estimatedPrice,
      recommendedValue: recommendedShares * estimatedPrice,
      // Current state
      existingShares,
      existingValue,
      // Post-purchase projections
      postPurchaseShares: existingShares + recommendedShares,
      postPurchaseValue,
      postPurchasePercent,
      // Analysis
      limitingFactor,
      riskLevel,
      constraints,
      warnings,
      // Can we buy anything?
      canBuy: recommendedShares > 0,
      reason:
        recommendedShares > 0
          ? `Can safely purchase up to ${recommendedShares} shares ($${(recommendedShares * estimatedPrice).toFixed(2)})`
          : this.getCannotBuyReason(
              cashConstraint,
              positionConstraint,
              estimatedPrice
            ),
    };
  }

  /**
   * Calculate how much cash is available for purchase (respecting min cash reserve)
   */
  private calculateCashConstraint(
    portfolio: PortfolioData,
    constraints: string[]
  ): number {
    const minCashRequired =
      portfolio.totalValue * (this.limits.minCashPercent / 100);
    const availableCash = portfolio.cash - minCashRequired;

    constraints.push(
      `Cash available: $${Math.max(0, availableCash).toFixed(2)} (keeping ${this.limits.minCashPercent}% reserve)`
    );

    return Math.max(0, availableCash);
  }

  /**
   * Calculate how much more can be added to position (respecting max position limit)
   */
  private calculatePositionConstraint(
    portfolio: PortfolioData,
    existingValue: number,
    constraints: string[]
  ): number {
    const maxPositionValue =
      portfolio.totalValue * (this.limits.maxPositionPercent / 100);
    const remainingCapacity = maxPositionValue - existingValue;

    constraints.push(
      `Position capacity: $${Math.max(0, remainingCapacity).toFixed(2)} (max ${this.limits.maxPositionPercent}% of portfolio)`
    );

    return Math.max(0, remainingCapacity);
  }

  /**
   * Determine which constraint is the binding one
   */
  private determineLimitingFactor(
    cashConstraint: number,
    positionConstraint: number
  ): PositionSizeRecommendation['limitingFactor'] {
    if (cashConstraint <= 0 && positionConstraint <= 0) {
      return 'both';
    }
    if (cashConstraint <= positionConstraint) {
      return 'cash';
    }
    return 'position_limit';
  }

  /**
   * Generate warnings about the purchase
   */
  private generateWarnings(
    maxShares: number,
    recommendedShares: number,
    existingShares: number,
    existingValue: number,
    portfolio: PortfolioData,
    warnings: string[]
  ): void {
    if (maxShares === 0) {
      warnings.push('Cannot purchase any shares within risk limits');
    } else if (recommendedShares < maxShares) {
      warnings.push(
        `Using conservative sizing: ${recommendedShares} of ${maxShares} max shares`
      );
    }

    if (existingShares > 0) {
      const currentPercent = (existingValue / portfolio.totalValue) * 100;
      warnings.push(
        `Already own ${existingShares} shares (${currentPercent.toFixed(1)}% of portfolio)`
      );
    }

    const cashPercent = (portfolio.cash / portfolio.totalValue) * 100;
    if (cashPercent < this.limits.minCashPercent * 1.5) {
      warnings.push(
        `Cash is low (${cashPercent.toFixed(1)}%), consider smaller position`
      );
    }
  }

  /**
   * Assess risk level for the recommended purchase
   */
  private assessPurchaseRisk(
    shares: number,
    price: number,
    portfolio: PortfolioData,
    existingValue: number
  ): RiskLevelValue {
    if (shares === 0) {
      return RISK_LEVEL.CRITICAL;
    }

    const purchaseValue = shares * price;
    const postPurchaseValue = existingValue + purchaseValue;
    const postPurchasePercent =
      (postPurchaseValue / portfolio.totalValue) * 100;

    // Check position concentration
    if (postPurchasePercent > this.limits.maxPositionPercent * 0.9) {
      return RISK_LEVEL.HIGH;
    }
    if (postPurchasePercent > this.limits.maxPositionPercent * 0.7) {
      return RISK_LEVEL.MEDIUM;
    }

    // Check cash impact
    const postCash = portfolio.cash - purchaseValue;
    const postCashPercent = (postCash / portfolio.totalValue) * 100;

    if (postCashPercent < this.limits.minCashPercent * 1.2) {
      return RISK_LEVEL.MEDIUM;
    }

    return RISK_LEVEL.LOW;
  }

  /**
   * Get reason why no shares can be purchased
   */
  private getCannotBuyReason(
    cashConstraint: number,
    positionConstraint: number,
    price: number
  ): string {
    if (cashConstraint <= 0 && positionConstraint <= 0) {
      return 'Both cash and position limits exhausted';
    }
    if (cashConstraint <= 0) {
      return `Insufficient cash (need to maintain ${this.limits.minCashPercent}% reserve)`;
    }
    if (positionConstraint <= 0) {
      return `Position already at maximum ${this.limits.maxPositionPercent}% limit`;
    }
    if (Math.min(cashConstraint, positionConstraint) < price) {
      return `Available capacity ($${Math.min(cashConstraint, positionConstraint).toFixed(2)}) is less than one share ($${price.toFixed(2)})`;
    }
    return 'Unable to determine purchase capacity';
  }
}
