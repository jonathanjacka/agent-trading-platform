import { restClient } from '@massive.com/client-js';
import { Logger } from '../utils/logger.js';

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(maxTokens: number = 5, refillIntervalMs: number = 60000) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.refillIntervalMs) {
      // Full refill after interval passes
      this.tokens = this.maxTokens;
      this.lastRefill = now;
      Logger.info(`[RateLimiter] Tokens refilled to ${this.maxTokens}`);
    }
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      Logger.info(
        `[RateLimiter] Token acquired. Remaining: ${this.tokens}/${this.maxTokens}`
      );
      return;
    }

    // No tokens available - wait for refill
    const waitTime = this.refillIntervalMs - (Date.now() - this.lastRefill);
    Logger.warn(
      `[RateLimiter] Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`
    );

    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.refill();
    this.tokens--;
    Logger.info(
      `[RateLimiter] Token acquired after wait. Remaining: ${this.tokens}/${this.maxTokens}`
    );
  }

  getStatus(): { tokens: number; maxTokens: number; msUntilRefill: number } {
    this.refill();
    return {
      tokens: this.tokens,
      maxTokens: this.maxTokens,
      msUntilRefill: Math.max(
        0,
        this.refillIntervalMs - (Date.now() - this.lastRefill)
      ),
    };
  }
}

export class MarketDataService {
  private client: any;
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private tickerCache: Map<
    string,
    {
      data: any;
      timestamp: number;
    }
  > = new Map();
  private CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (data updates EOD only)

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('POLY_API_KEY is required for MarketDataService');
    }

    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter(5, 60000); // 5 calls per 60 seconds
    this.client = restClient(apiKey, 'https://api.massive.com', {
      pagination: false, // Disabled to avoid auto-fetching all pages (rate limit friendly)
    });

    Logger.info(
      'MarketDataService initialized (Free Tier) - 24hr cache, 5/min rate limit'
    );
  }

  /**
   * Get rate limiter status (useful for monitoring)
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  private getCachedTicker(symbol: string) {
    const cached = this.tickerCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      Logger.info(`Using cached data for ${symbol}`);
      return cached.data;
    }
    return null;
  }

  private setCachedTicker(symbol: string, data: any) {
    this.tickerCache.set(symbol, { data, timestamp: Date.now() });
  }

  async getCompanyDetails(symbol: string): Promise<{
    symbol: string;
    name: string;
    description: string;
    sector: string;
    marketCap: number;
    employees: number;
    homepage: string;
    exchange: string;
    active: boolean;
    listDate: string;
    phone: string;
    address: any;
  }> {
    try {
      Logger.info(`Fetching company details for ${symbol}`);

      // Try cache first
      let response = this.getCachedTicker(symbol);
      if (!response) {
        await this.rateLimiter.acquire(); // Rate limit API calls
        response = await this.client.getTicker(symbol);
        this.setCachedTicker(symbol, response);
      }

      if (response.status !== 'OK') {
        throw new Error(`API returned status: ${response.status}`);
      }

      return {
        symbol: response.results.ticker,
        name: response.results.name,
        description: response.results.description || 'No description available',
        sector: response.results.sic_description || 'Unknown sector',
        marketCap: response.results.market_cap || 0,
        employees: response.results.total_employees || 0,
        homepage: response.results.homepage_url || '',
        phone: response.results.phone_number || '',
        exchange: response.results.primary_exchange || '',
        active: response.results.active,
        listDate: response.results.list_date || '',
        address: response.results.address || {},
      };
    } catch (error) {
      Logger.error(`Failed to get company details for ${symbol}`, error);
      throw new Error(
        `Unable to fetch company details for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getStockNews(
    symbol: string,
    limit: number = 10
  ): Promise<
    Array<{
      title: string;
      description: string;
      author: string;
      publisher: string;
      publisherUrl: string;
      articleUrl: string;
      publishedDate: string;
      tickers: string[];
      imageUrl?: string;
      keywords?: string[];
      insights?: Array<{
        ticker: string;
        sentiment: string;
        sentiment_reasoning: string;
      }>;
    }>
  > {
    try {
      Logger.info(`Fetching news for ${symbol} (limit: ${limit})`);
      await this.rateLimiter.acquire(); // Rate limit API calls
      const response = await this.client.listNews({
        ticker: symbol,
        limit: Math.min(limit, 1000),
      });

      if (!response.results || response.results.length === 0) {
        Logger.warn(`No news found for ${symbol}`);
        return [];
      }

      return response.results.map((article: any) => ({
        title: article.title,
        description: article.description || '',
        author: article.author || 'Unknown',
        publisher: article.publisher?.name || 'Unknown',
        publisherUrl: article.publisher?.homepage_url || '',
        articleUrl: article.article_url,
        publishedDate: article.published_utc,
        tickers: article.tickers || [symbol],
        imageUrl: article.image_url,
        keywords: article.keywords || [],
        insights: article.insights || [],
      }));
    } catch (error) {
      Logger.error(`Failed to get news for ${symbol}`, error);
      throw new Error(
        `Unable to fetch news for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getEstimatedPrice(symbol: string): Promise<{
    symbol: string;
    estimatedPrice: number;
    marketCap: number;
    sharesOutstanding: number;
    note: string;
  }> {
    try {
      // Try cache first
      let response = this.getCachedTicker(symbol);
      if (!response) {
        await this.rateLimiter.acquire(); // Rate limit API calls
        response = await this.client.getTicker(symbol);
        this.setCachedTicker(symbol, response);
      }

      const marketCap = response.results.market_cap || 0;
      const sharesOutstanding =
        response.results.weighted_shares_outstanding || 1;
      const estimatedPrice = marketCap / sharesOutstanding;

      Logger.info(
        `Estimated price for ${symbol}: $${estimatedPrice.toFixed(2)}`
      );

      return {
        symbol,
        estimatedPrice,
        marketCap,
        sharesOutstanding,
        note: 'Estimated from market cap / shares outstanding. Updated daily, not real-time.',
      };
    } catch (error) {
      Logger.error(`Failed to estimate price for ${symbol}`, error);
      throw error;
    }
  }

  async searchTickers(query: string, limit: number = 10): Promise<any[]> {
    try {
      Logger.info(`Searching tickers for: ${query}`);
      await this.rateLimiter.acquire(); // Rate limit API calls
      const response = await this.client.listTickers({
        search: query,
        limit,
        active: true,
      });

      return response.results || [];
    } catch (error) {
      Logger.error(`Failed to search tickers for ${query}`, error);
      throw error;
    }
  }
}
