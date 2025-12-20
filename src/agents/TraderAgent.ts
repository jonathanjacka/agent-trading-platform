import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { ResearcherAgent } from './ResearcherAgent.js';
import { Logger } from '../utils/logger.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { BraveSearchService } from '../services/BraveSearchService.js';
import { AccountService } from '../services/AccountService.js';
import { MemoryService } from '../services/MemoryService.js';

export class TraderAgent {
  private modelName: string;
  private name: string;
  private strategy: string;
  private instructions: string;
  private researcherAgent: ResearcherAgent;
  private accountService: AccountService;
  private memoryService: MemoryService;
  private currentPrompt: string | undefined;

  constructor(
    name: string,
    strategy: string,
    accountService: AccountService,
    marketData: MarketDataService,
    braveSearch: BraveSearchService,
    modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  ) {
    this.name = name;
    this.strategy = strategy;
    this.modelName = modelName;
    this.accountService = accountService;
    this.memoryService = MemoryService.getInstance();
    this.researcherAgent = new ResearcherAgent(
      marketData,
      braveSearch,
      modelName
    );

    this.instructions = `You are ${this.name}, an autonomous stock trader.

Your trading strategy:
${this.strategy}

Your responsibilities:
- Analyze market conditions using available research tools
- Make informed trading decisions aligned with your strategy
- Manage risk appropriately
- Provide clear rationale for your decisions

Available tools:
- researcher: Use this to gather market information and news
- getPortfolio: Check current holdings and cash balance
- buyStock: Execute a buy order
- sellStock: Execute a sell order
- reviewMemories: Review your past trading experiences and lessons learned
- reviewCollectiveLessons: Learn from insights discovered by other agents
- recordLesson: Manually record an important insight or lesson

Guidelines:
1. Always research before making trading decisions
2. Consider your strategy when evaluating opportunities
3. Review your memories and collective lessons to learn from past experiences
4. Record important insights when you discover patterns or lessons
5. Explain your reasoning clearly
6. Be decisive but not reckless

Current datetime: ${new Date().toISOString()}`;
  }

