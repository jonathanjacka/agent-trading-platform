import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from './index.js';
import { MemoryService } from '../memory/index.js';
import { TradeLogService } from '../TradeLogService.js';
import fs from 'fs';
import path from 'path';

/**
 * Integration tests for Database and Memory services
 * Uses an in-memory SQLite database to test without affecting production data
 */

describe('Database Service Integration', () => {
  let db: DatabaseService;

  beforeEach(() => {
    // Reset the singleton instance and create a fresh in-memory database
    // @ts-ignore - Access private property for testing
    DatabaseService.instance = undefined;
    db = DatabaseService.getInstance(':memory:');
  });

  afterEach(() => {
    // Clean up
    db.close();
    // @ts-ignore - Reset singleton for next test
    DatabaseService.instance = undefined;
  });

  describe('Account Operations', () => {
    it('should create and retrieve account', () => {
      // Act
      db.createAccount('TestTrader', 10000, 'Test strategy');
      const account = db.getAccount('TestTrader');

      // Assert
      expect(account).toBeDefined();
      expect(account?.trader_name).toBe('TestTrader');
      expect(account?.cash).toBe(10000);
      expect(account?.initial_balance).toBe(10000);
      expect(account?.strategy).toBe('Test strategy');
    });

    it('should update account cash', () => {
      // Arrange
      db.createAccount('TestTrader', 10000, 'Test strategy');

      // Act
      db.updateAccountCash('TestTrader', 8500);
      const account = db.getAccount('TestTrader');

      // Assert
      expect(account?.cash).toBe(8500);
      expect(account?.initial_balance).toBe(10000); // Initial balance unchanged
    });

    it('should get all accounts', () => {
      // Arrange
      db.createAccount('Trader1', 10000, 'Strategy 1');
      db.createAccount('Trader2', 20000, 'Strategy 2');

      // Act
      const accounts = db.getAllAccounts();

      // Assert
      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.trader_name)).toContain('Trader1');
      expect(accounts.map((a) => a.trader_name)).toContain('Trader2');
    });
  });

  describe('Holdings Operations', () => {
    beforeEach(() => {
      db.createAccount('TestTrader', 10000, 'Test strategy');
    });

    it('should upsert and retrieve holdings', () => {
      // Act - Insert
      db.upsertHolding('TestTrader', 'AAPL', 10, 150);
      let holdings = db.getHoldings('TestTrader');

      // Assert - Insert
      expect(holdings).toHaveLength(1);
      expect(holdings[0].symbol).toBe('AAPL');
      expect(holdings[0].quantity).toBe(10);
      expect(holdings[0].avg_price).toBe(150);

      // Act - Update
      db.upsertHolding('TestTrader', 'AAPL', 15, 160);
      holdings = db.getHoldings('TestTrader');

      // Assert - Update
      expect(holdings).toHaveLength(1);
      expect(holdings[0].quantity).toBe(15);
      expect(holdings[0].avg_price).toBe(160);
    });

    it('should get specific holding', () => {
      // Arrange
      db.upsertHolding('TestTrader', 'AAPL', 10, 150);
      db.upsertHolding('TestTrader', 'TSLA', 5, 200);

      // Act
      const holding = db.getHolding('TestTrader', 'AAPL');

      // Assert
      expect(holding).toBeDefined();
      expect(holding?.symbol).toBe('AAPL');
      expect(holding?.quantity).toBe(10);
    });

    it('should delete holding', () => {
      // Arrange
      db.upsertHolding('TestTrader', 'AAPL', 10, 150);

      // Act
      db.deleteHolding('TestTrader', 'AAPL');
      const holdings = db.getHoldings('TestTrader');

      // Assert
      expect(holdings).toHaveLength(0);
    });
  });

  describe('Transaction Operations', () => {
    beforeEach(() => {
      db.createAccount('TestTrader', 10000, 'Test strategy');
    });

    it('should create and retrieve transactions', () => {
      // Act
      const txId = db.createTransaction(
        'TestTrader',
        'AAPL',
        10,
        150,
        'BUY',
        'Strong fundamentals'
      );

      const transactions = db.getTransactions('TestTrader', 10);

      // Assert
      expect(txId).toBeGreaterThan(0);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].symbol).toBe('AAPL');
      expect(transactions[0].quantity).toBe(10);
      expect(transactions[0].price).toBe(150);
      expect(transactions[0].type).toBe('BUY');
    });

    it('should get all transactions with limit', () => {
      // Arrange
      db.createTransaction('TestTrader', 'AAPL', 10, 150, 'BUY', 'Reason 1');
      db.createTransaction('TestTrader', 'TSLA', 5, 200, 'BUY', 'Reason 2');
      db.createTransaction('TestTrader', 'AAPL', 5, 160, 'SELL', 'Reason 3');

      // Act
      const transactions = db.getAllTransactions(2);

      // Assert - Verify we get the limit requested
      expect(transactions).toHaveLength(2);
      // Since this is a fresh database, verify we get any 2 transactions
      expect(transactions[0]).toHaveProperty('symbol');
      expect(transactions[0]).toHaveProperty('quantity');
      expect(transactions[0]).toHaveProperty('type');
    });
  });

  describe('Trade Log Operations', () => {
    beforeEach(() => {
      db.createAccount('TestTrader', 10000, 'Test strategy');
    });

    it('should create and retrieve trade logs', () => {
      // Act
      const logId = db.createTradeLog({
        trader_name: 'TestTrader',
        prompt: 'Test prompt',
        action: 'BUY',
        symbol: 'AAPL',
        quantity: 10,
        price: 150,
        success: true,
        error_message: null,
        execution_time_ms: 1200,
        rationale: 'Good opportunity',
        market_data_snapshot: null,
        portfolio_before: null,
        portfolio_after: null,
      });

      const logs = db.getTradeLogs('TestTrader', { limit: 10 });

      // Assert
      expect(logId).toBeGreaterThan(0);
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(true);
      expect(logs[0].symbol).toBe('AAPL');
    });

    it('should filter trade logs by success', () => {
      // Arrange
      db.createTradeLog({
        trader_name: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        success: true,
        execution_time_ms: 1000,
      } as any);

      db.createTradeLog({
        trader_name: 'TestTrader',
        action: 'SELL',
        symbol: 'TSLA',
        success: false,
        error_message: 'Insufficient shares',
        execution_time_ms: 800,
      } as any);

      // Act
      const successfulLogs = db.getTradeLogs('TestTrader', { success: true });
      const failedLogs = db.getTradeLogs('TestTrader', { success: false });

      // Assert
      expect(successfulLogs).toHaveLength(1);
      expect(successfulLogs[0].symbol).toBe('AAPL');
      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0].symbol).toBe('TSLA');
    });

    it('should filter trade logs by symbol', () => {
      // Arrange
      db.createTradeLog({
        trader_name: 'TestTrader',
        action: 'BUY',
        symbol: 'AAPL',
        success: true,
        execution_time_ms: 1000,
      } as any);

      db.createTradeLog({
        trader_name: 'TestTrader',
        action: 'BUY',
        symbol: 'TSLA',
        success: true,
        execution_time_ms: 1000,
      } as any);

      // Act
      const appleLogs = db.getTradeLogs('TestTrader', { symbol: 'AAPL' });

      // Assert
      expect(appleLogs).toHaveLength(1);
      expect(appleLogs[0].symbol).toBe('AAPL');
    });
  });

  describe('Agent Memory Operations', () => {
    beforeEach(() => {
      db.createAccount('TestTrader', 10000, 'Test strategy');
    });

    it('should create and retrieve agent memory', () => {
      // Act
      const memoryId = db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'successful_trade',
        content: 'AAPL trade was profitable',
        context: JSON.stringify({ symbol: 'AAPL', profit: 250 }),
        confidence: 0.7,
        last_used_at: null,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
        tags: JSON.stringify(['AAPL', 'success']),
      });

      const memory = db.getAgentMemory(memoryId);

      // Assert
      expect(memory).toBeDefined();
      expect(memory?.content).toBe('AAPL trade was profitable');
      expect(memory?.confidence).toBe(0.7);
      expect(memory?.memory_type).toBe('successful_trade');
    });

    it('should filter memories by type and confidence', () => {
      // Arrange
      db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'successful_trade',
        content: 'Success 1',
        confidence: 0.8,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
      } as any);

      db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'failed_trade',
        content: 'Failure 1',
        confidence: 0.3,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
      } as any);

      db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'successful_trade',
        content: 'Success 2',
        confidence: 0.9,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
      } as any);

      // Act
      const highConfidenceSuccesses = db.getAgentMemories('TestTrader', {
        memoryType: 'successful_trade',
        minConfidence: 0.5,
      });

      // Assert
      expect(highConfidenceSuccesses).toHaveLength(2);
      expect(
        highConfidenceSuccesses.every(
          (m) => m.memory_type === 'successful_trade'
        )
      ).toBe(true);
      expect(highConfidenceSuccesses.every((m) => m.confidence >= 0.5)).toBe(
        true
      );
    });

    it('should increment memory usage', () => {
      // Arrange
      const memoryId = db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'successful_trade',
        content: 'Test memory',
        confidence: 0.5,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
      } as any);

      // Act - Successful usage
      db.incrementMemoryUsage(memoryId, true);
      let memory = db.getAgentMemory(memoryId);

      // Assert
      expect(memory?.use_count).toBe(1);
      expect(memory?.success_count).toBe(1);
      expect(memory?.failure_count).toBe(0);

      // Act - Failed usage
      db.incrementMemoryUsage(memoryId, false);
      memory = db.getAgentMemory(memoryId);

      // Assert
      expect(memory?.use_count).toBe(2);
      expect(memory?.success_count).toBe(1);
      expect(memory?.failure_count).toBe(1);
    });

    it('should cleanup low confidence memories', () => {
      // Arrange - Create old memories with low confidence
      db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'failed_trade',
        content: 'Old low confidence',
        confidence: 0.2,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
      } as any);

      db.createAgentMemory({
        agent_name: 'TestTrader',
        memory_type: 'successful_trade',
        content: 'High confidence',
        confidence: 0.9,
        use_count: 0,
        success_count: 0,
        failure_count: 0,
      } as any);

      // Act
      const deletedCount = db.cleanupLowConfidenceMemories(0.3, 0);

      // Assert
      const remainingMemories = db.getAgentMemories('TestTrader', {
        limit: 100,
      });
      expect(deletedCount).toBe(1);
      expect(remainingMemories).toHaveLength(1);
      expect(remainingMemories[0].confidence).toBe(0.9);
    });
  });

  describe('Collective Insights Operations', () => {
    it('should create and retrieve collective insights', () => {
      // Act
      const insightId = db.createCollectiveInsight({
        insight_type: 'popular_stock',
        content: 'Multiple agents traded AAPL successfully',
        contributing_agents: JSON.stringify(['Agent1', 'Agent2', 'Agent3']),
        confidence: 0.75,
        evidence_count: 3,
        tags: JSON.stringify(['AAPL', 'consensus']),
      });

      const insight = db.getCollectiveInsight(insightId);

      // Assert
      expect(insight).toBeDefined();
      expect(insight?.content).toContain('Multiple agents');
      expect(insight?.confidence).toBe(0.75);
      expect(insight?.evidence_count).toBe(3);
    });

    it('should filter insights by confidence and type', () => {
      // Arrange
      db.createCollectiveInsight({
        insight_type: 'popular_stock',
        content: 'AAPL popular',
        contributing_agents: JSON.stringify(['A1', 'A2']),
        confidence: 0.8,
        evidence_count: 2,
      } as any);

      db.createCollectiveInsight({
        insight_type: 'common_error',
        content: 'Rate limit error',
        contributing_agents: JSON.stringify(['A1', 'A3']),
        confidence: 0.9,
        evidence_count: 2,
      } as any);

      // Act
      const popularStocks = db.getCollectiveInsights({
        insightType: 'popular_stock',
        minConfidence: 0.7,
      });

      // Assert
      expect(popularStocks).toHaveLength(1);
      expect(popularStocks[0].insight_type).toBe('popular_stock');
    });

    it('should exclude specific agent from insights', () => {
      // Arrange
      db.createCollectiveInsight({
        insight_type: 'popular_stock',
        content: 'Insight 1',
        contributing_agents: JSON.stringify(['Agent1', 'Agent2']),
        confidence: 0.8,
        evidence_count: 2,
      } as any);

      db.createCollectiveInsight({
        insight_type: 'popular_stock',
        content: 'Insight 2',
        contributing_agents: JSON.stringify(['Agent3', 'Agent4']),
        confidence: 0.8,
        evidence_count: 2,
      } as any);

      // Act
      const insights = db.getCollectiveInsights({
        excludeAgent: 'Agent1',
      });

      // Assert
      expect(insights).toHaveLength(1);
      expect(insights[0].content).toBe('Insight 2');
    });
  });
});

