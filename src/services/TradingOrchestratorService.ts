import { TraderAgent } from '../agents/TraderAgent.js';
import { MemoryService } from './MemoryService.js';
import { PushoverService } from './PushoverService.js';
import { DatabaseService } from './DatabaseService.js';
import { Logger } from '../utils/logger.js';

export interface AgentResult {
  agentName: string;
  success: boolean;
  response?: string;
  error?: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

export interface SessionResult {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  agentResults: AgentResult[];
  totalAgents: number;
  successfulAgents: number;
  failedAgents: number;
  collectiveInsightsGenerated: number;
  errors: string[];
}

export interface SessionOptions {
  /** Specific agents to run (default: all) */
  agents?: string[];
  /** Delay between agents in ms (default: 90000 = 90 seconds) */
  delayBetweenAgentsMs?: number;
  /** Custom prompts per agent (default: use built-in daily prompts) */
  customPrompts?: Record<string, string>;
  /** Skip collective insights generation (default: false) */
  skipInsights?: boolean;
  /** Dry run - log but don't execute (default: false) */
  dryRun?: boolean;
}

const DAILY_PROMPTS: Record<string, string> = {
  leonardo: `It's time for your daily trading session. 

1. First, review your current portfolio to understand your positions
2. Check your past memories and any collective lessons from other agents
3. Research current market conditions for stocks you hold or are interested in
4. Based on your value investing strategy, decide whether to:
   - BUY: If you find quality companies trading below intrinsic value
   - SELL: If any holdings no longer meet your criteria
   - HOLD: If current positions align with your long-term thesis

Make thoughtful decisions aligned with your patient, value-oriented approach.`,

  michelangelo: `It's time for your daily trading session.

1. First, review your current portfolio positions
2. Check your memories and collective insights from other traders
3. Research the latest in disruptive technology and innovation trends
4. Based on your aggressive tech-focused strategy, decide whether to:
   - BUY: If you spot emerging tech opportunities with high growth potential
   - SELL: If any holdings have lost their innovative edge
   - HOLD: If positions still align with disruptive innovation thesis

Be bold but informed. Look for the next big technological breakthrough.`,

  raphael: `It's time for your daily trading session.

1. Review your current portfolio and cash position
2. Check your memories and learn from collective agent insights
3. Research macro conditions: economic data, geopolitical events, market sentiment
4. Based on your contrarian macro strategy, decide whether to:
   - BUY: If you see significant mispricings against market sentiment
   - SELL: If macro thesis has played out or changed
   - HOLD: If waiting for better entry points

Take bold contrarian positions when your analysis reveals market imbalances.`,

  donatello: `It's time for your daily trading session.

1. Review your portfolio allocation and current balance
2. Check your memories and collective insights
3. Analyze macro indicators: interest rates, inflation, sector performance
4. Based on your risk parity approach, decide whether to:
   - BUY: To rebalance or add diversified positions
   - SELL: To reduce concentration or rebalance
   - HOLD: If allocation matches your target balance

Focus on systematic diversification and risk management across market conditions.`,
};

export class TradingOrchestratorService {
  private memoryService: MemoryService;
  private pushoverService: PushoverService;
  private db: DatabaseService;

  constructor(private traders: Map<string, TraderAgent>) {
    this.memoryService = MemoryService.getInstance();
    this.pushoverService = new PushoverService();
    this.db = DatabaseService.getInstance();
  }