  private getTools() {
    return {
      researcher: this.researcherAgent.getAsTool(),

      getPortfolio: tool({
        description:
          'Get current portfolio holdings with real-time valuations and cash balance',
        inputSchema: z.object({}),
        execute: async () => {
          Logger.portfolio(this.name, 'Checking portfolio');

          const portfolio = await this.accountService.getPortfolio(this.name);

          return {
            cash: portfolio.cash,
            holdings: portfolio.holdings.map((h) => ({
              symbol: h.symbol,
              shares: h.quantity,
              avgPrice: h.avgPrice,
              currentPrice: h.currentPrice,
              currentValue: h.currentValue,
              gain: h.gain,
              gainPercent: `${h.gainPercent.toFixed(2)}%`,
            })),
            totalHoldingsValue: portfolio.totalHoldingsValue,
            totalValue: portfolio.totalValue,
            totalGain: portfolio.totalGain,
            totalGainPercent: `${portfolio.totalGainPercent.toFixed(2)}%`,
          };
        },
      }),

      buyStock: tool({
        description:
          'Buy shares of a stock. Provide the symbol, quantity, and rationale.',
        inputSchema: z.object({
          symbol: z.string().describe('Stock ticker symbol'),
          quantity: z.number().positive().describe('Number of shares to buy'),
          rationale: z
            .string()
            .describe('Reason for buying, aligned with your strategy'),
        }),
        execute: async ({ symbol, quantity, rationale }) => {
          const result = await this.accountService.buyStock(
            this.name,
            symbol,
            quantity,
            rationale,
            this.currentPrompt
          );

          if (!result.success) {
            Logger.warn(`Buy order failed: ${result.message}`);
          } else {
            await this.accountService.recordPortfolioSnapshot(this.name);
          }

          return result;
        },
      }),

      sellStock: tool({
        description:
          'Sell shares of a stock. Provide the symbol, quantity, and rationale.',
        inputSchema: z.object({
          symbol: z.string().describe('Stock ticker symbol'),
          quantity: z.number().positive().describe('Number of shares to sell'),
          rationale: z
            .string()
            .describe('Reason for selling, aligned with your strategy'),
        }),
        execute: async ({ symbol, quantity, rationale }) => {
          const result = await this.accountService.sellStock(
            this.name,
            symbol,
            quantity,
            rationale,
            this.currentPrompt
          );

          if (!result.success) {
            Logger.warn(`Sell order failed: ${result.message}`);
          } else {
            await this.accountService.recordPortfolioSnapshot(this.name);
          }

          return result;
        },
      }),

      reviewMemories: tool({
        description:
          'Review your past trading experiences, successes, and failures. Use this to learn from your history.',
        inputSchema: z.object({
          memoryType: z
            .enum(['successful_trade', 'failed_trade', 'all'])
            .optional()
            .describe(
              'Filter by memory type. Defaults to all if not specified.'
            ),
          minConfidence: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe(
              'Minimum confidence score (0-1). Higher scores indicate more reliable memories.'
            ),
          limit: z
            .number()
            .positive()
            .optional()
            .describe(
              'Maximum number of memories to retrieve. Defaults to 10.'
            ),
        }),
        execute: async ({ memoryType, minConfidence, limit }) => {
          Logger.info(
            `${this.name} reviewing memories: type=${memoryType || 'all'}, minConfidence=${minConfidence || 0}`
          );

          const memories = this.memoryService.getAgentMemories(this.name, {
            memoryType: memoryType === 'all' ? undefined : memoryType,
            minConfidence: minConfidence || 0.3,
            limit: limit || 10,
          });

          if (memories.length === 0) {
            return {
              message: 'No memories found matching your criteria.',
              memories: [],
            };
          }

          return {
            message: `Found ${memories.length} relevant memories`,
            memories: memories.map((m) => ({
              type: m.memory_type,
              content: m.content,
              confidence: m.confidence,
              usageCount: m.use_count,
              successRate:
                m.use_count > 0
                  ? (m.success_count / m.use_count).toFixed(2)
                  : 'N/A',
              createdAt: m.created_at,
              tags: m.tags,
            })),
          };
        },
      }),

      reviewCollectiveLessons: tool({
        description:
          'Review insights and patterns discovered by other agents. Learn from collective wisdom.',
        inputSchema: z.object({
          insightType: z
            .enum(['popular_stock', 'common_error', 'all'])
            .optional()
            .describe('Filter by insight type. Defaults to all.'),
          minConfidence: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Minimum confidence score (0-1).'),
          limit: z
            .number()
            .positive()
            .optional()
            .describe('Maximum number of insights to retrieve.'),
        }),
        execute: async ({ insightType, minConfidence, limit }) => {
          Logger.info(
            `${this.name} reviewing collective lessons: type=${insightType || 'all'}`
          );

          const insights = this.memoryService.getCollectiveInsights({
            insightType: insightType === 'all' ? undefined : insightType,
            minConfidence: minConfidence || 0.5,
            limit: limit || 10,
            excludeAgent: this.name, // Don't include insights you contributed to
          });

          if (insights.length === 0) {
            return {
              message:
                'No collective insights found. Other agents may not have traded yet.',
              insights: [],
            };
          }

          return {
            message: `Found ${insights.length} collective insights from other agents`,
            insights: insights.map((i) => ({
              type: i.insight_type,
              content: i.content,
              confidence: i.confidence,
              evidenceCount: i.evidence_count,
              contributingAgents: i.contributing_agents,
              tags: i.tags,
              createdAt: i.created_at,
            })),
          };
        },
      }),

      recordLesson: tool({
        description:
          "Manually record an important insight, pattern, or lesson you've learned. Use this when you discover something significant.",
        inputSchema: z.object({
          content: z
            .string()
            .describe('The insight or lesson you want to remember'),
          tags: z
            .array(z.string())
            .optional()
            .describe(
              'Optional tags to categorize this lesson (e.g., ["AAPL", "earnings"])'
            ),
        }),
        execute: async ({ content, tags }) => {
          Logger.info(
            `${this.name} recording lesson: ${content.substring(0, 50)}...`
          );

          const memoryId = this.memoryService.storeMemory(
            this.name,
            'manual_insight',
            content,
            undefined,
            0.7, // Start with high confidence for manual insights
            tags || []
          );

          return {
            success: true,
            message: `Lesson recorded successfully (ID: ${memoryId})`,
            memoryId,
          };
        },
      }),
    };
  }

  async trade(prompt: string): Promise<string> {
    this.currentPrompt = prompt;
    Logger.traderAction(this.name, 'Starting trading session');
    Logger.trader(this.name, `Strategy: ${this.strategy}`);

    const result = await generateText({
      model: openai(this.modelName),
      system: this.instructions,
      prompt,
      tools: this.getTools(),
      stopWhen: stepCountIs(20),
      experimental_telemetry: {
        isEnabled: true,
        functionId: `trader-${this.name}`,
        metadata: {
          agentName: this.name,
          agentType: 'trader',
        },
      },
    });

    Logger.traderAction(
      this.name,
      'Trading session complete',
      `Steps: ${result.steps.length}`
    );

    return result.text;
  }

  getInfo() {
    return {
      name: this.name,
      strategy: this.strategy,
      model: this.modelName,
    };
  }
}
