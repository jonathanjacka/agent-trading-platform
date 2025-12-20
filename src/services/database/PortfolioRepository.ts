/**
 * Portfolio Repository
 * Handles portfolio value time series data
 */

import type Database from 'better-sqlite3';
import type { PortfolioValue } from './types.js';

export class PortfolioRepository {
  constructor(private db: Database.Database) {}

  public record(traderName: string, totalValue: number, pnl: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO portfolio_values (trader_name, total_value, pnl)
      VALUES (?, ?, ?)
    `);
    stmt.run(traderName, totalValue, pnl);
  }

  public getHistory(traderName: string, limit: number = 100): PortfolioValue[] {
    const stmt = this.db.prepare(`
      SELECT * FROM portfolio_values 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(traderName, limit) as PortfolioValue[];
  }

  public getLatest(traderName: string): PortfolioValue | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM portfolio_values 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    return stmt.get(traderName) as PortfolioValue | undefined;
  }
}
