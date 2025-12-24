/**
 * Research Tools
 * Tools for financial news, web search, and company analysis
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { MarketDataService } from '../../services/marketData/index.js';
import { BraveSearchService } from '../../services/BraveSearchService.js';
import {
  searchNewsInputSchema,
  searchWebInputSchema,
  analyzeCompanyInputSchema,
} from '../schemas.js';

export interface ResearchToolsDeps {
  marketData: MarketDataService;
  braveSearch: BraveSearchService;
}

/**
 * Creates research-related tools
 */
export function createResearchTools(deps: ResearchToolsDeps) {
  const { marketData, braveSearch } = deps;

  return {
    searchFinancialNews: tool({
      description:
        'Search for recent financial news about a stock. Returns articles with sentiment analysis.',
      inputSchema: searchNewsInputSchema,
      execute: async ({ symbol, limit }) => {
        Logger.search(`${symbol} news (limit: ${limit})`);

        try {
          const news = await marketData.getStockNews(symbol, limit);

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
      inputSchema: searchWebInputSchema,
      execute: async ({ query, count, freshness }) => {
        Logger.search(`Web: "${query}" (count: ${count})`);

        try {
          const results = await braveSearch.search(query, {
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
      inputSchema: analyzeCompanyInputSchema,
      execute: async ({ symbol }) => {
        Logger.analysis(symbol);

        try {
          const details = await marketData.getCompanyDetails(symbol);
          const price = await marketData.getEstimatedPrice(symbol);

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
