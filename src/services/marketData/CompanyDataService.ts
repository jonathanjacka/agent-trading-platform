/**
 * Company Data Service
 * Handles company details, news, and ticker search
 */

import { Logger } from '../../utils/logger.js';
import type { PolygonClient } from './PolygonClient.js';
import type { CompanyDetails, NewsArticle, TickerSearchResult } from './types.js';

export class CompanyDataService {
  constructor(private client: PolygonClient) { }

  async getCompanyDetails(symbol: string): Promise<CompanyDetails> {
    try {
      Logger.info(`Fetching company details for ${symbol}`);

      // Try cache first
      let response = this.client.getCached<any>(symbol);
      if (!response) {
        response = await this.client.getRestClient().getTicker(symbol);
        this.client.setCache(symbol, response);
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

  async getStockNews(symbol: string, limit: number = 10): Promise<NewsArticle[]> {
    try {
      Logger.info(`Fetching news for ${symbol} (limit: ${limit})`);
      const response = await this.client.getRestClient().listNews({
        ticker: symbol,
        limit: Math.min(limit, 1000),
      } as any);

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

  async searchTickers(query: string, limit: number = 10): Promise<any[]> {
    try {
      Logger.info(`Searching tickers for: ${query}`);
      const response = await this.client.getRestClient().listTickers({
        search: query,
        limit,
        active: true,
      } as any);

      return response.results || [];
    } catch (error) {
      Logger.error(`Failed to search tickers for ${query}`, error);
      throw error;
    }
  }
}
