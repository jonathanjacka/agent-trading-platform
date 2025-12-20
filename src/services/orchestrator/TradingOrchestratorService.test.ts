import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TradingOrchestratorService, SessionOptions } from './index.js';
import { TraderAgent } from '../../agents/TraderAgent.js';
import { DatabaseService } from '../database/index.js';
import { MemoryService } from '../memory/index.js';

// Mock TraderAgent
const createMockTrader = (name: string, shouldFail = false) => {
  return {
    trade: vi.fn().mockImplementation(async (prompt: string) => {
      if (shouldFail) {
        throw new Error(`${name} trade failed`);
      }
      return `${name} executed trade successfully`;
    }),
  } as unknown as TraderAgent;
};

// Mock PushoverService as a class
vi.mock('../PushoverService.js', () => ({
  PushoverService: class MockPushoverService {
    sendNotification = vi.fn().mockResolvedValue(undefined);
  },
}));

describe('TradingOrchestratorService', () => {
  let orchestrator: TradingOrchestratorService;
  let traders: Map<string, TraderAgent>;
  let db: DatabaseService;

  beforeEach(() => {
    // Reset singletons
    // @ts-ignore
    DatabaseService.instance = undefined;
    // @ts-ignore
    MemoryService.instance = undefined;

    db = DatabaseService.getInstance(':memory:');

    // Create mock traders
    traders = new Map([
      ['leonardo', createMockTrader('leonardo')],
      ['michelangelo', createMockTrader('michelangelo')],
      ['raphael', createMockTrader('raphael')],
      ['donatello', createMockTrader('donatello')],
    ]);

    orchestrator = new TradingOrchestratorService(traders);
  });

  afterEach(() => {
    db.close();
    // @ts-ignore
    DatabaseService.instance = undefined;
    // @ts-ignore
    MemoryService.instance = undefined;
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should return available agents', () => {
      const agents = orchestrator.getAvailableAgents();

      expect(agents).toHaveLength(4);
      expect(agents).toContain('leonardo');
      expect(agents).toContain('michelangelo');
      expect(agents).toContain('raphael');
      expect(agents).toContain('donatello');
    });

    it('should return default prompts for all agents', () => {
      const agents = ['leonardo', 'michelangelo', 'raphael', 'donatello'];

      agents.forEach((agent) => {
        const prompt = orchestrator.getDefaultPrompt(agent);
        expect(prompt).toBeDefined();
        expect(prompt).toContain('daily trading session');
      });
    });

    it('should return undefined for unknown agent prompt', () => {
      const prompt = orchestrator.getDefaultPrompt('unknown-agent');
      expect(prompt).toBeUndefined();
    });
  });

  describe('Session Execution', () => {
    it('should run all agents by default', async () => {
      const options: SessionOptions = {
        delayBetweenAgentsMs: 0, // No delay for tests
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.totalAgents).toBe(4);
      expect(result.successfulAgents).toBe(4);
      expect(result.failedAgents).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Each trader should have been called
      traders.forEach((trader) => {
        expect(trader.trade).toHaveBeenCalled();
      });
    });

    it('should run only specified agents', async () => {
      const options: SessionOptions = {
        agents: ['leonardo', 'raphael'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.totalAgents).toBe(2);
      expect(result.successfulAgents).toBe(2);

      expect(traders.get('leonardo')?.trade).toHaveBeenCalled();
      expect(traders.get('raphael')?.trade).toHaveBeenCalled();
      expect(traders.get('michelangelo')?.trade).not.toHaveBeenCalled();
      expect(traders.get('donatello')?.trade).not.toHaveBeenCalled();
    });

    it('should use custom prompts when provided', async () => {
      const customPrompt = 'Buy AAPL shares today';
      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        customPrompts: { leonardo: customPrompt },
        skipInsights: true,
      };

      await orchestrator.runDailySession(options);

      expect(traders.get('leonardo')?.trade).toHaveBeenCalledWith(customPrompt);
    });

    it('should handle agent failures gracefully', async () => {
      // Replace one trader with a failing one
      traders.set('michelangelo', createMockTrader('michelangelo', true));
      orchestrator = new TradingOrchestratorService(traders);

      const options: SessionOptions = {
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.totalAgents).toBe(4);
      expect(result.successfulAgents).toBe(3);
      expect(result.failedAgents).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('michelangelo');

      // Other agents should have still run
      expect(traders.get('leonardo')?.trade).toHaveBeenCalled();
      expect(traders.get('raphael')?.trade).toHaveBeenCalled();
      expect(traders.get('donatello')?.trade).toHaveBeenCalled();
    });

    it('should handle unknown agent gracefully', async () => {
      const options: SessionOptions = {
        agents: ['leonardo', 'unknown-agent'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      // Should still run leonardo
      expect(result.totalAgents).toBe(1);
      expect(result.successfulAgents).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('not found');
    });

    it('should generate session ID with correct format', async () => {
      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.sessionId).toMatch(/^session_\d{8}_\d{6}$/);
    });

    it('should calculate session duration correctly', async () => {
      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.endTime.getTime()).toBeGreaterThanOrEqual(
        result.startTime.getTime()
      );
    });
  });

  describe('Dry Run Mode', () => {
    it('should not execute trades in dry run mode', async () => {
      const options: SessionOptions = {
        delayBetweenAgentsMs: 0,
        dryRun: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.totalAgents).toBe(4);
      expect(result.successfulAgents).toBe(4);
      expect(result.failedAgents).toBe(0);

      // Traders should NOT have been called
      traders.forEach((trader) => {
        expect(trader.trade).not.toHaveBeenCalled();
      });

      // Results should indicate dry run
      result.agentResults.forEach((agentResult) => {
        expect(agentResult.response).toContain('DRY RUN');
      });
    });

    it('should not persist to database in dry run mode', async () => {
      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        dryRun: true,
      };

      const result = await orchestrator.runDailySession(options);

      // Try to get the run from database - it shouldn't exist
      const run = db.getSchedulerRun(result.sessionId);
      expect(run).toBeUndefined();
    });
  });

  describe('Database Persistence', () => {
    it('should create scheduler run in database', async () => {
      // Re-create orchestrator after db reset to share the same instance
      orchestrator = new TradingOrchestratorService(traders);

      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options, 'test-job');

      const run = db.getSchedulerRun(result.sessionId);
      expect(run).toBeDefined();
      expect(run?.job_name).toBe('test-job');
      expect(run?.status).toBe('success');
      expect(run?.successful_agents).toBe(1);
      expect(run?.total_agents).toBe(1);
    });

    it('should update run status on failure', async () => {
      traders.set('leonardo', createMockTrader('leonardo', true));
      // Re-create orchestrator after db reset and trader change
      orchestrator = new TradingOrchestratorService(traders);

      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      const run = db.getSchedulerRun(result.sessionId);
      expect(run?.status).toBe('failure');
      expect(run?.failed_agents).toBe(1);
      expect(run?.error_message).toContain('leonardo');
    });

    it('should store full results JSON', async () => {
      // Re-create orchestrator after db reset to share the same instance
      orchestrator = new TradingOrchestratorService(traders);

      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      const run = db.getSchedulerRun(result.sessionId);
      expect(run?.results_json).toBeDefined();

      const storedResult = JSON.parse(run!.results_json!);
      expect(storedResult.sessionId).toBe(result.sessionId);
      expect(storedResult.agentResults).toHaveLength(1);
    });
  });

  describe('Agent Results', () => {
    it('should track timing for each agent', async () => {
      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      expect(result.agentResults).toHaveLength(1);
      const agentResult = result.agentResults[0];

      expect(agentResult.agentName).toBe('leonardo');
      expect(agentResult.startTime).toBeDefined();
      expect(agentResult.endTime).toBeDefined();
      expect(agentResult.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should capture agent response on success', async () => {
      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      const agentResult = result.agentResults[0];
      expect(agentResult.success).toBe(true);
      expect(agentResult.response).toContain('leonardo');
      expect(agentResult.error).toBeUndefined();
    });

    it('should capture error message on failure', async () => {
      traders.set('leonardo', createMockTrader('leonardo', true));
      orchestrator = new TradingOrchestratorService(traders);

      const options: SessionOptions = {
        agents: ['leonardo'],
        delayBetweenAgentsMs: 0,
        skipInsights: true,
      };

      const result = await orchestrator.runDailySession(options);

      const agentResult = result.agentResults[0];
      expect(agentResult.success).toBe(false);
      expect(agentResult.error).toContain('trade failed');
      expect(agentResult.response).toBeUndefined();
    });
  });

  describe('Delays', () => {
    it('should respect delay between agents', async () => {
      const delayMs = 100;
      const options: SessionOptions = {
        agents: ['leonardo', 'michelangelo'],
        delayBetweenAgentsMs: delayMs,
        skipInsights: true,
      };

      const start = Date.now();
      await orchestrator.runDailySession(options);
      const elapsed = Date.now() - start;

      // Should have at least one delay (between the two agents)
      expect(elapsed).toBeGreaterThanOrEqual(delayMs * 0.9); // Allow 10% tolerance
    });

    it('should not delay in dry run mode', async () => {
      const options: SessionOptions = {
        agents: ['leonardo', 'michelangelo'],
        delayBetweenAgentsMs: 5000, // Long delay
        dryRun: true,
      };

      const start = Date.now();
      await orchestrator.runDailySession(options);
      const elapsed = Date.now() - start;

      // Should be very fast since no delays
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
