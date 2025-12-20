import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntradayTradingJob } from './IntradayTradingJob.js';
import { TradingOrchestratorService } from '../orchestrator/index.js';
import { MarketIntelligenceService } from '../marketIntelligence/index.js';
import { JobManager } from './JobManager.js';
import { JOB_NAMES } from './types.js';
import {
  MARKET_STATUS,
  SENTIMENT,
  VOLATILITY,
} from '../marketIntelligence/constants.js';

// Mock dependencies
const mockOrchestrator = {
  runDailySession: vi.fn(),
} as unknown as TradingOrchestratorService;

const mockJobManager = {
  scheduleJob: vi.fn(),
  updateJobStatus: vi.fn(),
} as unknown as JobManager;

const mockMarketIntelligence = {
  isMarketOpen: vi.fn(),
  buildTradingContext: vi.fn(),
  formatContextForAgent: vi.fn(),
} as unknown as MarketIntelligenceService;

// Helper to create mock session result
const createMockSessionResult = (
  overrides: Partial<{
    successfulAgents: number;
    failedAgents: number;
  }> = {}
) => ({
  sessionId: 'test-session',
  startTime: new Date(),
  endTime: new Date(),
  durationMs: 1000,
  agentResults: [],
  totalAgents: 4,
  successfulAgents: overrides.successfulAgents ?? 4,
  failedAgents: overrides.failedAgents ?? 0,
  collectiveInsightsGenerated: 0,
  errors: [],
});

// Helper to create mock trading context
const createMockTradingContext = () => ({
  timestamp: new Date().toISOString(),
  conditions: {
    timestamp: new Date().toISOString(),
    marketStatus: MARKET_STATUS.OPEN,
    tradingRecommended: true,
    summary: 'Market is open',
    indices: {},
    sentiment: SENTIMENT.NEUTRAL,
    volatility: VOLATILITY.MODERATE,
  },
  movers: { gainers: [], losers: [] },
  trendingStocks: [],
  newsHighlights: [],
});

