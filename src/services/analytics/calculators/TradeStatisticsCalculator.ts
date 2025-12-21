/**
 * Trade Statistics Calculator
 *
 * Computes win rate, average win/loss, and profit factor from trade history.
 */

import type { TradeLog } from '../../database/types.js';

export interface TradeStatistics {
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

interface Position {
  qty: number;
  avgPrice: number;
}

export class TradeStatisticsCalculator {
  /**
   * Calculate trade statistics (win rate, avg win/loss, profit factor)
   */
  calculate(trades: TradeLog[]): TradeStatistics {
    const positions = new Map<string, Position>();
    const gains: number[] = [];
    const losses: number[] = [];

    const sortedTrades = this.sortByTimestamp(trades);

    for (const trade of sortedTrades) {
      if (!trade.symbol || !trade.quantity || !trade.price) continue;

      if (trade.action === 'BUY') {
        this.processBuy(positions, trade);
      } else if (trade.action === 'SELL') {
        this.processSell(positions, trade, gains, losses);
      }
    }

    return this.computeStatistics(gains, losses);
  }

  private sortByTimestamp(trades: TradeLog[]): TradeLog[] {
    return [...trades].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private processBuy(positions: Map<string, Position>, trade: TradeLog): void {
    const pos = positions.get(trade.symbol!);
    if (pos) {
      const totalQty = pos.qty + trade.quantity!;
      const totalCost = pos.qty * pos.avgPrice + trade.quantity! * trade.price!;
      positions.set(trade.symbol!, {
        qty: totalQty,
        avgPrice: totalCost / totalQty,
      });
    } else {
      positions.set(trade.symbol!, {
        qty: trade.quantity!,
        avgPrice: trade.price!,
      });
    }
  }

  private processSell(
    positions: Map<string, Position>,
    trade: TradeLog,
    gains: number[],
    losses: number[]
  ): void {
    const pos = positions.get(trade.symbol!);
    if (pos && pos.qty >= trade.quantity!) {
      const pnl = (trade.price! - pos.avgPrice) * trade.quantity!;

      if (pnl >= 0) {
        gains.push(pnl);
      } else {
        losses.push(pnl);
      }

      const remainingQty = pos.qty - trade.quantity!;
      if (remainingQty > 0) {
        positions.set(trade.symbol!, { ...pos, qty: remainingQty });
      } else {
        positions.delete(trade.symbol!);
      }
    }
  }

  private computeStatistics(
    gains: number[],
    losses: number[]
  ): TradeStatistics {
    const winningTrades = gains.length;
    const losingTrades = losses.length;
    const totalClosedTrades = winningTrades + losingTrades;
    const winRate =
      totalClosedTrades > 0 ? winningTrades / totalClosedTrades : 0;

    const grossProfit = gains.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
    };
  }
}
