import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Logger } from '../utils/logger.js';

export class ResearcherAgent {
  private modelName: string;
  private instructions: string;

  constructor(modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini') {
    this.modelName = modelName;
    this.instructions = `You are a financial researcher with expertise in market analysis.
Your role is to:
- Search for and analyze financial news and market information
- Identify trading opportunities and risks
- Provide clear, concise summaries of your findings
- Focus on factual information and avoid speculation

When researching:
1. Look for recent news and developments
2. Consider multiple perspectives
3. Highlight key facts that could impact trading decisions
4. Be concise but thorough

Current datetime: ${new Date().toISOString()}`;
  }

  private getTools() {
    return {
      searchWeb: tool({
        description:
          'Search the web for financial news and market information.',
        inputSchema: z.object({
          query: z
            .string()
            .describe('The search query for financial information'),
        }),
        execute: async ({ query }) => {
          Logger.search(query);

          return {
            results: [
              {
                title: `Market Analysis: ${query}`,
                snippet: `Recent developments regarding ${query} show mixed signals.`,
                source: 'Financial Times',
              },
              {
                title: `${query} - Latest Updates`,
                snippet: `Industry experts weigh in on ${query} with varying perspectives.`,
                source: 'Bloomberg',
              },
            ],
            summary: `Found 2 relevant results about ${query}`,
          };
        },
      }),
      analyzeCompany: tool({
        description: 'Get basic information about a company',
        inputSchema: z.object({
          symbol: z.string().describe('The stock ticker symbol'),
        }),
        execute: async ({ symbol }) => {
          Logger.analysis(symbol);

          return {
            symbol,
            sector: 'Technology',
            marketCap: '$2.5T',
            recentPerformance: 'up 3.2% this month',
            sentiment: 'positive',
            keyPoints: [
              'Strong quarterly earnings',
              'Expanding into new markets',
              'Competitive pressure increasing',
            ],
          };
        },
      }),
    };
  }

  async research(query: string): Promise<string> {
    Logger.researcherAction('Starting research', `Query: "${query}"`);

    const result = await generateText({
      model: openai(this.modelName),
      system: this.instructions,
      prompt: query,
      tools: this.getTools(),
      stopWhen: stepCountIs(10),
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
