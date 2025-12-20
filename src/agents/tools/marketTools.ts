/**
 * Market Tools
 * Tools for market overview, stock discovery, and market movers
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { MarketIntelligenceService } from '../../services/marketIntelligence/index.js';
import {
  emptyInputSchema,
  discoverStocksInputSchema,
  marketMoversInputSchema,
} from '../schemas.js';

export interface MarketToolsDeps {
  marketIntelligence: MarketIntelligenceService;
  agentName: string;
}

/**
 * Creates market intelligence tools
 */
export function createMarketTools(deps: MarketToolsDeps) {
  const { marketIntelligence, agentName } = deps;

  return {
    getMarketOverview: tool({
      description:
        'Get real-time market overview including market status, sentiment, volatility, and top movers. Use this to understand current market conditions before making decisions.',
      inputSchema: emptyInputSchema,
      execute: async () => {
        Logger.info(`${agentName} getting market overview`);

        const context = await marketIntelligence.buildTradingContext();

        return {
          marketStatus: context.conditions.marketStatus,
          sentiment: context.conditions.sentiment,
          volatility: context.conditions.volatility,
          tradingRecommended: context.conditions.tradingRecommended,
          summary: context.conditions.summary,
          topGainers: context.movers.gainers.slice(0, 5).map((m) => ({
            symbol: m.symbol,
            change: m.changePercent,
            reason: m.reason,
          })),
          topLosers: context.movers.losers.slice(0, 5).map((m) => ({
            symbol: m.symbol,
            change: m.changePercent,
            reason: m.reason,
          })),
          breakingNews: context.newsHighlights.slice(0, 3),
        };
      },
    }),

    discoverStocks: tool({
      description:
        'Discover new investment opportunities. Use "theme" to find stocks in a sector (e.g., AI, electric vehicles, cybersecurity). Use "trending" to find stocks making news today. This helps you find stocks you may not know from your training data.',
      inputSchema: discoverStocksInputSchema,
      execute: async ({ mode, theme, limit }) => {
        Logger.info(
          `${agentName} discovering stocks: mode=${mode}, theme=${theme || 'N/A'}`
        );

        if (mode === 'theme') {
          if (!theme) {
            return { error: 'Theme is required when mode is "theme"' };
          }
          const stocks = await marketIntelligence.discoverStocksByTheme(
            theme,
            limit || 10
          );
          return {
            mode: 'theme',
            theme,
            stocksFound: stocks.length,
            stocks: stocks.map((s) => ({
              symbol: s.symbol,
              company: s.name,
              reason: s.reason,
              source: s.source,
            })),
          };
        } else {
          const stocks = await marketIntelligence.getTrendingStocks(
            limit || 10
          );
          return {
            mode: 'trending',
            stocksFound: stocks.length,
            stocks: stocks.map((s) => ({
              symbol: s.symbol,
              company: s.name,
              reason: s.reason,
              source: s.source,
            })),
          };
        }
      },
    }),

    getMarketMovers: tool({
      description:
        "Get today's top gaining and losing stocks. Useful for momentum-based strategies and understanding market direction.",
      inputSchema: marketMoversInputSchema,
      execute: async ({ type = 'both', limit = 5 }) => {
        Logger.info(`${agentName} getting market movers: type=${type}`);

        const movers = await marketIntelligence.getMarketMovers();

        const formatMovers = (list: typeof movers.gainers) =>
          list.slice(0, limit).map((m) => ({
            symbol: m.symbol,
            change: m.changePercent,
            reason: m.reason,
          }));

        if (type === 'gainers') {
          return { gainers: formatMovers(movers.gainers) };
        } else if (type === 'losers') {
          return { losers: formatMovers(movers.losers) };
        } else {
          return {
            gainers: formatMovers(movers.gainers),
            losers: formatMovers(movers.losers),
          };
        }
      },
    }),
  };
}
