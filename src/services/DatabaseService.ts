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

export interface TradeLog {
  id: number;
  trader_name: string;
  timestamp: string;
  prompt: string | null;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ERROR';
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  success: boolean;
  error_message: string | null;
  execution_time_ms: number;
  rationale: string | null;
  market_data_snapshot: string | null;
  portfolio_before: string | null;
  portfolio_after: string | null;
}

export interface TraderState {
  trader_name: string;
  last_trade_timestamp?: string;
  trades_today: number;
  last_reset_date: string;
  api_calls_today: number;
}

export interface AgentMemory {
  id: number;
  agent_name: string;
  memory_type: string;
  content: string;
  context?: string; // JSON
  confidence: number;
  created_at: string;
  last_used_at?: string;
  use_count: number;
  success_count: number;
  failure_count: number;
  tags?: string; // JSON array
}

export interface CollectiveInsight {
  id: number;
  insight_type: string;
  content: string;
  contributing_agents: string; // JSON array
  confidence: number;
  evidence_count: number;
  created_at: string;
  tags?: string; // JSON array
}

export interface SchedulerRun {
  id: number;
  session_id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failure';
  total_agents: number;
  successful_agents: number;
  failed_agents: number;
  total_trades: number;
  collective_insights_generated: number;
  duration_ms: number | null;
  error_message: string | null;
  results_json: string | null; // JSON of full SessionResult
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

