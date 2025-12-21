/**
 * Recent Trades Formatter
 *
 * Formats trade history with realized P&L calculations for display.
 */

import type { TradeLog } from '../../database/types.js';
import type { TradeRecord } from '../types.js';

interface Position {
  qty: number;
  avgPrice: number;
}

export class RecentTradesFormatter {
  /**
   * Format recent trades for display with P&L calculations
   */
  format(trades: TradeLog[], limit: number): TradeRecord[] {
    const positions = new Map<string, Position>();
    const sortedTrades = this.sortByTimestamp(trades);
    const records: TradeRecord[] = [];

    for (const trade of sortedTrades) {
      if (!this.isValidTrade(trade)) continue;

      let realizedPnL: number | null = null;

      if (trade.action === 'BUY') {
        this.processBuy(positions, trade);
      } else if (trade.action === 'SELL') {
        realizedPnL = this.processSell(positions, trade);
      }

      records.push({
        timestamp: trade.timestamp,
        action: trade.action as 'BUY' | 'SELL',
        symbol: trade.symbol!,
        quantity: trade.quantity!,
        price: trade.price!,
        value: trade.quantity! * trade.price!,
        realizedPnL,
        rationale: trade.rationale,
      });
    }

    // Return most recent first, limited
    return records.reverse().slice(0, limit);
  }

  private sortByTimestamp(trades: TradeLog[]): TradeLog[] {
    return [...trades].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private isValidTrade(trade: TradeLog): boolean {
    return !!(
      trade.symbol &&
      trade.quantity &&
      trade.price &&
      (trade.action === 'BUY' || trade.action === 'SELL')
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
    trade: TradeLog
  ): number | null {
    const pos = positions.get(trade.symbol!);
    if (pos && pos.qty >= trade.quantity!) {
      const pnl = (trade.price! - pos.avgPrice) * trade.quantity!;

      const remainingQty = pos.qty - trade.quantity!;
      if (remainingQty > 0) {
        positions.set(trade.symbol!, { ...pos, qty: remainingQty });
      } else {
        positions.delete(trade.symbol!);
      }

      return pnl;
    }
    return null;
  }
}
