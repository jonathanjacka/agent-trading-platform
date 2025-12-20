/**
 * Transaction Repository
 * Handles all transaction-related database operations
 */

import type Database from 'better-sqlite3';
import type { Transaction } from './types.js';

export class TransactionRepository {
  constructor(private db: Database.Database) {}

  public create(
    traderName: string,
    symbol: string,
    quantity: number,
    price: number,
    type: 'BUY' | 'SELL',
    rationale: string
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (trader_name, symbol, quantity, price, type, rationale)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      traderName,
      symbol,
      quantity,
      price,
      type,
      rationale
    );
    return result.lastInsertRowid as number;
  }

  public getByTrader(traderName: string, limit: number = 50): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(traderName, limit) as Transaction[];
  }

  public getAll(limit: number = 100): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as Transaction[];
  }
}
