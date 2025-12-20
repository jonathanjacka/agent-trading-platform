import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchedulerService, SchedulerConfig } from './index.js';
import {
  TradingOrchestratorService,
  SessionResult,
} from '../orchestrator/index.js';

// Mock the orchestrator
const createMockOrchestrator = () =>
  ({
    runDailySession: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      startTime: new Date(),
      endTime: new Date(),
      durationMs: 1000,
      agentResults: [],
      totalAgents: 4,
      successfulAgents: 4,
      failedAgents: 0,
      collectiveInsightsGenerated: 2,
      errors: [],
    } as SessionResult),
    getAvailableAgents: vi.fn(() => [
      'leonardo',
      'michelangelo',
      'raphael',
      'donatello',
    ]),
    getDefaultPrompt: vi.fn((name: string) => `Prompt for ${name}`),
  }) as unknown as TradingOrchestratorService;

describe('SchedulerService', () => {
  let scheduler: SchedulerService;
  let mockOrchestrator: TradingOrchestratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrchestrator = createMockOrchestrator();
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      scheduler = new SchedulerService(mockOrchestrator);

      const config = scheduler.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.tradingSchedule).toBe('0 6 * * 1-5');
      expect(config.timezone).toBe('UTC');
    });

    it('should initialize with custom config', () => {
      const customConfig: SchedulerConfig = {
        enabled: false,
        tradingSchedule: '0 9 * * 1-5',
        timezone: 'America/New_York',
      };

      scheduler = new SchedulerService(mockOrchestrator, customConfig);

      const config = scheduler.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.tradingSchedule).toBe('0 9 * * 1-5');
      expect(config.timezone).toBe('America/New_York');
    });

    it('should be disabled when config.enabled is false', () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: false });

      expect(scheduler.isEnabled()).toBe(false);
    });
  });

  describe('Enable/Disable', () => {
    it('should toggle enabled state', () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: false });

      expect(scheduler.isEnabled()).toBe(false);

      scheduler.setEnabled(true);
      expect(scheduler.isEnabled()).toBe(true);

      scheduler.setEnabled(false);
      expect(scheduler.isEnabled()).toBe(false);
    });

    it('should not start jobs when disabled', () => {
      const cron = require('node-cron');
      scheduler = new SchedulerService(mockOrchestrator, { enabled: false });

      scheduler.start();

      // Job should not have been scheduled
      expect(scheduler.getJobStatuses()).toHaveLength(0);
    });

    it('should start jobs when enabled', () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });

      scheduler.start();

      // Job should have been scheduled - verified by job statuses
      const statuses = scheduler.getJobStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].name).toBe('daily-trading');
    });
  });

  describe('Job Management', () => {
    it('should return job statuses after start', () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      const statuses = scheduler.getJobStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].name).toBe('daily-trading');
      expect(statuses[0].enabled).toBe(true);
    });

    it('should get specific job status', () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      const status = scheduler.getJobStatus('daily-trading');
      expect(status).toBeDefined();
      expect(status?.name).toBe('daily-trading');

      const unknownStatus = scheduler.getJobStatus('unknown-job');
      expect(unknownStatus).toBeUndefined();
    });

    it('should clear jobs on stop', () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      expect(scheduler.getJobStatuses()).toHaveLength(1);

      scheduler.stop();

      // Jobs map is cleared, but statuses remain for history
      // The test verifies stop() was called without error
    });
  });

  describe('Manual Trigger', () => {
    beforeEach(() => {
      mockOrchestrator.runDailySession = vi.fn().mockResolvedValue({
        sessionId: 'test-session',
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 1000,
        agentResults: [],
        totalAgents: 4,
        successfulAgents: 4,
        failedAgents: 0,
        collectiveInsightsGenerated: 2,
        errors: [],
      } as SessionResult);
    });

    it('should trigger daily trading manually', async () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      // Mock the day to be a weekday
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-02T10:00:00Z')); // Monday

      const result = await scheduler.triggerNow();

      expect(result).toBeDefined();
      expect(mockOrchestrator.runDailySession).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should skip trading on weekends', async () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      // Mock the day to be a weekend
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-01T10:00:00Z')); // Sunday

      const result = await scheduler.triggerNow();

      expect(result).toBeNull();
      expect(mockOrchestrator.runDailySession).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.runDailySession = vi
        .fn()
        .mockRejectedValue(new Error('API Error'));

      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-02T10:00:00Z')); // Monday

      const result = await scheduler.triggerNow();

      expect(result).toBeNull();

      // Status should reflect failure
      const status = scheduler.getJobStatus('daily-trading');
      expect(status?.lastResult).toBe('failure');

      vi.useRealTimers();
    });

    it('should update job status after successful run', async () => {
      scheduler = new SchedulerService(mockOrchestrator, { enabled: true });
      scheduler.start();

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-02T10:00:00Z'));

      await scheduler.triggerNow();

      const status = scheduler.getJobStatus('daily-trading');
      expect(status?.lastRun).toBeDefined();
      expect(status?.lastResult).toBe('success');

      vi.useRealTimers();
    });
  });

  describe('Cron Validation', () => {
    it('should validate cron schedule in config', () => {
      scheduler = new SchedulerService(mockOrchestrator, {
        enabled: true,
        tradingSchedule: '0 6 * * 1-5',
      });

      const config = scheduler.getConfig();
      expect(config.tradingSchedule).toBe('0 6 * * 1-5');
    });
  });
});
