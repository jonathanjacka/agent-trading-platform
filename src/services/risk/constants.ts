/**
 * Constants for Risk Management Service
 * Single source of truth for all risk-related configurable values
 */

// ═══════════════════════════════════════════════════════
// RISK LEVEL VALUES
// ═══════════════════════════════════════════════════════

export const RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type RiskLevelValue = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];

// ═══════════════════════════════════════════════════════
// CONCENTRATION VALUES
// ═══════════════════════════════════════════════════════

export const CONCENTRATION = {
  DIVERSIFIED: 'diversified',
  MODERATE: 'moderate',
  CONCENTRATED: 'concentrated',
  CRITICAL: 'critical',
} as const;

export type ConcentrationValue =
  (typeof CONCENTRATION)[keyof typeof CONCENTRATION];

// ═══════════════════════════════════════════════════════
// TRADE TYPE VALUES
// ═══════════════════════════════════════════════════════

export const TRADE_TYPE = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;

export type TradeTypeValue = (typeof TRADE_TYPE)[keyof typeof TRADE_TYPE];

// ═══════════════════════════════════════════════════════
// DEFAULT RISK LIMITS
// ═══════════════════════════════════════════════════════

/** Maximum percentage of portfolio in a single position */
export const DEFAULT_MAX_POSITION_PERCENT = 25;

/** Maximum percentage of portfolio in one sector */
export const DEFAULT_MAX_SECTOR_PERCENT = 40;

/** Minimum percentage of portfolio to keep in cash */
export const DEFAULT_MIN_CASH_PERCENT = 10;

/** Maximum daily loss before stopping trading */
export const DEFAULT_MAX_DAILY_LOSS_PERCENT = 5;

/** Default stop loss percentage below entry price */
export const DEFAULT_STOP_LOSS_PERCENT = 10;

/** Default take profit percentage above entry price */
export const DEFAULT_TAKE_PROFIT_PERCENT = 20;

/** Combined default risk limits object */
export const DEFAULT_RISK_LIMITS = {
  maxPositionPercent: DEFAULT_MAX_POSITION_PERCENT,
  maxSectorPercent: DEFAULT_MAX_SECTOR_PERCENT,
  minCashPercent: DEFAULT_MIN_CASH_PERCENT,
  maxDailyLossPercent: DEFAULT_MAX_DAILY_LOSS_PERCENT,
  defaultStopLossPercent: DEFAULT_STOP_LOSS_PERCENT,
  defaultTakeProfitPercent: DEFAULT_TAKE_PROFIT_PERCENT,
} as const;

// ═══════════════════════════════════════════════════════
// RISK SCORE THRESHOLDS
// ═══════════════════════════════════════════════════════

/** Risk score thresholds for categorization */
export const RISK_SCORE_THRESHOLDS = {
  LOW: 20,
  MODERATE: 50,
  HIGH: 75,
} as const;

/** Risk score contribution weights */
export const RISK_SCORE_WEIGHTS = {
  CONCENTRATION_CRITICAL: 40,
  CONCENTRATION_HIGH: 25,
  CONCENTRATION_MODERATE: 10,
  CASH_LOW: 20,
  CASH_MODERATE: 10,
  LOSS_SEVERE: 40,
  LOSS_HIGH: 25,
  LOSS_MODERATE: 10,
} as const;

// ═══════════════════════════════════════════════════════
// WARNING THRESHOLDS
// ═══════════════════════════════════════════════════════

/** Position warning thresholds */
export const POSITION_THRESHOLDS = {
  /** Percentage of limit that triggers "approaching limit" warning */
  APPROACHING_LIMIT_FACTOR: 0.8,
  /** Percentage of limit that triggers "medium risk" */
  MEDIUM_RISK_FACTOR: 0.5,
  /** Significant unrealized loss threshold */
  SIGNIFICANT_LOSS_PERCENT: -15,
  /** Stop loss proximity factor (5% above stop loss triggers warning) */
  STOP_LOSS_PROXIMITY_FACTOR: 1.05,
} as const;

/** Trade evaluation thresholds */
export const TRADE_THRESHOLDS = {
  /** Minimum cash percentage that triggers blocker */
  CRITICAL_CASH_PERCENT: 5,
  /** Initial position size that triggers suggestion */
  LARGE_INITIAL_POSITION_PERCENT: 15,
  /** Loss percentage that triggers "panic sell" suggestion */
  PANIC_SELL_LOSS_PERCENT: -10,
} as const;

/** Portfolio thresholds */
export const PORTFOLIO_THRESHOLDS = {
  /** Minimum number of positions for good diversification */
  MIN_DIVERSIFIED_POSITIONS: 5,
  /** High cash threshold that triggers deployment recommendation */
  HIGH_CASH_PERCENT: 50,
  /** Loss thresholds for risk scoring */
  LOSS_MODERATE_PERCENT: -5,
  LOSS_HIGH_PERCENT: -10,
  LOSS_SEVERE_PERCENT: -20,
} as const;
