/**
 * Drawdown Calculator
 *
 * Computes maximum drawdown and current drawdown from equity curve data.
 */

import type { EquityPoint, DrawdownInfo } from '../types.js';

export class DrawdownCalculator {
  /**
   * Calculate maximum drawdown from equity curve
   */
  calculate(equityCurve: EquityPoint[], currentValue: number): DrawdownInfo {
    if (equityCurve.length === 0) {
      return this.getEmptyDrawdown(currentValue);
    }

    let peak = equityCurve[0].portfolioValue;
    let peakDate = equityCurve[0].timestamp;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let troughValue = peak;
    let troughDate = peakDate;
    let maxPeakValue = peak;
    let maxPeakDate = peakDate;

    for (const point of equityCurve) {
      if (point.portfolioValue > peak) {
        peak = point.portfolioValue;
        peakDate = point.timestamp;
      }

      const drawdown = peak - point.portfolioValue;
      const drawdownPercent = peak > 0 ? drawdown / peak : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
        troughValue = point.portfolioValue;
        troughDate = point.timestamp;
        maxPeakValue = peak;
        maxPeakDate = peakDate;
      }
    }

    // Current drawdown from most recent peak
    const lastPoint = equityCurve[equityCurve.length - 1];
    const currentDrawdown = peak - lastPoint.portfolioValue;
    const currentDrawdownPercent = peak > 0 ? currentDrawdown / peak : 0;

    return {
      maxDrawdown,
      maxDrawdownPercent: maxDrawdownPercent * 100,
      peakValue: maxPeakValue,
      troughValue,
      peakDate: maxPeakDate,
      troughDate,
      currentDrawdown,
      currentDrawdownPercent: currentDrawdownPercent * 100,
    };
  }

  private getEmptyDrawdown(currentValue: number): DrawdownInfo {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      peakValue: currentValue,
      troughValue: currentValue,
      peakDate: null,
      troughDate: null,
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
    };
  }
}
