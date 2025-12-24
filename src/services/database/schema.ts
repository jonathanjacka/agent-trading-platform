/**
 * Database Schema
 * SQL table definitions and indexes
 */

import Database from 'better-sqlite3';

/**
 * Initialize all database tables and indexes
 */
export function initializeTables(db: Database.Database): void {
  // Accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      trader_name TEXT PRIMARY KEY,
      cash REAL NOT NULL,
      initial_balance REAL NOT NULL,
      strategy TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Holdings table
  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      type TEXT NOT NULL,
      rationale TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
    )
  `);

  // Portfolio values table
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_name TEXT NOT NULL,
      total_value REAL NOT NULL,
      pnl REAL NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
    )
  `);

  // Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_name TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
    )
  `);

  // Trade logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_name TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      prompt TEXT,
      action TEXT NOT NULL CHECK(action IN ('BUY', 'SELL', 'HOLD', 'ERROR')),
      symbol TEXT,
      quantity REAL,
      price REAL,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      execution_time_ms INTEGER NOT NULL,
      rationale TEXT,
      market_data_snapshot TEXT,
      portfolio_before TEXT,
      portfolio_after TEXT,
      FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
    )
  `);

  // Create indexes for trade_logs
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_logs_trader 
    ON trade_logs(trader_name)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_logs_timestamp 
    ON trade_logs(timestamp DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trade_logs_success 
    ON trade_logs(success)
  `);

  // Trader state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trader_state (
      trader_name TEXT PRIMARY KEY,
      last_trading_session TEXT,
      total_sessions INTEGER DEFAULT 0,
      successful_trades INTEGER DEFAULT 0,
      failed_trades INTEGER DEFAULT 0,
      last_buy_symbol TEXT,
      last_sell_symbol TEXT,
      consecutive_losses INTEGER DEFAULT 0,
      daily_trades INTEGER DEFAULT 0,
      FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
    )
  `);

  // Agent memory table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      context TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      use_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      tags TEXT,
      FOREIGN KEY (agent_name) REFERENCES accounts(trader_name)
    )
  `);

  // Create indexes for agent_memory
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agent_memory_agent 
    ON agent_memory(agent_name)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agent_memory_type 
    ON agent_memory(memory_type)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agent_memory_confidence 
    ON agent_memory(confidence DESC)
  `);

  // Collective insights table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collective_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insight_type TEXT NOT NULL,
      content TEXT NOT NULL,
      contributing_agents TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      tags TEXT
    )
  `);

  // Create indexes for collective_insights
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_collective_insights_type 
    ON collective_insights(insight_type)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_collective_insights_confidence 
    ON collective_insights(confidence DESC)
  `);

  // Scheduler runs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      job_name TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      total_agents INTEGER NOT NULL DEFAULT 0,
      successful_agents INTEGER NOT NULL DEFAULT 0,
      failed_agents INTEGER NOT NULL DEFAULT 0,
      total_trades INTEGER NOT NULL DEFAULT 0,
      collective_insights_generated INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      error_message TEXT,
      results_json TEXT
    )
  `);

  // Create indexes for scheduler_runs
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduler_runs_started 
    ON scheduler_runs(started_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduler_runs_status 
    ON scheduler_runs(status)
  `);

  // Watchlist table - for agent-managed symbol monitoring
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      added_by TEXT NOT NULL,
      reason TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      active BOOLEAN NOT NULL DEFAULT 1,
      UNIQUE(symbol, added_by)
    )
  `);

  // Create indexes for watchlist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_watchlist_symbol 
    ON watchlist(symbol)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_watchlist_active 
    ON watchlist(active)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_watchlist_expires 
    ON watchlist(expires_at)
  `);

  // Signal history table - for logging detected trading signals
  db.exec(`
    CREATE TABLE IF NOT EXISTS signal_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      target_agent TEXT,
      triggered BOOLEAN NOT NULL,
      trigger_reason TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      data_snapshot TEXT
    )
  `);

  // Create indexes for signal_history
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_signal_history_symbol 
    ON signal_history(symbol)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_signal_history_detected 
    ON signal_history(detected_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_signal_history_type 
    ON signal_history(signal_type)
  `);
}