describe('Memory Service Integration', () => {
  let db: DatabaseService;
  let memoryService: MemoryService;
  let tradeLogService: TradeLogService;

  beforeEach(() => {
    // Reset singletons and create fresh instances
    // @ts-ignore
    DatabaseService.instance = undefined;
    // @ts-ignore
    MemoryService.instance = undefined;

    db = DatabaseService.getInstance(':memory:');
    memoryService = MemoryService.getInstance();
    tradeLogService = new TradeLogService(db);

    // Initialize test account
    db.createAccount('TestTrader', 10000, 'Test strategy');
  });

  afterEach(() => {
    db.close();
    // @ts-ignore
    DatabaseService.instance = undefined;
    // @ts-ignore
    MemoryService.instance = undefined;
  });

  it('should auto-generate memory from successful trade log', () => {
    // Act
    const logId = tradeLogService.logTrade({
      traderName: 'TestTrader',
      action: 'BUY',
      symbol: 'AAPL',
      quantity: 10,
      price: 150,
      success: true,
      executionTimeMs: 1200,
      rationale: 'Strong fundamentals',
    });

    // Assert
    const memories = memoryService.getAgentMemories('TestTrader', {
      limit: 10,
    });
    expect(memories).toHaveLength(1);
    expect(memories[0].memory_type).toBe('successful_trade');
    expect(memories[0].content).toContain('AAPL');
    expect(memories[0].confidence).toBeGreaterThan(0.5);
  });

  it('should auto-generate memory from failed trade log', () => {
    // Act
    tradeLogService.logTrade({
      traderName: 'TestTrader',
      action: 'SELL',
      symbol: 'TSLA',
      quantity: 100,
      price: 0,
      success: false,
      errorMessage: 'Insufficient shares',
      executionTimeMs: 800,
      rationale: 'Wanted to sell',
    });

    // Assert
    const memories = memoryService.getAgentMemories('TestTrader', {
      limit: 10,
    });
    expect(memories).toHaveLength(1);
    expect(memories[0].memory_type).toBe('failed_trade');
    expect(memories[0].content).toContain('Failed');
    expect(memories[0].confidence).toBeLessThan(0.6);
  });

  it('should generate collective insights from multiple agent trades', async () => {
    // Arrange - Multiple agents trade same stock
    const agents = ['Agent1', 'Agent2', 'Agent3'];
    agents.forEach((agent) => {
      db.createAccount(agent, 10000, 'Strategy');
      tradeLogService.logTrade({
        traderName: agent,
        action: 'BUY',
        symbol: 'NVDA',
        quantity: 5,
        price: 450,
        success: true,
        executionTimeMs: 1000,
        rationale: 'AI boom',
      });
    });

    // Act
    const insightsCreated = await memoryService.generateCollectiveInsights({
      minAgents: 2,
      lookbackDays: 1,
    });

    // Assert
    expect(insightsCreated).toBeGreaterThan(0);
    const insights = memoryService.getCollectiveInsights({
      minConfidence: 0.5,
    });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].content).toContain('NVDA');
  });

  it('should update memory confidence based on outcomes', () => {
    // Arrange
    const memoryId = memoryService.storeMemory(
      'TestTrader',
      'manual_insight',
      'Test insight',
      undefined,
      0.5,
      []
    );

    // Act - Successful usage
    memoryService.updateMemoryConfidence(memoryId, true, 0.1);
    let memory = db.getAgentMemory(memoryId);
    expect(memory?.confidence).toBeCloseTo(0.6, 2);

    // Act - Failed usage
    memoryService.updateMemoryConfidence(memoryId, false, 0.2);
    memory = db.getAgentMemory(memoryId);
    expect(memory?.confidence).toBeCloseTo(0.4, 2);
  });

  it('should provide memory statistics', () => {
    // Arrange
    memoryService.storeMemory(
      'TestTrader',
      'successful_trade',
      'Success 1',
      undefined,
      0.8,
      []
    );
    memoryService.storeMemory(
      'TestTrader',
      'failed_trade',
      'Failure 1',
      undefined,
      0.4,
      []
    );
    memoryService.storeMemory(
      'TestTrader',
      'successful_trade',
      'Success 2',
      undefined,
      0.9,
      []
    );

    // Act
    const stats = memoryService.getMemoryStats('TestTrader');

    // Assert
    expect(stats.totalMemories).toBe(3);
    expect(stats.avgConfidence).toBeCloseTo(0.7, 1);
    expect(stats.memoryTypeBreakdown['successful_trade']).toBe(2);
    expect(stats.memoryTypeBreakdown['failed_trade']).toBe(1);
  });
});
