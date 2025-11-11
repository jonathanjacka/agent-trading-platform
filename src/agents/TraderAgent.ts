import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { ResearcherAgent } from './ResearcherAgent.js';
import { Logger } from '../utils/logger.js';

export class TraderAgent {
  private modelName: string;
  private name: string;
  private strategy: string;
  private instructions: string;
  private researcherAgent: ResearcherAgent;

  constructor(
    name: string,
    strategy: string,
    modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  ) {
    this.name = name;
    this.strategy = strategy;
    this.modelName = modelName;
    this.researcherAgent = new ResearcherAgent(modelName);
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
        description: 'Get current portfolio holdings and cash balance',
        inputSchema: z.object({}),
        execute: async () => {
          Logger.portfolio(this.name, 'Checking portfolio');
          return {
            cash: 10000,
            holdings: {
              AAPL: { shares: 10, avgPrice: 150 },
              MSFT: { shares: 5, avgPrice: 300 },
            },
            totalValue: 12500,
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
          Logger.buyOrder(this.name, quantity, symbol, rationale);

          const mockPrice = 150 + Math.random() * 50;
          return {
            status: 'executed',
            symbol,
            quantity,
            price: mockPrice,
            total: mockPrice * quantity,
            rationale,
            timestamp: new Date().toISOString(),
          };
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
          Logger.sellOrder(this.name, quantity, symbol, rationale);

          const mockPrice = 150 + Math.random() * 50;
          return {
            status: 'executed',
            symbol,
            quantity,
            price: mockPrice,
            total: mockPrice * quantity,
            rationale,
            timestamp: new Date().toISOString(),
          };
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
