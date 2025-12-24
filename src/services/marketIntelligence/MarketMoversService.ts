/**
 * MarketMoversService
 * Identifies top gainers, losers, and most active stocks
 */

import { Logger } from '../../utils/logger.js';
import { MarketDataService } from '../marketData/index.js';
import { BraveSearchService } from '../BraveSearchService.js';
import { MarketMover } from './types.js';
import {
  FALSE_POSITIVE_TICKERS,
  TICKER_WITH_PERCENT_PATTERN,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_MOVERS_LIMIT,
  DEFAULT_NEWS_COUNT,
  GAINERS_QUERY,
  LOSERS_QUERY,
} from './constants.js';

export class MarketMoversService {
  private marketData: MarketDataService;
  private braveSearch: BraveSearchService;
  private cache: {
    data: { gainers: MarketMover[]; losers: MarketMover[] };
    timestamp: number;
  } | null = null;

  constructor(marketData: MarketDataService, braveSearch: BraveSearchService) {
    this.marketData = marketData;
    this.braveSearch = braveSearch;
  }

  /**
   * Get today's market movers (top gainers and losers)
   * Uses news search since Polygon Starter doesn't have snapshot endpoints
   */
  async getMovers(): Promise<{
    gainers: MarketMover[];
    losers: MarketMover[];
  }> {
    // Check cache
    if (
      this.cache &&
      Date.now() - this.cache.timestamp < DEFAULT_CACHE_TTL_MS
    ) {
      return this.cache.data;
    }

    Logger.info('Fetching market movers...');

    try {
      // Search for gainers and losers in parallel
      const [gainerNews, loserNews] = await Promise.all([
        this.braveSearch.searchNews(GAINERS_QUERY, {
          count: DEFAULT_NEWS_COUNT,
          freshness: 'pd',
        }),
        this.braveSearch.searchNews(LOSERS_QUERY, {
          count: DEFAULT_NEWS_COUNT,
          freshness: 'pd',
        }),
      ]);

      // Extract movers from results
      const [gainers, losers] = await Promise.all([
        this.extractMoversFromNews(gainerNews, true),
        this.extractMoversFromNews(loserNews, false),
      ]);

      const result = { gainers, losers };
      this.cache = { data: result, timestamp: Date.now() };

      return result;
    } catch (error) {
      Logger.error('Failed to fetch market movers', error);
      return { gainers: [], losers: [] };
    }
  }

  /**
   * Get only gainers
   */
  async getGainers(
    limit: number = DEFAULT_MOVERS_LIMIT
  ): Promise<MarketMover[]> {
    const { gainers } = await this.getMovers();
    return gainers.slice(0, limit);
  }

  /**
   * Get only losers
   */
  async getLosers(
    limit: number = DEFAULT_MOVERS_LIMIT
  ): Promise<MarketMover[]> {
    const { losers } = await this.getMovers();
    return losers.slice(0, limit);
  }

  /**
   * Extract market movers from news search results
   */
  private async extractMoversFromNews(
    results: any,
    isGainer: boolean
  ): Promise<MarketMover[]> {
    const movers: MarketMover[] = [];
    const seenSymbols = new Set<string>();

    if (results.news?.results) {
      for (const article of results.news.results) {
        const text = `${article.title} ${article.description}`;
        const matches = text.matchAll(TICKER_WITH_PERCENT_PATTERN);

        for (const match of matches) {
          const symbol = match[1];
          const percentStr = match[2];

          if (FALSE_POSITIVE_TICKERS.includes(symbol)) continue;
          if (seenSymbols.has(symbol)) continue;

          // Validate ticker
          const validated = await this.validateTicker(symbol);
          if (validated) {
            seenSymbols.add(symbol);
            const changePercent = parseFloat(percentStr) || 0;

            movers.push({
              symbol,
              name: validated.name,
              price: 0, // Would need real-time data
              changePercent: isGainer
                ? Math.abs(changePercent)
                : -Math.abs(changePercent),
              reason: article.title.substring(0, 60),
            });

            if (movers.length >= 5) break;
          }
        }

        if (movers.length >= 5) break;
      }
    }

    return movers;
  }

  /**
   * Validate a ticker symbol using Polygon API
   */
  private async validateTicker(
    symbol: string
  ): Promise<{ symbol: string; name: string } | null> {
    try {
      const tickers = await this.marketData.searchTickers(symbol, 1);
      if (tickers.length > 0 && tickers[0].ticker === symbol) {
        return {
          symbol,
          name: tickers[0].name || symbol,
        };
      }
    } catch {
      // Invalid ticker
    }
    return null;
  }
}