    // Trade logs table (comprehensive trade logging)
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trade_logs_trader_time 
      ON trade_logs(trader_name, timestamp DESC)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trade_logs_symbol 
      ON trade_logs(symbol, timestamp DESC)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trade_logs_success 
      ON trade_logs(success, timestamp DESC)
    `);

    // Trader state table (rate limiting and scheduling)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trader_state (
        trader_name TEXT PRIMARY KEY,
        last_trade_timestamp TEXT,
        trades_today INTEGER DEFAULT 0,
        last_reset_date TEXT DEFAULT (date('now')),
        api_calls_today INTEGER DEFAULT 0,
        FOREIGN KEY (trader_name) REFERENCES accounts(trader_name)
      )
    `);

    // Agent memory table (individual agent experiences)
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_memory_agent 
      ON agent_memory(agent_name)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_memory_type 
      ON agent_memory(memory_type)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_memory_confidence 
      ON agent_memory(confidence DESC)
    `);

    // Collective insights table (cross-agent patterns)
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_collective_insights_type 
      ON collective_insights(insight_type)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_collective_insights_confidence 
      ON collective_insights(confidence DESC)
    `);

    // Scheduler runs table
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduler_runs_started 
      ON scheduler_runs(started_at DESC)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduler_runs_status 
      ON scheduler_runs(status)
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

  // Trade log operations
  public createTradeLog(log: Omit<TradeLog, 'id' | 'timestamp'>): number {
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

  public getTradeLogs(
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

  public getAllTradeLogs(limit: number = 100): TradeLog[] {
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

  // Trader state operations
  public getTraderState(traderName: string): TraderState | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM trader_state WHERE trader_name = ?'
    );
    return stmt.get(traderName) as TraderState | undefined;
  }

  public initializeTraderState(traderName: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO trader_state (trader_name)
      VALUES (?)
    `);
    stmt.run(traderName);
  }

  public updateTraderState(
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

  public resetDailyTraderState(traderName: string): void {
    const stmt = this.db.prepare(`
      UPDATE trader_state 
      SET trades_today = 0, api_calls_today = 0, last_reset_date = date('now')
      WHERE trader_name = ?
    `);
    stmt.run(traderName);
  }

  // Agent memory operations
  public createAgentMemory(
    memory: Omit<AgentMemory, 'id' | 'created_at'>
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (
        agent_name, memory_type, content, context, confidence,
        last_used_at, use_count, success_count, failure_count, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      memory.agent_name,
      memory.memory_type,
      memory.content,
      memory.context,
      memory.confidence,
      memory.last_used_at,
      memory.use_count,
      memory.success_count,
      memory.failure_count,
      memory.tags
    );
    return result.lastInsertRowid as number;
  }

  public getAgentMemory(memoryId: number): AgentMemory | undefined {
    const stmt = this.db.prepare('SELECT * FROM agent_memory WHERE id = ?');
    return stmt.get(memoryId) as AgentMemory | undefined;
  }

  public getAgentMemories(
    agentName: string,
    options: {
      memoryType?: string;
      minConfidence?: number;
      limit?: number;
      tags?: string[];
    } = {}
  ): AgentMemory[] {
    const { memoryType, minConfidence = 0, limit = 50, tags } = options;

    let query = `SELECT * FROM agent_memory WHERE agent_name = ?`;
    const params: any[] = [agentName];

    if (memoryType) {
      query += ` AND memory_type = ?`;
      params.push(memoryType);
    }

    if (minConfidence > 0) {
      query += ` AND confidence >= ?`;
      params.push(minConfidence);
    }

    if (tags && tags.length > 0) {
      // Simple tag filtering - for more complex queries, consider JSON functions
      const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      tags.forEach((tag) => params.push(`%"${tag}"%`));
    }

    query += ` ORDER BY confidence DESC, created_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as AgentMemory[];
  }

  public updateAgentMemory(
    memoryId: number,
    updates: Partial<
      Omit<AgentMemory, 'id' | 'agent_name' | 'created_at' | 'memory_type'>
    >
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    if (updates.context !== undefined) {
      fields.push('context = ?');
      values.push(updates.context);
    }

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    if (updates.last_used_at !== undefined) {
      fields.push('last_used_at = ?');
      values.push(updates.last_used_at);
    }

    if (updates.use_count !== undefined) {
      fields.push('use_count = ?');
      values.push(updates.use_count);
    }

    if (updates.success_count !== undefined) {
      fields.push('success_count = ?');
      values.push(updates.success_count);
    }

    if (updates.failure_count !== undefined) {
      fields.push('failure_count = ?');
      values.push(updates.failure_count);
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(updates.tags);
    }

    if (fields.length === 0) return;

    values.push(memoryId);
    const stmt = this.db.prepare(`
      UPDATE agent_memory 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    stmt.run(...values);
  }

  public deleteAgentMemory(memoryId: number): void {
    const stmt = this.db.prepare('DELETE FROM agent_memory WHERE id = ?');
    stmt.run(memoryId);
  }

  public incrementMemoryUsage(memoryId: number, wasSuccessful: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE agent_memory 
      SET use_count = use_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_used_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(wasSuccessful ? 1 : 0, wasSuccessful ? 0 : 1, memoryId);
  }

  public cleanupLowConfidenceMemories(
    minConfidence: number = 0.3,
    minAge: number = 7
  ): number {
    const stmt = this.db.prepare(`
      DELETE FROM agent_memory 
      WHERE confidence < ? 
      AND datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(minConfidence, minAge);
    return result.changes;
  }

  // Collective insights operations
  public createCollectiveInsight(
    insight: Omit<CollectiveInsight, 'id' | 'created_at'>
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO collective_insights (
        insight_type, content, contributing_agents, 
        confidence, evidence_count, tags
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      insight.insight_type,
      insight.content,
      insight.contributing_agents,
      insight.confidence,
      insight.evidence_count,
      insight.tags
    );
    return result.lastInsertRowid as number;
  }

  public getCollectiveInsight(
    insightId: number
  ): CollectiveInsight | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM collective_insights WHERE id = ?'
    );
    return stmt.get(insightId) as CollectiveInsight | undefined;
  }

  public getCollectiveInsights(
    options: {
      insightType?: string;
      minConfidence?: number;
      minEvidenceCount?: number;
      limit?: number;
      tags?: string[];
      excludeAgent?: string;
    } = {}
  ): CollectiveInsight[] {
    const {
      insightType,
      minConfidence = 0,
      minEvidenceCount = 1,
      limit = 50,
      tags,
      excludeAgent,
    } = options;

    let query = `SELECT * FROM collective_insights WHERE evidence_count >= ?`;
    const params: any[] = [minEvidenceCount];

    if (insightType) {
      query += ` AND insight_type = ?`;
      params.push(insightType);
    }

    if (minConfidence > 0) {
      query += ` AND confidence >= ?`;
      params.push(minConfidence);
    }

    if (excludeAgent) {
      query += ` AND contributing_agents NOT LIKE ?`;
      params.push(`%"${excludeAgent}"%`);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      tags.forEach((tag) => params.push(`%"${tag}"%`));
    }

    query += ` ORDER BY confidence DESC, evidence_count DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as CollectiveInsight[];
  }

  public updateCollectiveInsight(
    insightId: number,
    updates: Partial<
      Omit<CollectiveInsight, 'id' | 'created_at' | 'insight_type'>
    >
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    if (updates.contributing_agents !== undefined) {
      fields.push('contributing_agents = ?');
      values.push(updates.contributing_agents);
    }

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    if (updates.evidence_count !== undefined) {
      fields.push('evidence_count = ?');
      values.push(updates.evidence_count);
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(updates.tags);
    }

    if (fields.length === 0) return;

    values.push(insightId);
    const stmt = this.db.prepare(`
      UPDATE collective_insights 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    stmt.run(...values);
  }

  public deleteCollectiveInsight(insightId: number): void {
    const stmt = this.db.prepare(
      'DELETE FROM collective_insights WHERE id = ?'
    );
    stmt.run(insightId);
  }

  // Scheduler runs operations
  public createSchedulerRun(sessionId: string, jobName: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_runs (session_id, job_name, status)
      VALUES (?, ?, 'running')
    `);
    const result = stmt.run(sessionId, jobName);
    return result.lastInsertRowid as number;
  }

  public updateSchedulerRun(
    sessionId: string,
    updates: {
      status?: 'running' | 'success' | 'failure';
      completedAt?: string;
      totalAgents?: number;
      successfulAgents?: number;
      failedAgents?: number;
      totalTrades?: number;
      collectiveInsightsGenerated?: number;
      durationMs?: number;
      errorMessage?: string;
      resultsJson?: string;
    }
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.totalAgents !== undefined) {
      fields.push('total_agents = ?');
      values.push(updates.totalAgents);
    }
    if (updates.successfulAgents !== undefined) {
      fields.push('successful_agents = ?');
      values.push(updates.successfulAgents);
    }
    if (updates.failedAgents !== undefined) {
      fields.push('failed_agents = ?');
      values.push(updates.failedAgents);
    }
    if (updates.totalTrades !== undefined) {
      fields.push('total_trades = ?');
      values.push(updates.totalTrades);
    }
    if (updates.collectiveInsightsGenerated !== undefined) {
      fields.push('collective_insights_generated = ?');
      values.push(updates.collectiveInsightsGenerated);
    }
    if (updates.durationMs !== undefined) {
      fields.push('duration_ms = ?');
      values.push(updates.durationMs);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.resultsJson !== undefined) {
      fields.push('results_json = ?');
      values.push(updates.resultsJson);
    }

    if (fields.length === 0) return;

    values.push(sessionId);
    const stmt = this.db.prepare(`
      UPDATE scheduler_runs 
      SET ${fields.join(', ')} 
      WHERE session_id = ?
    `);
    stmt.run(...values);
  }

  public getSchedulerRun(sessionId: string): SchedulerRun | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM scheduler_runs WHERE session_id = ?'
    );
    return stmt.get(sessionId) as SchedulerRun | undefined;
  }

  public getSchedulerRuns(
    options: {
      limit?: number;
      status?: 'running' | 'success' | 'failure';
      jobName?: string;
    } = {}
  ): SchedulerRun[] {
    const { limit = 50, status, jobName } = options;

    let query = 'SELECT * FROM scheduler_runs WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (jobName) {
      query += ' AND job_name = ?';
      params.push(jobName);
    }

    query += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as SchedulerRun[];
  }

  public getLatestSchedulerRun(jobName?: string): SchedulerRun | undefined {
    let query = 'SELECT * FROM scheduler_runs';
    const params: any[] = [];

    if (jobName) {
      query += ' WHERE job_name = ?';
      params.push(jobName);
    }

    query += ' ORDER BY started_at DESC LIMIT 1';

    const stmt = this.db.prepare(query);
    return stmt.get(...params) as SchedulerRun | undefined;
  }

  // Utility operations
  public close(): void {
    this.db.close();
  }

  public resetDatabase(): void {
    this.db.exec('DELETE FROM scheduler_runs');
    this.db.exec('DELETE FROM collective_insights');
    this.db.exec('DELETE FROM agent_memory');
    this.db.exec('DELETE FROM trade_logs');
    this.db.exec('DELETE FROM trader_state');
    this.db.exec('DELETE FROM logs');
    this.db.exec('DELETE FROM portfolio_values');
    this.db.exec('DELETE FROM transactions');
    this.db.exec('DELETE FROM holdings');
    this.db.exec('DELETE FROM accounts');
  }
}
