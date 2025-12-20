/**
 * StockDiscoveryService
 * Discovers stocks by theme, trend, or news mentions
 * Allows agents to find stocks they don't know from training data
 */

import { Logger } from '../../utils/logger.js';
import { MarketDataService } from '../MarketDataService.js';
import { BraveSearchService } from '../BraveSearchService.js';
import { DiscoveredStock } from './types.js';
import {
  FALSE_POSITIVE_TICKERS,
  TICKER_PATTERN,
  THEME_SEARCH_TEMPLATE,
  TRENDING_QUERIES,
  DEFAULT_RESULT_LIMIT,
  DEFAULT_NEWS_COUNT,
  MAX_HEADLINES_PER_TICKER,
  ERRORS,
  DISCOVERY_SOURCE,
} from './constants.js';

export class StockDiscoveryService {
  private marketData: MarketDataService;
  private braveSearch: BraveSearchService;

  constructor(marketData: MarketDataService, braveSearch: BraveSearchService) {
    this.marketData = marketData;
    this.braveSearch = braveSearch;
  }

  /**
   * Discover stocks by theme/sector using real-time search
   * Example themes: "AI", "electric vehicles", "renewable energy", "cybersecurity"
   */
  async discoverByTheme(
    theme: string,
    limit: number = DEFAULT_RESULT_LIMIT
  ): Promise<DiscoveredStock[]> {
    Logger.info(`Discovering stocks by theme: ${theme}`);

    const discovered: DiscoveredStock[] = [];
    const seenSymbols = new Set<string>();

    try {
      // Search for stocks related to this theme
      const searchQuery = THEME_SEARCH_TEMPLATE(theme);
      const results = await this.braveSearch.searchWeb(searchQuery, {
        count: DEFAULT_RESULT_LIMIT,
        freshness: 'pm', // Past month for relevance
      });

      if (results.web?.results) {
        for (const result of results.web.results) {
          const text = `${result.title} ${result.description}`;
          const matches = text.matchAll(TICKER_PATTERN);

          for (const match of matches) {
            const symbol = match[1] || match[2] || match[3];

            if (FALSE_POSITIVE_TICKERS.includes(symbol)) continue;
            if (seenSymbols.has(symbol)) continue;

            // Validate it's a real ticker using Polygon
            const validated = await this.validateTicker(symbol);
            if (validated) {
              seenSymbols.add(symbol);
              discovered.push({
                symbol,
                name: validated.name,
                reason: `Found in ${theme} search: "${result.title.substring(0, 50)}..."`,
                source: DISCOVERY_SOURCE.THEME,
              });

              if (discovered.length >= limit) break;
            }
          }

          if (discovered.length >= limit) break;
        }
      }
    } catch (error) {
      Logger.error(`Failed to discover stocks by theme: ${theme}`, error);
    }

    Logger.info(`Discovered ${discovered.length} stocks for theme: ${theme}`);
    return discovered;
  }

  /**
   * Get trending stocks from financial news
   * Extracts tickers mentioned frequently in recent news
   */
  async getTrending(
    limit: number = DEFAULT_RESULT_LIMIT
  ): Promise<DiscoveredStock[]> {
    Logger.info('Discovering trending stocks from news...');

    const tickerMentions = new Map<
      string,
      { count: number; headlines: string[] }
    >();

    try {
      // Search for trending stock news
      for (const query of TRENDING_QUERIES) {
        const results = await this.braveSearch.searchNews(query, {
          count: DEFAULT_NEWS_COUNT,
          freshness: 'pd', // Past day
        });

        if (results.news?.results) {
          for (const article of results.news.results) {
            const text = `${article.title} ${article.description}`;
            const matches = text.matchAll(TICKER_PATTERN);

            for (const match of matches) {
              const symbol = match[1] || match[2] || match[3];
              if (FALSE_POSITIVE_TICKERS.includes(symbol)) continue;

              const existing = tickerMentions.get(symbol) || {
                count: 0,
                headlines: [],
              };
              existing.count++;
              if (existing.headlines.length < MAX_HEADLINES_PER_TICKER) {
                existing.headlines.push(article.title.substring(0, 60));
              }
              tickerMentions.set(symbol, existing);
            }
          }
        }
      }

      // Sort by mention count and validate top results
      const sorted = Array.from(tickerMentions.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit * 2); // Get extra in case some are invalid

      const trending: DiscoveredStock[] = [];

      for (const [symbol, data] of sorted) {
        if (trending.length >= limit) break;

        const validated = await this.validateTicker(symbol);
        if (validated) {
          trending.push({
            symbol,
            name: validated.name,
            reason: data.headlines[0] || ERRORS.TRENDING_IN_NEWS,
            source: DISCOVERY_SOURCE.TRENDING,
            mentionCount: data.count,
          });
        }
      }

      Logger.info(`Found ${trending.length} trending stocks`);
      return trending;
    } catch (error) {
      Logger.error('Failed to get trending stocks', error);
      return [];
    }
  }

  /**
   * Extract tickers from any text content
   * Useful for finding stocks mentioned in news articles
   */
  async extractTickersFromText(
    text: string,
    limit: number = DEFAULT_RESULT_LIMIT
  ): Promise<DiscoveredStock[]> {
    const discovered: DiscoveredStock[] = [];
    const seenSymbols = new Set<string>();
    const matches = text.matchAll(TICKER_PATTERN);

    for (const match of matches) {
      const symbol = match[1] || match[2] || match[3];

      if (FALSE_POSITIVE_TICKERS.includes(symbol)) continue;
      if (seenSymbols.has(symbol)) continue;

      const validated = await this.validateTicker(symbol);
      if (validated) {
        seenSymbols.add(symbol);
        discovered.push({
          symbol,
          name: validated.name,
          reason: ERRORS.EXTRACTED_FROM_TEXT,
          source: DISCOVERY_SOURCE.NEWS,
        });

        if (discovered.length >= limit) break;
      }
    }

    return discovered;
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
