/**
 * MarketConditionsService
 * Handles market status detection and sentiment analysis
 */

import { Logger } from '../../utils/logger.js';
import { BraveSearchService } from '../BraveSearchService.js';
import { MarketConditions } from './types.js';
import {
  DEFAULT_CACHE_TTL_MS,
  PRE_MARKET_START_MINUTES,
  MARKET_OPEN_MINUTES,
  MARKET_CLOSE_MINUTES,
  AFTER_HOURS_END_MINUTES,
  MARKET_TIMEZONE,
  MARKET_CONDITIONS_QUERY,
  BULLISH_WORDS,
  BEARISH_WORDS,
  VOLATILITY_WORDS,
  DEFAULT_NEWS_COUNT,
  ERRORS,
  MARKET_STATUS,
  SENTIMENT,
  VOLATILITY,
} from './constants.js';
import type {
  MarketStatusValue,
  SentimentValue,
  VolatilityValue,
} from './constants.js';

export class MarketConditionsService {
  private braveSearch: BraveSearchService;
  private cache: { data: MarketConditions; timestamp: number } | null = null;

  constructor(braveSearch: BraveSearchService) {
    this.braveSearch = braveSearch;
  }

  /**
   * Get current market conditions
   * Determines if now is a good time to trade based on market hours and sentiment
   */
  async getMarketConditions(): Promise<MarketConditions> {
    // Check cache first
    if (
      this.cache &&
      Date.now() - this.cache.timestamp < DEFAULT_CACHE_TTL_MS
    ) {
      return this.cache.data;
    }

    Logger.info('Fetching market conditions...');

    const now = new Date();
    const marketStatus = this.getMarketStatus(now);

    // Search for current market sentiment
    let sentiment: SentimentValue = SENTIMENT.NEUTRAL;
    let volatility: VolatilityValue = VOLATILITY.MODERATE;
    let summary = '';
    const indices: MarketConditions['indices'] = {};

    try {
      // Get market news to gauge sentiment
      const marketNews = await this.braveSearch.searchNews(
        MARKET_CONDITIONS_QUERY,
        { count: DEFAULT_NEWS_COUNT, freshness: 'pd' }
      );

      if (marketNews.news?.results) {
        const headlines = marketNews.news.results
          .map((n) => n.title.toLowerCase())
          .join(' ');

        // Simple sentiment analysis from headlines
        const bullishCount = BULLISH_WORDS.filter((w) =>
          headlines.includes(w)
        ).length;
        const bearishCount = BEARISH_WORDS.filter((w) =>
          headlines.includes(w)
        ).length;

        if (bullishCount > bearishCount + 1) sentiment = SENTIMENT.BULLISH;
        else if (bearishCount > bullishCount + 1) sentiment = SENTIMENT.BEARISH;

        // Check for volatility indicators
        if (VOLATILITY_WORDS.some((w) => headlines.includes(w))) {
          volatility = VOLATILITY.HIGH;
        }

        summary =
          marketNews.news.results[0]?.title || ERRORS.UNABLE_TO_FETCH_SUMMARY;
      }
    } catch (error) {
      Logger.warn('Failed to fetch market sentiment from news');
      summary = ERRORS.MARKET_DATA_UNAVAILABLE;
    }

    const conditions: MarketConditions = {
      timestamp: now.toISOString(),
      marketStatus,
      tradingRecommended:
        marketStatus === MARKET_STATUS.OPEN && volatility !== VOLATILITY.HIGH,
      summary,
      indices,
      sentiment,
      volatility,
    };

    // Cache the result
    this.cache = { data: conditions, timestamp: Date.now() };

    return conditions;
  }

  /**
   * Determine if market is currently open
   * US market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
   */
  getMarketStatus(now: Date = new Date()): MarketStatusValue {
    // Convert to ET
    const etTime = new Date(
      now.toLocaleString('en-US', { timeZone: MARKET_TIMEZONE })
    );
    const day = etTime.getDay();
    const hour = etTime.getHours();
    const minute = etTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    // Weekend
    if (day === 0 || day === 6) return MARKET_STATUS.CLOSED;

    if (timeInMinutes < PRE_MARKET_START_MINUTES) return MARKET_STATUS.CLOSED;
    if (timeInMinutes < MARKET_OPEN_MINUTES) return MARKET_STATUS.PRE_MARKET;
    if (timeInMinutes < MARKET_CLOSE_MINUTES) return MARKET_STATUS.OPEN;
    if (timeInMinutes < AFTER_HOURS_END_MINUTES)
      return MARKET_STATUS.AFTER_HOURS;
    return MARKET_STATUS.CLOSED;
  }

  /**
   * Check if trading is recommended right now
   */
  isMarketOpen(): boolean {
    return this.getMarketStatus() === MARKET_STATUS.OPEN;
  }
}
