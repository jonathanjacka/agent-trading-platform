/**
 * MarketIntelligenceService
 *
 * Main orchestrator that provides real-time market intelligence to trading agents.
 * This is the public API - all submodules are implementation details.
 *
 * Key capabilities:
 * 1. Stock Discovery - Find stocks by theme, trend, or news mentions
 * 2. Market Conditions - Current state of the market (bullish/bearish, volatility)
 * 3. Market Movers - Today's top gainers, losers, most active
 * 4. Trading Context - Comprehensive brief injected into agent prompts
 */

import { Logger } from '../../utils/logger.js';
import { MarketDataService } from '../marketData/index.js';
import { BraveSearchService } from '../BraveSearchService.js';

// Sub-services
import { MarketConditionsService } from './MarketConditionsService.js';
import { StockDiscoveryService } from './StockDiscoveryService.js';
import { MarketMoversService } from './MarketMoversService.js';
import { ContextBuilder } from './ContextBuilder.js';

// Re-export types and constants for consumers
export * from './types.js';
export * from './constants.js';

export class MarketIntelligenceService {
  // Sub-services (exposed for direct access if needed)
  public readonly conditions: MarketConditionsService;
  public readonly discovery: StockDiscoveryService;
  public readonly movers: MarketMoversService;
  public readonly context: ContextBuilder;

  constructor(marketData: MarketDataService, braveSearch: BraveSearchService) {
    // Initialize sub-services
    this.conditions = new MarketConditionsService(braveSearch);
    this.discovery = new StockDiscoveryService(marketData, braveSearch);
    this.movers = new MarketMoversService(marketData, braveSearch);
    this.context = new ContextBuilder(
      this.conditions,
      this.discovery,
      this.movers,
      braveSearch
    );

    Logger.info('MarketIntelligenceService initialized');
  }

  // ═══════════════════════════════════════════════════════
  // Convenience methods (delegate to sub-services)
  // ═══════════════════════════════════════════════════════

  /** Get current market conditions (status, sentiment, volatility) */
  getMarketConditions() {
    return this.conditions.getMarketConditions();
  }

  /** Check if market is currently open */
  isMarketOpen() {
    return this.conditions.isMarketOpen();
  }

  /** Get current market status */
  getMarketStatus() {
    return this.conditions.getMarketStatus();
  }

  /** Discover stocks by theme (e.g., "AI", "electric vehicles") */
  discoverStocksByTheme(theme: string, limit?: number) {
    return this.discovery.discoverByTheme(theme, limit);
  }

  /** Get trending stocks from today's news */
  getTrendingStocks(limit?: number) {
    return this.discovery.getTrending(limit);
  }

  /** Extract ticker symbols from any text */
  extractTickersFromText(text: string, limit?: number) {
    return this.discovery.extractTickersFromText(text, limit);
  }

  /** Get top gainers */
  getGainers(limit?: number) {
    return this.movers.getGainers(limit);
  }

  /** Get top losers */
  getLosers(limit?: number) {
    return this.movers.getLosers(limit);
  }

  /** Get both gainers and losers */
  getMarketMovers() {
    return this.movers.getMovers();
  }

  /** Build comprehensive trading context */
  buildTradingContext() {
    return this.context.build();
  }

  /** Build light context (just conditions, faster) */
  buildLightContext() {
    return this.context.buildLight();
  }

  /** Format trading context for agent prompts */
  formatContextForAgent(
    context: Awaited<ReturnType<typeof this.context.build>>
  ) {
    return this.context.format(context);
  }
}
