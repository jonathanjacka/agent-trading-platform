/**
 * Type definitions for Performance Analytics Service
 */

import type { TimePeriodValue } from './constants.js';

// Re-export constants that are commonly used with types
export { TIME_PERIOD, PERIOD_DAYS } from './constants.js';
export type { TimePeriodValue };

// ═══════════════════════════════════════════════════════
// EQUITY CURVE
// ═══════════════════════════════════════════════════════

export interface EquityPoint {
  timestamp: string;
  portfolioValue: number;
  cash: number;
  holdingsValue: number;
  dailyPnL: number;
  cumulativePnL: number;
}

// ═══════════════════════════════════════════════════════
// SYMBOL STATISTICS
// ═══════════════════════════════════════════════════════

export interface SymbolStats {
  symbol: string;
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  realizedPnL: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgGain: number;
  avgLoss: number;
  largestGain: number;
  largestLoss: number;
  totalVolume: number; // Total $ traded
}

// ═══════════════════════════════════════════════════════
// TRADE RECORD (for recent trades display)
// ═══════════════════════════════════════════════════════

export interface TradeRecord {
  timestamp: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  realizedPnL: number | null; // Only for sells
  rationale: string | null;
}

// ═══════════════════════════════════════════════════════
// DRAWDOWN
// ═══════════════════════════════════════════════════════

export interface DrawdownInfo {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakValue: number;
  troughValue: number;
  peakDate: string | null;
  troughDate: string | null;
  currentDrawdown: number;
  currentDrawdownPercent: number;
}

// ═══════════════════════════════════════════════════════
// PERFORMANCE SUMMARY
// ═══════════════════════════════════════════════════════

export interface PerformanceSummary {
  traderName: string;
  period: TimePeriodValue;
  periodStart: string | null;
  periodEnd: string;

  // Portfolio metrics
  initialValue: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercent: number;

  // Trade metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number; // gross profit / gross loss

  // Risk metrics
  drawdown: DrawdownInfo;
  sharpeRatio: number | null; // null if insufficient data

  // Symbol breakdown
  symbolStats: SymbolStats[];
  topWinners: SymbolStats[];
  topLosers: SymbolStats[];

  // Recent activity
  recentTrades: TradeRecord[];

  // Metadata
  dataPoints: number;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════
// PORTFOLIO SNAPSHOT (parsed from trade log JSON)
// ═══════════════════════════════════════════════════════

export interface PortfolioSnapshot {
  cash: number;
  totalValue: number;
  totalHoldingsValue: number;
  holdings: {
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    currentValue: number;
    gain: number;
    gainPercent: number;
  }[];
}

// ═══════════════════════════════════════════════════════
// SERVICE OPTIONS
// ═══════════════════════════════════════════════════════

export interface PerformanceQueryOptions {
  period?: TimePeriodValue;
  startDate?: string;
  endDate?: string;
  recentTradesLimit?: number;
  symbolRankLimit?: number;
}
