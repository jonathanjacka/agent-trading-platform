/**
 * Trade Log Repository
 * Handles comprehensive trade logging with filtering
 */

import type Database from 'better-sqlite3';
import type { TradeLog } from './types.js';

export class TradeLogRepository {
  constructor(private db: Database.Database) {}

  public create(log: Omit<TradeLog, 'id' | 'timestamp'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO trade_logs (
        trader_name, prompt, action, symbol, quantity, price,
        success, error_message, execution_time_ms, rationale,
        market_data_snapshot, portfolio_before, portfolio_after
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      log.trader_name,
      log.prompt,
      log.action,
      log.symbol,
      log.quantity,
      log.price,
      log.success ? 1 : 0,
      log.error_message,
      log.execution_time_ms,
      log.rationale,
      log.market_data_snapshot,
      log.portfolio_before,
      log.portfolio_after
    );
    return result.lastInsertRowid as number;
  }

  public getByTrader(
    traderName: string,
    options: {
      limit?: number;
      symbol?: string;
      success?: boolean;
      startDate?: string;
      endDate?: string;
    } = {}
  ): TradeLog[] {
    const { limit = 50, symbol, success, startDate, endDate } = options;

    let query = `SELECT * FROM trade_logs WHERE trader_name = ?`;
    const params: any[] = [traderName];

    if (symbol) {
      query += ` AND symbol = ?`;
      params.push(symbol);
    }

    if (success !== undefined) {
      query += ` AND success = ?`;
      params.push(success ? 1 : 0);
    }

    if (startDate) {
      query += ` AND timestamp >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND timestamp <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as any[];

    return results.map((row) => ({
      ...row,
      success: Boolean(row.success),
    })) as TradeLog[];
  }

  public getAll(limit: number = 100): TradeLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trade_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    const results = stmt.all(limit) as any[];

    return results.map((row) => ({
      ...row,
      success: Boolean(row.success),
    })) as TradeLog[];
  }
}
