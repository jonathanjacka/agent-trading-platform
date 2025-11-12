import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { ResearcherAgent } from './ResearcherAgent.js';
import { Logger } from '../utils/logger.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { BraveSearchService } from '../services/BraveSearchService.js';
import { AccountService } from '../services/AccountService.js';

export class TraderAgent {
  private modelName: string;
  private name: string;
  private strategy: string;
  private instructions: string;
  private researcherAgent: ResearcherAgent;
  private accountService: AccountService;

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

Guidelines:
1. Always research before making trading decisions
2. Consider your strategy when evaluating opportunities
3. Explain your reasoning clearly
4. Be decisive but not reckless

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
            rationale
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
            rationale
          );

          if (!result.success) {
            Logger.warn(`Sell order failed: ${result.message}`);
          } else {
            await this.accountService.recordPortfolioSnapshot(this.name);
          }

          return result;
        },
      }),
    };
  }

  async trade(prompt: string): Promise<string> {
    Logger.traderAction(this.name, 'Starting trading session');
    Logger.trader(this.name, `Strategy: ${this.strategy}`);

    const result = await generateText({
      model: openai(this.modelName),
      system: this.instructions,
      prompt,
      tools: this.getTools(),
      stopWhen: stepCountIs(20),
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
