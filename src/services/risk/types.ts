/**
 * Type definitions for Risk Management Service
 */

import type {
  RiskLevelValue,
  ConcentrationValue,
  TradeTypeValue,
} from './constants.js';

// Re-export constants that are commonly used with types
export {
  RISK_LEVEL,
  CONCENTRATION,
  TRADE_TYPE,
  DEFAULT_RISK_LIMITS,
} from './constants.js';

// Re-export types from constants
export type { RiskLevelValue, ConcentrationValue, TradeTypeValue };

// ═══════════════════════════════════════════════════════
// RISK LIMITS
// ═══════════════════════════════════════════════════════

export interface RiskLimits {
  maxPositionPercent: number;
  maxSectorPercent: number;
  minCashPercent: number;
  maxDailyLossPercent: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
}

// ═══════════════════════════════════════════════════════
// PORTFOLIO DATA (Input type)
// ═══════════════════════════════════════════════════════

export interface HoldingData {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
}

export interface PortfolioData {
  cash: number;
  holdings: HoldingData[];
  totalValue: number;
  totalHoldingsValue: number;
  initialBalance?: number;
}

// ═══════════════════════════════════════════════════════
// POSITION RISK
// ═══════════════════════════════════════════════════════

export interface PositionRisk {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  portfolioPercent: number;
  riskLevel: RiskLevelValue;
  warnings: string[];
  stopLossPrice: number;
  takeProfitPrice: number;
}

// ═══════════════════════════════════════════════════════
// PORTFOLIO RISK
// ═══════════════════════════════════════════════════════

export interface LargestPosition {
  symbol: string;
  percent: number;
}

export interface PortfolioRisk {
  totalValue: number;
  cashPercent: number;
  investedPercent: number;
  positionCount: number;
  largestPosition: LargestPosition | null;
  concentration: ConcentrationValue;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  riskScore: number; // 0-100, higher = riskier
  warnings: string[];
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════
// TRADE RISK EVALUATION
// ═══════════════════════════════════════════════════════

export interface TradeRiskEvaluation {
  approved: boolean;
  tradeType: TradeTypeValue;
  symbol: string;
  quantity: number;
  estimatedPrice: number;
  estimatedTotal: number;
  postTradePositionPercent: number;
  postTradeCashPercent: number;
  riskLevel: RiskLevelValue;
  warnings: string[];
  blockers: string[]; // Reasons trade should NOT proceed
  suggestions: string[];
}

// ═══════════════════════════════════════════════════════
// POSITION SIZE RECOMMENDATION
// ═══════════════════════════════════════════════════════

export interface PositionSizeRecommendation {
  symbol: string;
  estimatedPrice: number;
  strategy: string;
  // Share recommendations
  maxShares: number;
  recommendedShares: number;
  // Value recommendations
  maxValue: number;
  recommendedValue: number;
  // Current state
  existingShares: number;
  existingValue: number;
  // Post-purchase projections
  postPurchaseShares: number;
  postPurchaseValue: number;
  postPurchasePercent: number;
  // Analysis
  limitingFactor: 'cash' | 'position_limit' | 'both';
  riskLevel: RiskLevelValue;
  constraints: string[];
  warnings: string[];
  // Summary
  canBuy: boolean;
  reason: string;
}

// ═══════════════════════════════════════════════════════
// TYPE ALIASES FOR CONVENIENCE
// ═══════════════════════════════════════════════════════

export type RiskLevel = RiskLevelValue;
export type Concentration = ConcentrationValue;
export type TradeType = TradeTypeValue;
