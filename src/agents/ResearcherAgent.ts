/**
 * Researcher Agent
 * Specialized agent for financial research and analysis
 */

import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Logger } from '../utils/logger.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { BraveSearchService } from '../services/BraveSearchService.js';
import { createResearchTools } from './tools/index.js';

const RESEARCHER_INSTRUCTIONS = `You are a financial researcher with expertise in market analysis.
Your role is to:
- Search for and analyze financial news and market information
- Research broader market context and industry trends
- Identify trading opportunities and risks
- Provide clear, concise summaries of your findings
- Focus on factual information and avoid speculation

Available tools:
- searchFinancialNews: Get stock-specific news with AI sentiment analysis
- analyzeCompany: Get company fundamentals and financial details
- searchWeb: Research general market context, industry trends, economic news

When researching:
1. Use searchFinancialNews for stock-specific news and sentiment
2. Use analyzeCompany for company fundamentals and valuation
3. Use searchWeb for broader context (industry trends, competitors, economic factors)
4. Consider multiple perspectives and sources
5. Highlight key facts that could impact trading decisions
6. Be concise but thorough`;

export class ResearcherAgent {
  private modelName: string;
  private tools: ReturnType<typeof createResearchTools>;

  constructor(
    marketData: MarketDataService,
    braveSearch: BraveSearchService,
    modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  ) {
    this.modelName = modelName;
    this.tools = createResearchTools({ marketData, braveSearch });
  }

  private getInstructions(): string {
    return `${RESEARCHER_INSTRUCTIONS}

Current datetime: ${new Date().toISOString()}`;
  }

  async research(query: string): Promise<string> {
    Logger.researcherAction('Starting research', `Query: "${query}"`);

    const result = await generateText({
      model: openai(this.modelName),
      system: this.getInstructions(),
      prompt: query,
      tools: this.tools,
      stopWhen: stepCountIs(10),
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'researcher-agent',
        metadata: {
          agentType: 'researcher',
          query,
        },
      },
    });

    Logger.researcherAction(
      'Research complete',
      `Steps: ${result.steps.length}`
    );

    return result.text;
  }

  getAsTool() {
    return tool({
      description:
        'Use this tool to research financial news, market conditions, and company information.',
      inputSchema: z.object({
        query: z.string().describe('The research query or question'),
      }),
      execute: async ({ query }) => {
        const result = await this.research(query);
        return result;
      },
    });
  }
}
