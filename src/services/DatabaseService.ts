import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface Account {
  trader_name: string;
  cash: number;
  initial_balance: number;
  strategy: string;
  created_at: string;
}

export interface Holding {
  id: number;
  trader_name: string;
  symbol: string;
  quantity: number;
  avg_price: number;
}

export interface Transaction {
  id: number;
  trader_name: string;
  timestamp: string;
  symbol: string;
  quantity: number;
  price: number;
  type: 'BUY' | 'SELL';
  rationale: string;
}

export interface PortfolioValue {
  id: number;
  trader_name: string;
  timestamp: string;
  value: number;
  pnl: number;
}

export interface Log {
  id: number;
  trader_name: string;
  timestamp: string;
  type: string;
  message: string;
}

export class DatabaseService {
  private db: Database.Database;
  private static instance: DatabaseService;

  private constructor(dbPath: string = './data/trading.db') {
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.initializeTables();
  }

  public static getInstance(dbPath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  private initializeTables(): void {
    // Accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        trader_name TEXT PRIMARY KEY,
        cash REAL NOT NULL,
        initial_balance REAL NOT NULL,
        strategy TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Holdings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        quantity REAL NOT NULL,
        avg_price REAL NOT NULL,
        FOREIGN KEY (trader_name) REFERENCES accounts(trader_name),
        UNIQUE(trader_name, symbol)
      )
    `);

    // Transactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_name TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        symbol TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
        rationale TEXT,
        FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
      )
    `);

    // Create index for faster transaction queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_trader 
      ON transactions(trader_name, timestamp DESC)
    `);

    // Portfolio values table (time series)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_name TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        value REAL NOT NULL,
        pnl REAL NOT NULL,
        FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
      )
    `);

    // Create index for faster portfolio value queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_values_trader 
      ON portfolio_values(trader_name, timestamp DESC)
    `);

    // Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_name TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
      )
    `);

    // Create index for faster log queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_trader 
      ON logs(trader_name, timestamp DESC)
    `);
  }

  // Account operations
  public createAccount(
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

  public getAccount(traderName: string): Account | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM accounts WHERE trader_name = ?'
    );
    return stmt.get(traderName) as Account | undefined;
  }

  public updateAccountCash(traderName: string, cash: number): void {
    const stmt = this.db.prepare(
      'UPDATE accounts SET cash = ? WHERE trader_name = ?'
    );
    stmt.run(cash, traderName);
  }

  public getAllAccounts(): Account[] {
    const stmt = this.db.prepare('SELECT * FROM accounts');
    return stmt.all() as Account[];
  }

  // Holdings operations
  public getHoldings(traderName: string): Holding[] {
    const stmt = this.db.prepare(
      'SELECT * FROM holdings WHERE trader_name = ? AND quantity > 0'
    );
    return stmt.all(traderName) as Holding[];
  }

  public getHolding(traderName: string, symbol: string): Holding | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM holdings WHERE trader_name = ? AND symbol = ?'
    );
    return stmt.get(traderName, symbol) as Holding | undefined;
  }

  public upsertHolding(
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

  public deleteHolding(traderName: string, symbol: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM holdings WHERE trader_name = ? AND symbol = ?'
    );
    stmt.run(traderName, symbol);
  }

  // Transaction operations
  public createTransaction(
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

  public getTransactions(
    traderName: string,
    limit: number = 50
  ): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(traderName, limit) as Transaction[];
  }

  public getAllTransactions(limit: number = 100): Transaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as Transaction[];
  }

  // Portfolio value operations
  public recordPortfolioValue(
    traderName: string,
    value: number,
    pnl: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO portfolio_values (trader_name, value, pnl)
      VALUES (?, ?, ?)
    `);
    stmt.run(traderName, value, pnl);
  }

  public getPortfolioValues(
    traderName: string,
    limit: number = 100
  ): PortfolioValue[] {
    const stmt = this.db.prepare(`
      SELECT * FROM portfolio_values 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(traderName, limit) as PortfolioValue[];
  }

  public getLatestPortfolioValue(
    traderName: string
  ): PortfolioValue | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM portfolio_values 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    return stmt.get(traderName) as PortfolioValue | undefined;
  }

  // Log operations
  public createLog(traderName: string, type: string, message: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO logs (trader_name, type, message)
      VALUES (?, ?, ?)
    `);
    stmt.run(traderName, type, message);
  }

  public getLogs(traderName: string, limit: number = 50): Log[] {
    const stmt = this.db.prepare(`
      SELECT * FROM logs 
      WHERE trader_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(traderName, limit) as Log[];
  }

  // Utility operations
  public close(): void {
    this.db.close();
  }

  public resetDatabase(): void {
    this.db.exec('DELETE FROM logs');
    this.db.exec('DELETE FROM portfolio_values');
    this.db.exec('DELETE FROM transactions');
    this.db.exec('DELETE FROM holdings');
    this.db.exec('DELETE FROM accounts');
  }
}
