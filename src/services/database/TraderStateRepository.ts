/**
 * Trader State Repository
 * Handles rate limiting and scheduling state per trader
 */

import type Database from 'better-sqlite3';
import type { TraderState } from './types.js';

export class TraderStateRepository {
  constructor(private db: Database.Database) {}

  public get(traderName: string): TraderState | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM trader_state WHERE trader_name = ?'
    );
    return stmt.get(traderName) as TraderState | undefined;
  }

  public initialize(traderName: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO trader_state (trader_name)
      VALUES (?)
    `);
    stmt.run(traderName);
  }

  public update(
    traderName: string,
    updates: Partial<Omit<TraderState, 'trader_name'>>
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.last_trade_timestamp !== undefined) {
      fields.push('last_trade_timestamp = ?');
      values.push(updates.last_trade_timestamp);
    }

    if (updates.trades_today !== undefined) {
      fields.push('trades_today = ?');
      values.push(updates.trades_today);
    }

    if (updates.last_reset_date !== undefined) {
      fields.push('last_reset_date = ?');
      values.push(updates.last_reset_date);
    }

    if (updates.api_calls_today !== undefined) {
      fields.push('api_calls_today = ?');
      values.push(updates.api_calls_today);
    }

    if (fields.length === 0) return;

    values.push(traderName);
    const stmt = this.db.prepare(`
      UPDATE trader_state 
      SET ${fields.join(', ')} 
      WHERE trader_name = ?
    `);
    stmt.run(...values);
  }

  public resetDaily(traderName: string): void {
    const stmt = this.db.prepare(`
      UPDATE trader_state 
      SET trades_today = 0, api_calls_today = 0, last_reset_date = date('now')
      WHERE trader_name = ?
    `);
    stmt.run(traderName);
  }
}
