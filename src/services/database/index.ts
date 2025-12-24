/**
 * Database Service
 * Central database singleton with repository access
 *
 * This module provides a unified interface to SQLite database operations
 * through specialized repositories for each entity type.
 *
 * Usage:
 *   const db = DatabaseService.getInstance();
 *   db.accounts.create({ ... });
 *   db.holdings.getByTrader('trader-name');
 *   db.transactions.getAll('trader-name');
 */

import Database from 'better-sqlite3';
import path from 'path';

// Import schema and repositories
import { initializeTables } from './schema.js';
import { AccountRepository } from './AccountRepository.js';
import { HoldingRepository } from './HoldingRepository.js';
import { TransactionRepository } from './TransactionRepository.js';
import { PortfolioRepository } from './PortfolioRepository.js';
import { LogRepository } from './LogRepository.js';
import { TradeLogRepository } from './TradeLogRepository.js';
import { TraderStateRepository } from './TraderStateRepository.js';
import { MemoryRepository } from './MemoryRepository.js';
import { InsightRepository } from './InsightRepository.js';
import { SchedulerRunRepository } from './SchedulerRunRepository.js';

// Re-export types for convenience
export * from './types.js';

export class DatabaseService {
  private static instance: DatabaseService | undefined;
  private db: Database.Database;

  // Repositories
  public readonly accounts: AccountRepository;
  public readonly holdings: HoldingRepository;
  public readonly transactions: TransactionRepository;
  public readonly portfolio: PortfolioRepository;
  public readonly logs: LogRepository;
  public readonly tradeLogs: TradeLogRepository;
  public readonly traderState: TraderStateRepository;
  public readonly memory: MemoryRepository;
  public readonly insights: InsightRepository;
  public readonly schedulerRuns: SchedulerRunRepository;

  private constructor(dbPath: string) {
    this.db = new Database(dbPath);
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    initializeTables(this.db);

    // Initialize repositories
    this.accounts = new AccountRepository(this.db);
    this.holdings = new HoldingRepository(this.db);
    this.transactions = new TransactionRepository(this.db);
    this.portfolio = new PortfolioRepository(this.db);
    this.logs = new LogRepository(this.db);
    this.tradeLogs = new TradeLogRepository(this.db);
    this.traderState = new TraderStateRepository(this.db);
    this.memory = new MemoryRepository(this.db);
    this.insights = new InsightRepository(this.db);
    this.schedulerRuns = new SchedulerRunRepository(this.db);
  }

