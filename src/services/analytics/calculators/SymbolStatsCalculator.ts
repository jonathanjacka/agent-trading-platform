/**
 * Symbol Statistics Calculator
 *
 * Computes per-symbol performance metrics including P&L, win rate, and volume.
 */

import type { TradeLog } from '../../database/types.js';
import type { SymbolStats } from '../types.js';

interface SymbolData {
  buys: { qty: number; price: number }[];
  sells: { qty: number; price: number; pnl: number }[];
  position: { qty: number; avgPrice: number };
}

export class SymbolStatsCalculator {
  /**
   * Calculate per-symbol statistics
   */
  calculate(trades: TradeLog[]): SymbolStats[] {
    const symbolMap = new Map<string, SymbolData>();

    const sortedTrades = this.sortByTimestamp(trades);

    for (const trade of sortedTrades) {
      if (!trade.symbol || !trade.quantity || !trade.price) continue;

      this.ensureSymbolExists(symbolMap, trade.symbol);
      const data = symbolMap.get(trade.symbol)!;

      if (trade.action === 'BUY') {
        this.processBuy(data, trade);
      } else if (trade.action === 'SELL') {
        this.processSell(data, trade);
      }
    }

    return this.convertToStats(symbolMap);
  }

  private sortByTimestamp(trades: TradeLog[]): TradeLog[] {
    return [...trades].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private ensureSymbolExists(
    map: Map<string, SymbolData>,
    symbol: string
  ): void {
    if (!map.has(symbol)) {
      map.set(symbol, {
        buys: [],
        sells: [],
        position: { qty: 0, avgPrice: 0 },
      });
    }
  }

  private processBuy(data: SymbolData, trade: TradeLog): void {
    data.buys.push({ qty: trade.quantity!, price: trade.price! });

    // Update position
    const totalQty = data.position.qty + trade.quantity!;
    const totalCost =
      data.position.qty * data.position.avgPrice +
      trade.quantity! * trade.price!;
    data.position = {
      qty: totalQty,
      avgPrice: totalQty > 0 ? totalCost / totalQty : 0,
    };
  }

  private processSell(data: SymbolData, trade: TradeLog): void {
    const pnl =
      data.position.qty >= trade.quantity!
        ? (trade.price! - data.position.avgPrice) * trade.quantity!
        : 0;

    data.sells.push({ qty: trade.quantity!, price: trade.price!, pnl });

    // Update position
    data.position.qty = Math.max(0, data.position.qty - trade.quantity!);
  }

  private convertToStats(symbolMap: Map<string, SymbolData>): SymbolStats[] {
    const stats: SymbolStats[] = [];

    for (const [symbol, data] of symbolMap) {
      const allPnLs = data.sells.map((s) => s.pnl);
      const winningPnLs = allPnLs.filter((p) => p > 0);
      const losingPnLs = allPnLs.filter((p) => p < 0);

      const totalBuyVolume = data.buys.reduce(
        (sum, b) => sum + b.qty * b.price,
        0
      );
      const totalSellVolume = data.sells.reduce(
        (sum, s) => sum + s.qty * s.price,
        0
      );

      stats.push({
        symbol,
        totalTrades: data.buys.length + data.sells.length,
        buyTrades: data.buys.length,
        sellTrades: data.sells.length,
        realizedPnL: allPnLs.reduce((a, b) => a + b, 0),
        winningTrades: winningPnLs.length,
        losingTrades: losingPnLs.length,
        winRate:
          data.sells.length > 0 ? winningPnLs.length / data.sells.length : 0,
        avgGain:
          winningPnLs.length > 0
            ? winningPnLs.reduce((a, b) => a + b, 0) / winningPnLs.length
            : 0,
        avgLoss:
          losingPnLs.length > 0
            ? Math.abs(losingPnLs.reduce((a, b) => a + b, 0)) /
              losingPnLs.length
            : 0,
        largestGain: winningPnLs.length > 0 ? Math.max(...winningPnLs) : 0,
        largestLoss: losingPnLs.length > 0 ? Math.min(...losingPnLs) : 0,
        totalVolume: totalBuyVolume + totalSellVolume,
      });
    }

    return stats.sort((a, b) => b.totalTrades - a.totalTrades);
  }
}
