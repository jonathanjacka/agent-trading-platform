/**
 * Log Repository
 * Handles general log storage and retrieval
 */

import type Database from 'better-sqlite3';
import type { Log } from './types.js';

export class LogRepository {
  constructor(private db: Database.Database) {}

  public create(traderName: string, type: string, message: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO logs (trader_name, type, message)
      VALUES (?, ?, ?)
    `);
    stmt.run(traderName, type, message);
  }

  public getByTrader(traderName: string, limit: number = 50): Log[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(traderName, limit) as Log[];
  }
}
