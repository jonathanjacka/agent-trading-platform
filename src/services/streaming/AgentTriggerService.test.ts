import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { AgentTriggerService } from './AgentTriggerService.js';
import { SignalDetectionService } from './SignalDetectionService.js';
import { DatabaseService } from '../database/index.js';
import type { TradingSignal } from './types.js';

// Create a mock SignalDetectionService
function createMockSignalService(): SignalDetectionService {
  const emitter = new EventEmitter();
  return emitter as unknown as SignalDetectionService;
}

// Helper to create a trading signal
function createSignal(overrides: Partial<TradingSignal> = {}): TradingSignal {
  return {
    id: 'signal-test-1',
    symbol: 'AAPL',
    type: 'volume_spike',
    confidence: 0.75,
    targetAgents: ['leonardo', 'donatello'],
    reason: 'Volume spike: 4x average volume',
    detectedAt: new Date(),
    data: {
      price: 150,
      priceChange: 2,
      priceChangePercent: 1.33,
      volume: 40000,
      volumeRatio: 4,
    },
    ...overrides,
  };
}

describe('AgentTriggerService', () => {
  let triggerService: AgentTriggerService;
  let mockSignalService: SignalDetectionService;
  let db: DatabaseService;

  beforeEach(() => {
    // Reset database singleton
    // @ts-ignore
    DatabaseService.instance = undefined;
    db = DatabaseService.getInstance(':memory:');

    mockSignalService = createMockSignalService();
    triggerService = new AgentTriggerService(mockSignalService, {
      leonardo: { cooldownMinutes: 1, dailyLimit: 5, minimumConfidence: 0.6 },
      donatello: { cooldownMinutes: 1, dailyLimit: 10, minimumConfidence: 0.5 },
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('initialization', () => {
    it('should initialize with merged configs', () => {
      const leonardoConfig = triggerService.getConfig('leonardo');
      const donatelloConfig = triggerService.getConfig('donatello');

      expect(leonardoConfig.cooldownMinutes).toBe(1);
      expect(leonardoConfig.dailyLimit).toBe(5);
      expect(donatelloConfig.minimumConfidence).toBe(0.5);
    });

    it('should initialize states for all agents', () => {
      const states = triggerService.getAllAgentStates();

      expect(states).toHaveLength(4);
      expect(states.map((s) => s.agentName)).toContain('leonardo');
      expect(states.map((s) => s.agentName)).toContain('michelangelo');
      expect(states.map((s) => s.agentName)).toContain('raphael');
      expect(states.map((s) => s.agentName)).toContain('donatello');
    });

    it('should initialize with zero stats', () => {
      const stats = triggerService.getStats();

      expect(stats.signalsReceived).toBe(0);
      expect(stats.signalsFiltered).toBe(0);
      expect(stats.agentsTriggered).toBe(0);
    });
  });

  describe('canTrigger', () => {
    it('should allow trigger when all checks pass', () => {
      const signal = createSignal({ confidence: 0.8 });
      const decision = triggerService.canTrigger('leonardo', signal);

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('All checks passed');
    });

    it('should reject when confidence is too low', () => {
      const signal = createSignal({ confidence: 0.3 });
      const decision = triggerService.canTrigger('leonardo', signal);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Confidence');
      expect(decision.reason).toContain('minimum');
    });

    it('should reject when in cooldown period', () => {
      // Simulate a recent trigger
      const state = triggerService.getAgentState('leonardo');
      state!.lastTrigger = new Date(); // Just triggered

      const signal = createSignal({ confidence: 0.8 });
      const decision = triggerService.canTrigger('leonardo', signal);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Cooldown');
    });

    it('should allow after cooldown expires', async () => {
      // Simulate a trigger from the past
      const state = triggerService.getAgentState('leonardo');
      state!.lastTrigger = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

      const signal = createSignal({ confidence: 0.8 });
      const decision = triggerService.canTrigger('leonardo', signal);

      expect(decision.allowed).toBe(true);
    });

    it('should reject when daily limit reached', () => {
      const state = triggerService.getAgentState('leonardo');
      state!.dailyTriggerCount = 5; // At limit

      const signal = createSignal({ confidence: 0.8 });
      const decision = triggerService.canTrigger('leonardo', signal);

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Daily limit');
    });
  });

  describe('signal handling', () => {
    it('should process signals and update stats', () => {
      const signal = createSignal({ confidence: 0.8 });
      mockSignalService.emit('signal', signal);

      const stats = triggerService.getStats();
      expect(stats.signalsReceived).toBe(1);
    });

    it('should call trigger callback when allowed', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      triggerService.setTriggerCallback(callback);

      const signal = createSignal({
        confidence: 0.8,
        targetAgents: ['donatello'], // Only donatello
      });
      mockSignalService.emit('signal', signal);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(
        'donatello',
        expect.objectContaining({ symbol: 'AAPL' }),
        expect.stringContaining('INTRADAY OPPORTUNITY ALERT')
      );
    });

    it('should not call callback when signal filtered', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      triggerService.setTriggerCallback(callback);

      const signal = createSignal({
        confidence: 0.1, // Below threshold
        targetAgents: ['leonardo'],
      });
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('Test error'));
      triggerService.setTriggerCallback(callback);

      const signal = createSignal({
        confidence: 0.8,
        targetAgents: ['donatello'],
      });

      // Should not throw
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Service should continue working
      const stats = triggerService.getStats();
      expect(stats.signalsReceived).toBe(1);
    });
  });

  describe('state management', () => {
    it('should get individual agent state', () => {
      const state = triggerService.getAgentState('leonardo');

      expect(state).toBeDefined();
      expect(state!.agentName).toBe('leonardo');
      expect(state!.dailyTriggerCount).toBe(0);
      expect(state!.lastTrigger).toBeNull();
    });

    it('should return undefined for unknown agent', () => {
      // @ts-ignore - testing invalid agent
      const state = triggerService.getAgentState('unknown');
      expect(state).toBeUndefined();
    });

    it('should update state after trigger', async () => {
      triggerService.setTriggerCallback(vi.fn().mockResolvedValue(undefined));

      const signal = createSignal({
        confidence: 0.8,
        targetAgents: ['donatello'],
      });
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = triggerService.getAgentState('donatello');
      expect(state!.dailyTriggerCount).toBe(1);
      expect(state!.lastTrigger).not.toBeNull();
    });

    it('should reset states', () => {
      // Simulate some activity
      const state = triggerService.getAgentState('leonardo');
      state!.dailyTriggerCount = 3;
      state!.lastTrigger = new Date();

      triggerService.resetStates();

      const resetState = triggerService.getAgentState('leonardo');
      expect(resetState!.dailyTriggerCount).toBe(0);
      expect(resetState!.lastTrigger).toBeNull();

      const stats = triggerService.getStats();
      expect(stats.signalsReceived).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should update agent config', () => {
      triggerService.updateConfig('leonardo', {
        cooldownMinutes: 30,
        dailyLimit: 10,
      });

      const config = triggerService.getConfig('leonardo');
      expect(config.cooldownMinutes).toBe(30);
      expect(config.dailyLimit).toBe(10);
    });

    it('should preserve other config values when updating', () => {
      const originalConfig = triggerService.getConfig('leonardo');

      triggerService.updateConfig('leonardo', {
        cooldownMinutes: 30,
      });

      const updatedConfig = triggerService.getConfig('leonardo');
      expect(updatedConfig.cooldownMinutes).toBe(30);
      expect(updatedConfig.dailyLimit).toBe(originalConfig.dailyLimit);
      expect(updatedConfig.minimumConfidence).toBe(originalConfig.minimumConfidence);
    });
  });

  describe('statistics', () => {
    it('should track filtered signals', async () => {
      const signal = createSignal({
        confidence: 0.1, // Below threshold
        targetAgents: ['leonardo'],
      });
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = triggerService.getStats();
      expect(stats.signalsFiltered).toBeGreaterThan(0);
    });

    it('should track triggered agents', async () => {
      triggerService.setTriggerCallback(vi.fn().mockResolvedValue(undefined));

      const signal = createSignal({
        confidence: 0.8,
        targetAgents: ['donatello'],
      });
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = triggerService.getStats();
      expect(stats.agentsTriggered).toBe(1);
      expect(stats.triggersByAgent.donatello).toBe(1);
    });

    it('should track per-agent triggers', async () => {
      triggerService.setTriggerCallback(vi.fn().mockResolvedValue(undefined));

      // Trigger multiple agents
      const signal1 = createSignal({
        id: 'sig-1',
        confidence: 0.8,
        targetAgents: ['donatello'],
      });
      mockSignalService.emit('signal', signal1);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Reset cooldown for another trigger
      const state = triggerService.getAgentState('donatello');
      state!.lastTrigger = new Date(Date.now() - 2 * 60 * 1000);

      const signal2 = createSignal({
        id: 'sig-2',
        confidence: 0.8,
        targetAgents: ['donatello'],
      });
      mockSignalService.emit('signal', signal2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = triggerService.getStats();
      expect(stats.triggersByAgent.donatello).toBe(2);
    });
  });

  describe('prompt building', () => {
    it('should generate prompt with signal details', async () => {
      let capturedPrompt = '';
      triggerService.setTriggerCallback(async (_, __, prompt) => {
        capturedPrompt = prompt;
      });

      const signal = createSignal({
        symbol: 'TSLA',
        type: 'breakout_up',
        confidence: 0.85,
        reason: 'Breakout above 20-bar high',
        targetAgents: ['donatello'],
        data: {
          price: 250,
          priceChange: 5,
          priceChangePercent: 2.04,
          volume: 100000,
        },
      });
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedPrompt).toContain('TSLA');
      expect(capturedPrompt).toContain('BREAKOUT UP');
      expect(capturedPrompt).toContain('85%');
      expect(capturedPrompt).toContain('$250.00');
      expect(capturedPrompt).toContain('Breakout above 20-bar high');
      expect(capturedPrompt).toContain('technical analysis');
    });
  });

  describe('signal logging', () => {
    it('should log signals to database', async () => {
      const signal = createSignal({ confidence: 0.8 });
      mockSignalService.emit('signal', signal);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check database has signal history entry
      const stmt = db.getDatabase().prepare(
        'SELECT * FROM signal_history WHERE symbol = ?'
      );
      const rows = stmt.all('AAPL');

      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
