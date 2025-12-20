/**
 * ContextBuilder
 * Aggregates market intelligence into a comprehensive context for agent prompts
 */

import { Logger } from '../../utils/logger.js';
import { BraveSearchService } from '../BraveSearchService.js';
import { MarketConditionsService } from './MarketConditionsService.js';
import { StockDiscoveryService } from './StockDiscoveryService.js';
import { MarketMoversService } from './MarketMoversService.js';
import { TradingContext } from './types.js';
import {
  BREAKING_NEWS_QUERY,
  DEFAULT_NEWS_COUNT,
  MARKET_TIMEZONE,
  DISPLAY,
} from './constants.js';

export class ContextBuilder {
  private conditionsService: MarketConditionsService;
  private discoveryService: StockDiscoveryService;
  private moversService: MarketMoversService;
  private braveSearch: BraveSearchService;

  constructor(
    conditionsService: MarketConditionsService,
    discoveryService: StockDiscoveryService,
    moversService: MarketMoversService,
    braveSearch: BraveSearchService
  ) {
    this.conditionsService = conditionsService;
    this.discoveryService = discoveryService;
    this.moversService = moversService;
    this.braveSearch = braveSearch;
  }

  /**
   * Build comprehensive trading context for agent injection
   * This is the main method that prepares real-time intelligence for agents
   */
  async build(): Promise<TradingContext> {
    Logger.info('Building trading context...');

    const [conditions, movers, trendingStocks] = await Promise.all([
      this.conditionsService.getMarketConditions(),
      this.moversService.getMovers(),
      this.discoveryService.getTrending(5),
    ]);

    // Get news highlights
    const newsHighlights = await this.getNewsHighlights();

    return {
      timestamp: new Date().toISOString(),
      conditions,
      movers,
      trendingStocks,
      newsHighlights,
    };
  }

  /**
   * Build a lighter context (faster, fewer API calls)
   * Useful for frequent polling
   */
  async buildLight(): Promise<
    Pick<TradingContext, 'timestamp' | 'conditions'>
  > {
    const conditions = await this.conditionsService.getMarketConditions();
    return {
      timestamp: new Date().toISOString(),
      conditions,
    };
  }

  /**
   * Get breaking news headlines
   */
  private async getNewsHighlights(): Promise<string[]> {
    try {
      const marketNews = await this.braveSearch.searchNews(
        BREAKING_NEWS_QUERY,
        { count: DEFAULT_NEWS_COUNT, freshness: 'pd' }
      );
      if (marketNews.news?.results) {
        return marketNews.news.results.map((n) => n.title);
      }
    } catch {
      // Non-critical
    }
    return [];
  }

  /**
   * Format trading context as a string for agent prompts
   * Optimized for LLM consumption - no emojis, minimal formatting
   */
  format(context: TradingContext): string {
    const lines: string[] = [];
    const timestamp = new Date(context.timestamp).toLocaleString('en-US', {
      timeZone: MARKET_TIMEZONE,
    });

    lines.push(`\n${DISPLAY.SECTION_DIVIDER}`);
    lines.push(DISPLAY.HEADER_TEMPLATE(timestamp));
    lines.push(`${DISPLAY.SECTION_DIVIDER}\n`);

    // Market Status
    lines.push(
      `${DISPLAY.LABELS.MARKET_STATUS}: ${context.conditions.marketStatus.toUpperCase()}`
    );
    lines.push(
      `  ${DISPLAY.LABELS.SENTIMENT}: ${context.conditions.sentiment.toUpperCase()}`
    );
    lines.push(
      `  ${DISPLAY.LABELS.VOLATILITY}: ${context.conditions.volatility.toUpperCase()}`
    );
    lines.push(
      `  ${DISPLAY.LABELS.TRADING_RECOMMENDED}: ${context.conditions.tradingRecommended ? DISPLAY.TRADING_RECOMMENDED_YES : DISPLAY.TRADING_RECOMMENDED_NO}`
    );
    lines.push(`  ${DISPLAY.LABELS.SUMMARY}: ${context.conditions.summary}\n`);

    // Market Movers
    if (context.movers.gainers.length > 0) {
      lines.push(`${DISPLAY.LABELS.TOP_GAINERS}:`);
      for (const g of context.movers.gainers.slice(0, 3)) {
        lines.push(
          `  - ${g.symbol} (${g.name}): +${g.changePercent.toFixed(1)}%`
        );
      }
      lines.push('');
    }

    if (context.movers.losers.length > 0) {
      lines.push(`${DISPLAY.LABELS.TOP_LOSERS}:`);
      for (const l of context.movers.losers.slice(0, 3)) {
        lines.push(
          `  - ${l.symbol} (${l.name}): ${l.changePercent.toFixed(1)}%`
        );
      }
      lines.push('');
    }

    // Trending Stocks
    if (context.trendingStocks.length > 0) {
      lines.push(`${DISPLAY.LABELS.TRENDING_STOCKS}:`);
      for (const stock of context.trendingStocks.slice(0, 5)) {
        lines.push(`  - ${stock.symbol}: ${stock.reason}`);
      }
      lines.push('');
    }

    // News Highlights
    if (context.newsHighlights.length > 0) {
      lines.push(`${DISPLAY.LABELS.BREAKING_NEWS}:`);
      for (const headline of context.newsHighlights) {
        lines.push(`  - ${headline}`);
      }
      lines.push('');
    }

    lines.push(`${DISPLAY.SECTION_DIVIDER}\n`);

    return lines.join('\n');
  }
}
