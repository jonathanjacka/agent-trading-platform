/**
 * Equity Calculator
 *
 * Extracts portfolio values from trade snapshots and computes Sharpe ratio.
 */

import type { TradeLog } from '../../database/types.js';
import type { EquityPoint, PortfolioSnapshot } from '../types.js';
import {
  MIN_DATA_POINTS_FOR_SHARPE,
  RISK_FREE_RATE,
  TRADING_DAYS_PER_YEAR,
} from '../constants.js';

export interface PortfolioValues {
  initialValue: number;
  currentValue: number;
  equityCurve: EquityPoint[];
}

const DEFAULT_INITIAL_VALUE = 10000;

export class EquityCalculator {
  /**
   * Extract portfolio values from trade log snapshots
   */
  extractPortfolioValues(logs: TradeLog[]): PortfolioValues {
    const equityCurve: EquityPoint[] = [];
    let initialValue = DEFAULT_INITIAL_VALUE;
    let currentValue = initialValue;
    let previousValue = initialValue;

    const sortedLogs = this.sortByTimestamp(logs);

    for (const log of sortedLogs) {
      // Try to parse portfolio_after for current state
      if (log.portfolio_after) {
        const snapshot = this.parseSnapshot(log.portfolio_after);
        if (snapshot) {
          currentValue = snapshot.totalValue;

          equityCurve.push({
            timestamp: log.timestamp,
            portfolioValue: snapshot.totalValue,
            cash: snapshot.cash,
            holdingsValue: snapshot.totalHoldingsValue,
            dailyPnL: snapshot.totalValue - previousValue,
            cumulativePnL: snapshot.totalValue - initialValue,
          });

          previousValue = snapshot.totalValue;
        }
      }

      // Try to get initial value from first portfolio_before
      if (log.portfolio_before && equityCurve.length <= 1) {
        const snapshot = this.parseSnapshot(log.portfolio_before);
        if (snapshot && equityCurve.length === 0) {
          initialValue = snapshot.totalValue;
          previousValue = initialValue;
        }
      }
    }

    // If no snapshots, use initial default
    if (equityCurve.length === 0) {
      currentValue = initialValue;
    }

    return { initialValue, currentValue, equityCurve };
  }

  /**
   * Calculate Sharpe ratio from equity curve
   */
  calculateSharpeRatio(equityCurve: EquityPoint[]): number | null {
    if (equityCurve.length < MIN_DATA_POINTS_FOR_SHARPE) {
      return null;
    }

    const returns = this.calculateDailyReturns(equityCurve);

    if (returns.length < MIN_DATA_POINTS_FOR_SHARPE) {
      return null;
    }

    const meanReturn = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns, meanReturn);

    if (stdDev === 0) {
      return null;
    }

    // Annualize and calculate Sharpe
    const annualizedReturn = meanReturn * TRADING_DAYS_PER_YEAR;
    const annualizedStdDev = stdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
    const sharpeRatio = (annualizedReturn - RISK_FREE_RATE) / annualizedStdDev;

    return Math.round(sharpeRatio * 100) / 100;
  }

  private sortByTimestamp(logs: TradeLog[]): TradeLog[] {
    return [...logs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private parseSnapshot(json: string): PortfolioSnapshot | null {
    try {
      return JSON.parse(json) as PortfolioSnapshot;
    } catch {
      return null;
    }
  }

  private calculateDailyReturns(equityCurve: EquityPoint[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevValue = equityCurve[i - 1].portfolioValue;
      const currValue = equityCurve[i].portfolioValue;
      if (prevValue > 0) {
        returns.push((currValue - prevValue) / prevValue);
      }
    }
    return returns;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }
}
