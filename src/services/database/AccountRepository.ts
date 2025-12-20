/**
 * Account Repository
 * Handles all account-related database operations
 */

import type Database from 'better-sqlite3';
import type { Account } from './types.js';

export class AccountRepository {
  constructor(private db: Database.Database) {}

  public create(
    traderName: string,
    initialBalance: number,
    strategy: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (trader_name, cash, initial_balance, strategy)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(traderName, initialBalance, initialBalance, strategy);
  }

  public get(traderName: string): Account | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM accounts WHERE trader_name = ?'
    );
    return stmt.get(traderName) as Account | undefined;
  }

  public updateCash(traderName: string, cash: number): void {
    const stmt = this.db.prepare(
      'UPDATE accounts SET cash = ? WHERE trader_name = ?'
    );
    stmt.run(cash, traderName);
  }

  public getAll(): Account[] {
    const stmt = this.db.prepare('SELECT * FROM accounts');
    return stmt.all() as Account[];
  }
}