  public static getInstance(
    dbPath: string = path.join(process.cwd(), 'data', 'trading.db')
  ): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath);
    }
    return DatabaseService.instance;
  }

  /**
   * Get the raw database instance for services that need direct access
   */
  public getDatabase(): Database.Database {
    return this.db;
  }

  // ============================================
  // Legacy methods for backwards compatibility
  // These delegate to the appropriate repositories
  // ============================================

  // Account operations
  public createAccount(
    traderName: string,
    initialBalance: number,
    strategy: string
  ): void {
    this.accounts.create(traderName, initialBalance, strategy);
  }

  public getAccount(traderName: string) {
    return this.accounts.get(traderName);
  }

  public updateAccountCash(traderName: string, cash: number): void {
    this.accounts.updateCash(traderName, cash);
  }

  public getAllAccounts() {
    return this.accounts.getAll();
  }

  // Holdings operations
  public getHoldings(traderName: string) {
    return this.holdings.getAll(traderName);
  }

  public getHolding(traderName: string, symbol: string) {
    return this.holdings.get(traderName, symbol);
  }

  public upsertHolding(
    traderName: string,
    symbol: string,
    quantity: number,
    avgPrice: number
  ): void {
    this.holdings.upsert(traderName, symbol, quantity, avgPrice);
  }

  public deleteHolding(traderName: string, symbol: string): void {
    this.holdings.delete(traderName, symbol);
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
    return this.transactions.create(
      traderName,
      symbol,
      quantity,
      price,
      type,
      rationale
    );
  }

  public getTransactions(traderName: string, limit: number = 50) {
    return this.transactions.getByTrader(traderName, limit);
  }

  public getAllTransactions(limit: number = 100) {
    return this.transactions.getAll(limit);
  }

  // Portfolio value operations
  public recordPortfolioValue(
    traderName: string,
    value: number,
    pnl: number
  ): void {
    this.portfolio.record(traderName, value, pnl);
  }

  public getPortfolioValues(traderName: string, limit: number = 100) {
    return this.portfolio.getHistory(traderName, limit);
  }

  public getLatestPortfolioValue(traderName: string) {
    return this.portfolio.getLatest(traderName);
  }

  // Log operations
  public createLog(traderName: string, type: string, message: string): void {
    this.logs.create(traderName, type, message);
  }

  public getLogs(traderName: string, limit: number = 50) {
    return this.logs.getByTrader(traderName, limit);
  }

  // Trade log operations
  public createTradeLog(
    log: Parameters<TradeLogRepository['create']>[0]
  ): number {
    return this.tradeLogs.create(log);
  }

  public getTradeLogs(
    traderName: string,
    options?: Parameters<TradeLogRepository['getByTrader']>[1]
  ) {
    return this.tradeLogs.getByTrader(traderName, options);
  }

  public getAllTradeLogs(limit: number = 100) {
    return this.tradeLogs.getAll(limit);
  }

  // Trader state operations
  public getTraderState(traderName: string) {
    return this.traderState.get(traderName);
  }

  public initializeTraderState(traderName: string): void {
    this.traderState.initialize(traderName);
  }

  public updateTraderState(
    traderName: string,
    updates: Parameters<TraderStateRepository['update']>[1]
  ): void {
    this.traderState.update(traderName, updates);
  }

  public resetDailyTraderState(traderName: string): void {
    this.traderState.resetDaily(traderName);
  }

  // Agent memory operations
  public createAgentMemory(
    memory: Parameters<MemoryRepository['create']>[0]
  ): number {
    return this.memory.create(memory);
  }

  public getAgentMemory(memoryId: number) {
    return this.memory.get(memoryId);
  }

  public getAgentMemories(
    agentName: string,
    options?: Parameters<MemoryRepository['getByAgent']>[1]
  ) {
    return this.memory.getByAgent(agentName, options);
  }

  public updateAgentMemory(
    memoryId: number,
    updates: Parameters<MemoryRepository['update']>[1]
  ): void {
    this.memory.update(memoryId, updates);
  }

  public deleteAgentMemory(memoryId: number): void {
    this.memory.delete(memoryId);
  }

  public incrementMemoryUsage(memoryId: number, wasSuccessful: boolean): void {
    this.memory.incrementUsage(memoryId, wasSuccessful);
  }

  public cleanupLowConfidenceMemories(
    minConfidence: number = 0.3,
    minAge: number = 7
  ): number {
    return this.memory.cleanupLowConfidence(minConfidence, minAge);
  }

  // Collective insights operations
  public createCollectiveInsight(
    insight: Parameters<InsightRepository['create']>[0]
  ): number {
    return this.insights.create(insight);
  }

  public getCollectiveInsight(insightId: number) {
    return this.insights.get(insightId);
  }

  public getCollectiveInsights(
    options?: Parameters<InsightRepository['getAll']>[0]
  ) {
    return this.insights.getAll(options);
  }

  public updateCollectiveInsight(
    insightId: number,
    updates: Parameters<InsightRepository['update']>[1]
  ): void {
    this.insights.update(insightId, updates);
  }

  public deleteCollectiveInsight(insightId: number): void {
    this.insights.delete(insightId);
  }

  // Scheduler runs operations
  public createSchedulerRun(sessionId: string, jobName: string): number {
    return this.schedulerRuns.create(sessionId, jobName);
  }

  public updateSchedulerRun(
    sessionId: string,
    updates: Parameters<SchedulerRunRepository['update']>[1]
  ): void {
    this.schedulerRuns.update(sessionId, updates);
  }

  public getSchedulerRun(sessionId: string) {
    return this.schedulerRuns.get(sessionId);
  }

  public getSchedulerRuns(
    options?: Parameters<SchedulerRunRepository['getAll']>[0]
  ) {
    return this.schedulerRuns.getAll(options);
  }

  public getLatestSchedulerRun(jobName?: string) {
    return this.schedulerRuns.getLatest(jobName);
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