  async runDailySession(
    options: SessionOptions = {},
    jobName: string = 'manual'
  ): Promise<SessionResult> {
    const {
      agents = Array.from(this.traders.keys()),
      delayBetweenAgentsMs = 90_000, // 90 seconds default
      customPrompts = {},
      skipInsights = false,
      dryRun = false,
    } = options;

    const sessionId = this.generateSessionId();
    const startTime = new Date();
    const agentResults: AgentResult[] = [];
    const errors: string[] = [];

    // Log session start to database (unless dry run)
    if (!dryRun) {
      this.db.createSchedulerRun(sessionId, jobName);
    }

    Logger.section(`Trading Session ${sessionId}`);
    Logger.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    Logger.info(`Agents: ${agents.join(', ')}`);
    Logger.info(`Delay between agents: ${delayBetweenAgentsMs / 1000}s`);

    // Run each agent sequentially
    for (let i = 0; i < agents.length; i++) {
      const agentName = agents[i];
      const trader = this.traders.get(agentName.toLowerCase());

      if (!trader) {
        const error = `Agent not found: ${agentName}`;
        Logger.error(error);
        errors.push(error);
        continue;
      }

      const prompt =
        customPrompts[agentName] || DAILY_PROMPTS[agentName.toLowerCase()];

      if (!prompt) {
        const error = `No prompt available for agent: ${agentName}`;
        Logger.error(error);
        errors.push(error);
        continue;
      }

      const result = await this.runSingleAgent(
        trader,
        agentName,
        prompt,
        dryRun
      );
      agentResults.push(result);

      if (!result.success) {
        errors.push(`${agentName}: ${result.error}`);
      }

      // Delay before next agent (except after last one)
      if (i < agents.length - 1 && !dryRun) {
        Logger.info(
          `Waiting ${delayBetweenAgentsMs / 1000}s before next agent...`
        );
        await this.sleep(delayBetweenAgentsMs);
      }
    }

    // Generate collective insights after all trades
    let collectiveInsightsGenerated = 0;
    if (!skipInsights && !dryRun) {
      Logger.info('Generating collective insights...');
      try {
        collectiveInsightsGenerated =
          await this.memoryService.generateCollectiveInsights();
        Logger.success(
          `Generated ${collectiveInsightsGenerated} collective insights`
        );
      } catch (error) {
        const errorMsg = `Failed to generate collective insights: ${error instanceof Error ? error.message : 'Unknown error'}`;
        Logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const endTime = new Date();
    const successfulAgents = agentResults.filter((r) => r.success).length;
    const failedAgents = agentResults.filter((r) => !r.success).length;

    const sessionResult: SessionResult = {
      sessionId,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      agentResults,
      totalAgents: agentResults.length,
      successfulAgents,
      failedAgents,
      collectiveInsightsGenerated,
      errors,
    };

    // Update session in database (unless dry run)
    if (!dryRun) {
      this.db.updateSchedulerRun(sessionId, {
        status: failedAgents === 0 ? 'success' : 'failure',
        completedAt: endTime.toISOString(),
        totalAgents: agentResults.length,
        successfulAgents,
        failedAgents,
        collectiveInsightsGenerated,
        durationMs: sessionResult.durationMs,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
        resultsJson: JSON.stringify(sessionResult),
      });
    }

    // Log summary
    Logger.section('Session Complete');
    Logger.info(`Duration: ${(sessionResult.durationMs / 1000).toFixed(1)}s`);
    Logger.info(
      `Agents: ${successfulAgents}/${agentResults.length} successful`
    );
    if (collectiveInsightsGenerated > 0) {
      Logger.info(`Collective insights: ${collectiveInsightsGenerated}`);
    }
    if (errors.length > 0) {
      Logger.warn(`Errors: ${errors.length}`);
    }

    // Send notification summary
    await this.sendSessionNotification(sessionResult);

    return sessionResult;
  }

  private async runSingleAgent(
    trader: TraderAgent,
    agentName: string,
    prompt: string,
    dryRun: boolean
  ): Promise<AgentResult> {
    const startTime = new Date();

    Logger.section(`${agentName}'s Trading Session`);

    if (dryRun) {
      Logger.info(
        `[DRY RUN] Would execute with prompt: ${prompt.substring(0, 100)}...`
      );
      const endTime = new Date();
      return {
        agentName,
        success: true,
        response: '[DRY RUN] No trade executed',
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    }

    try {
      const response = await trader.trade(prompt);
      const endTime = new Date();

      Logger.success(`${agentName} completed successfully`);

      return {
        agentName,
        success: true,
        response,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    } catch (error) {
      const endTime = new Date();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      Logger.error(`${agentName} failed: ${errorMessage}`);

      return {
        agentName,
        success: false,
        error: errorMessage,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      };
    }
  }

  private async sendSessionNotification(result: SessionResult): Promise<void> {
    const emoji = result.failedAgents === 0 ? '✅' : '⚠️';
    const status =
      result.failedAgents === 0 ? 'Complete' : 'Completed with errors';

    const message = [
      `${emoji} Trading Session ${status}`,
      ``,
      `Duration: ${(result.durationMs / 1000 / 60).toFixed(1)} min`,
      `Agents: ${result.successfulAgents}/${result.totalAgents} successful`,
      result.collectiveInsightsGenerated > 0
        ? `Insights: ${result.collectiveInsightsGenerated} generated`
        : '',
      result.errors.length > 0 ? `Errors: ${result.errors.length}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.pushoverService.sendNotification(message);
  }

  private generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `session_${date}_${time}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getAvailableAgents(): string[] {
    return Array.from(this.traders.keys());
  }

  getDefaultPrompt(agentName: string): string | undefined {
    return DAILY_PROMPTS[agentName.toLowerCase()];
  }
}