describe('IntradayTradingJob', () => {
  let job: IntradayTradingJob;

  beforeEach(() => {
    vi.clearAllMocks();

    job = new IntradayTradingJob(
      mockOrchestrator,
      mockJobManager,
      mockMarketIntelligence
    );
  });

  describe('schedule', () => {
    it('should schedule job with correct parameters', () => {
      vi.mocked(mockJobManager.scheduleJob).mockReturnValue(true);

      const result = job.schedule('0 */30 9-15 * * 1-5');

      expect(result).toBe(true);
      expect(mockJobManager.scheduleJob).toHaveBeenCalledWith({
        name: JOB_NAMES.INTRADAY_TRADING,
        schedule: '0 */30 9-15 * * 1-5',
        timezone: 'America/New_York',
        executor: expect.any(Function),
      });
    });

    it('should return false when scheduling fails', () => {
      vi.mocked(mockJobManager.scheduleJob).mockReturnValue(false);

      const result = job.schedule('invalid');

      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should skip execution when market is closed', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(false);

      const result = await job.execute();

      expect(result).toBeNull();
      expect(mockOrchestrator.runDailySession).not.toHaveBeenCalled();
    });

    it('should run trading session when market is open', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockResolvedValue(
        createMockTradingContext()
      );
      vi.mocked(mockMarketIntelligence.formatContextForAgent).mockReturnValue(
        'Market context formatted'
      );
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      const result = await job.execute();

      expect(result).not.toBeNull();
      expect(result?.successfulAgents).toBe(4);
      expect(mockOrchestrator.runDailySession).toHaveBeenCalledWith(
        expect.objectContaining({
          customPrompts: expect.any(Object),
          delayBetweenAgentsMs: 60_000,
        }),
        JOB_NAMES.INTRADAY_TRADING
      );
    });

    it('should update job status to success when no failures', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockResolvedValue(
        createMockTradingContext()
      );
      vi.mocked(mockMarketIntelligence.formatContextForAgent).mockReturnValue(
        ''
      );
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      await job.execute();

      expect(mockJobManager.updateJobStatus).toHaveBeenCalledWith(
        JOB_NAMES.INTRADAY_TRADING,
        'success'
      );
    });

    it('should update job status to failure when there are failures', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockResolvedValue(
        createMockTradingContext()
      );
      vi.mocked(mockMarketIntelligence.formatContextForAgent).mockReturnValue(
        ''
      );
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult({ successfulAgents: 2, failedAgents: 2 })
      );

      await job.execute();

      expect(mockJobManager.updateJobStatus).toHaveBeenCalledWith(
        JOB_NAMES.INTRADAY_TRADING,
        'failure'
      );
    });

    it('should handle orchestrator errors gracefully', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockResolvedValue(
        createMockTradingContext()
      );
      vi.mocked(mockMarketIntelligence.formatContextForAgent).mockReturnValue(
        ''
      );
      vi.mocked(mockOrchestrator.runDailySession).mockRejectedValue(
        new Error('Orchestrator failed')
      );

      const result = await job.execute();

      expect(result).toBeNull();
      expect(mockJobManager.updateJobStatus).toHaveBeenCalledWith(
        JOB_NAMES.INTRADAY_TRADING,
        'failure'
      );
    });

    it('should handle market context build failure gracefully', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockRejectedValue(
        new Error('Context build failed')
      );
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      const result = await job.execute();

      // Should still proceed with fallback context
      expect(result).not.toBeNull();
      expect(mockOrchestrator.runDailySession).toHaveBeenCalled();
    });
  });

  describe('execute without market intelligence', () => {
    beforeEach(() => {
      job = new IntradayTradingJob(mockOrchestrator, mockJobManager, null);
    });

    it('should execute without market intelligence check', async () => {
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      const result = await job.execute();

      expect(result).not.toBeNull();
      expect(mockMarketIntelligence.isMarketOpen).not.toHaveBeenCalled();
    });
  });

  describe('trigger', () => {
    it('should execute when triggered manually', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockResolvedValue(
        createMockTradingContext()
      );
      vi.mocked(mockMarketIntelligence.formatContextForAgent).mockReturnValue(
        ''
      );
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      const result = await job.trigger();

      expect(result).not.toBeNull();
    });

    it('should log warning when market intelligence not available', async () => {
      const jobWithoutIntel = new IntradayTradingJob(
        mockOrchestrator,
        mockJobManager,
        null
      );

      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      const result = await jobWithoutIntel.trigger();

      expect(result).not.toBeNull();
    });
  });

  describe('buildIntradayPrompts', () => {
    it('should include prompts for all agents', async () => {
      vi.mocked(mockMarketIntelligence.isMarketOpen).mockReturnValue(true);
      vi.mocked(mockMarketIntelligence.buildTradingContext).mockResolvedValue(
        createMockTradingContext()
      );
      vi.mocked(mockMarketIntelligence.formatContextForAgent).mockReturnValue(
        'Test market context'
      );
      vi.mocked(mockOrchestrator.runDailySession).mockResolvedValue(
        createMockSessionResult()
      );

      await job.execute();

      const calls = vi.mocked(mockOrchestrator.runDailySession).mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const callArgs = calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.customPrompts).toHaveProperty('leonardo');
      expect(callArgs?.customPrompts).toHaveProperty('michelangelo');
      expect(callArgs?.customPrompts).toHaveProperty('raphael');
      expect(callArgs?.customPrompts).toHaveProperty('donatello');

      // Verify prompts contain market context
      expect(callArgs?.customPrompts?.leonardo).toContain(
        'Test market context'
      );
      expect(callArgs?.customPrompts?.leonardo).toContain(
        'INTRADAY TRADING SESSION'
      );
    });
  });
});
