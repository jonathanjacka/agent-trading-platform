/**
 * Holding Repository
 * Handles all holdings-related database operations
 */

import type Database from 'better-sqlite3';
import type { Holding } from './types.js';

export class HoldingRepository {
  constructor(private db: Database.Database) {}

  public getAll(traderName: string): Holding[] {
    const stmt = this.db.prepare(
      'SELECT * FROM holdings WHERE trader_name = ? AND quantity > 0'
    );
    return stmt.all(traderName) as Holding[];
  }

  public get(traderName: string, symbol: string): Holding | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM holdings WHERE trader_name = ? AND symbol = ?'
    );
    return stmt.get(traderName, symbol) as Holding | undefined;
  }

  public upsert(
    traderName: string,
    symbol: string,
    quantity: number,
    avgPrice: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO holdings (trader_name, symbol, quantity, avg_price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(trader_name, symbol) 
      DO UPDATE SET quantity = ?, avg_price = ?
    `);
    stmt.run(traderName, symbol, quantity, avgPrice, quantity, avgPrice);
  }

  public delete(traderName: string, symbol: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM holdings WHERE trader_name = ? AND symbol = ?'
    );
    stmt.run(traderName, symbol);
  }
}
