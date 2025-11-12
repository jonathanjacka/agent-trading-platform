import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { ResearcherAgent } from './ResearcherAgent.js';
import { Logger } from '../utils/logger.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { BraveSearchService } from '../services/BraveSearchService.js';

export class TraderAgent {
  private modelName: string;
  private name: string;
  private strategy: string;
  private instructions: string;
  private researcherAgent: ResearcherAgent;
  private marketData: MarketDataService;
  private portfolio: {
    cash: number;
    holdings: Record<string, { shares: number; avgPrice: number }>;
  };

  constructor(
    name: string,
    strategy: string,
    marketData: MarketDataService,
    braveSearch: BraveSearchService,
    modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  ) {
    this.name = name;
    this.strategy = strategy;
    this.modelName = modelName;
    this.marketData = marketData;
    this.researcherAgent = new ResearcherAgent(
      marketData,
      braveSearch,
      modelName
    );

    // Initialize portfolio (mock data for now, will be database-backed later)
    this.portfolio = {
      cash: 10000,
      holdings: {
        AAPL: { shares: 10, avgPrice: 150 },
        MSFT: { shares: 5, avgPrice: 300 },
      },
    };

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

          // Calculate real-time portfolio value using current prices
          const holdingsWithValues = await Promise.all(
            Object.entries(this.portfolio.holdings).map(
              async ([symbol, holding]) => {
                try {
                  const priceData =
                    await this.marketData.getEstimatedPrice(symbol);
                  const currentValue =
                    priceData.estimatedPrice * holding.shares;
                  const costBasis = holding.avgPrice * holding.shares;
                  const gainLoss = currentValue - costBasis;
                  const gainLossPercent = (
                    (gainLoss / costBasis) *
                    100
                  ).toFixed(2);

                  return {
                    symbol,
                    shares: holding.shares,
                    avgPrice: holding.avgPrice,
                    currentPrice: priceData.estimatedPrice,
                    currentValue,
                    gainLoss,
                    gainLossPercent: `${gainLossPercent}%`,
                  };
                } catch (error) {
                  Logger.warn(
                    `Failed to get price for ${symbol}, using avg price`
                  );
                  return {
                    symbol,
                    shares: holding.shares,
                    avgPrice: holding.avgPrice,
                    currentPrice: holding.avgPrice,
                    currentValue: holding.avgPrice * holding.shares,
                    gainLoss: 0,
                    gainLossPercent: '0%',
                  };
                }
              }
            )
          );

          const totalHoldingsValue = holdingsWithValues.reduce(
            (sum, h) => sum + h.currentValue,
            0
          );
          const totalValue = totalHoldingsValue + this.portfolio.cash;

          return {
            cash: this.portfolio.cash,
            holdings: holdingsWithValues,
            totalHoldingsValue,
            totalValue,
            note: 'Prices are estimated from market cap, updated daily',
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
