import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Logger } from '../utils/logger.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { BraveSearchService } from '../services/BraveSearchService.js';

export class ResearcherAgent {
  private modelName: string;
  private instructions: string;
  private marketData: MarketDataService;
  private braveSearch: BraveSearchService;

  constructor(
    marketData: MarketDataService,
    braveSearch: BraveSearchService,
    modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  ) {
    this.modelName = modelName;
    this.marketData = marketData;
    this.braveSearch = braveSearch;
    this.instructions = `You are a financial researcher with expertise in market analysis.
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
6. Be concise but thorough

Current datetime: ${new Date().toISOString()}`;
  }

  private getTools() {
    return {
      searchFinancialNews: tool({
        description:
          'Search for recent financial news about a stock. Returns articles with sentiment analysis.',
        inputSchema: z.object({
          symbol: z
            .string()
            .describe('The stock ticker symbol (e.g., AAPL, MSFT)'),
          limit: z
            .number()
            .optional()
            .default(5)
            .describe('Number of news articles to retrieve (default 5)'),
        }),
        execute: async ({ symbol, limit }) => {
          Logger.search(`${symbol} news (limit: ${limit})`);

          try {
            const news = await this.marketData.getStockNews(symbol, limit);

            if (news.length === 0) {
              return {
                results: [],
                summary: `No recent news found for ${symbol}`,
              };
            }

            return {
              results: news.map((article) => ({
                title: article.title,
                description: article.description,
                publisher: article.publisher,
                publishedDate: article.publishedDate,
                articleUrl: article.articleUrl,
                sentiment: article.insights?.[0]?.sentiment || 'neutral',
                sentimentReasoning:
                  article.insights?.[0]?.sentiment_reasoning || '',
              })),
              summary: `Found ${news.length} recent articles about ${symbol}`,
            };
          } catch (error) {
            Logger.error(`Failed to fetch news for ${symbol}`, error);
            return {
              results: [],
              summary: `Error fetching news for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        },
      }),
      searchWeb: tool({
        description:
          'Search the web for general market information, industry trends, competitor analysis, or economic news. Use this for broader context beyond stock-specific news.',
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'The search query (e.g., "AI chip industry trends", "Federal Reserve interest rate policy")'
            ),
          count: z
            .number()
            .optional()
            .default(5)
            .describe('Number of results to retrieve (default 5)'),
          freshness: z
            .enum(['pd', 'pw', 'pm', 'py'])
            .optional()
            .describe(
              'Time filter: pd=past day, pw=past week, pm=past month, py=past year'
            ),
        }),
        execute: async ({ query, count, freshness }) => {
          Logger.search(`Web: "${query}" (count: ${count})`);

          try {
            const results = await this.braveSearch.search(query, {
              count,
              freshness,
            });

            const webResults = results.web?.results || [];
            const newsResults = results.news?.results || [];

            if (webResults.length === 0 && newsResults.length === 0) {
              return {
                results: [],
                summary: `No results found for "${query}"`,
              };
            }

            const combined = [
              ...webResults.map((r) => ({
                title: r.title,
                description: r.description,
                url: r.url,
                type: 'web' as const,
                age: r.age,
              })),
              ...newsResults.map((r) => ({
                title: r.title,
                description: r.description,
                url: r.url,
                type: 'news' as const,
                source: r.source,
                age: r.age,
                breaking: r.breaking,
              })),
            ];

            return {
              results: combined,
              summary: `Found ${webResults.length} web results and ${newsResults.length} news articles for "${query}"`,
              queryAltered: results.query.altered
                ? `Query was corrected to: "${results.query.altered}"`
                : undefined,
            };
          } catch (error) {
            Logger.error(`Failed to search web for "${query}"`, error);
            return {
              results: [],
              summary: `Error searching web: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        },
      }),
      analyzeCompany: tool({
        description:
          'Get comprehensive company information including fundamentals, sector, market cap, and more.',
        inputSchema: z.object({
          symbol: z
            .string()
            .describe('The stock ticker symbol (e.g., AAPL, MSFT)'),
        }),
        execute: async ({ symbol }) => {
          Logger.analysis(symbol);

          try {
            const details = await this.marketData.getCompanyDetails(symbol);
            const price = await this.marketData.getEstimatedPrice(symbol);

            return {
              symbol: details.symbol,
              name: details.name,
              description: details.description,
              sector: details.sector,
              marketCap: `$${(details.marketCap / 1e9).toFixed(2)}B`,
              estimatedPrice: `$${price.estimatedPrice.toFixed(2)}`,
              employees: details.employees.toLocaleString(),
              exchange: details.exchange,
              homepage: details.homepage,
              active: details.active,
              note: price.note,
            };
          } catch (error) {
            Logger.error(`Failed to analyze ${symbol}`, error);
            return {
              symbol,
              error: `Unable to fetch company details: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
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
