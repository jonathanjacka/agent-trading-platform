/**
 * Market Data Service
 * Main facade for accessing Polygon.io market data
 */

import { Logger } from '../../utils/logger.js';
import { PolygonClient } from './PolygonClient.js';
import { CompanyDataService } from './CompanyDataService.js';
import { PriceDataService } from './PriceDataService.js';
import { TechnicalIndicatorService } from './TechnicalIndicatorService.js';
import { DividendService } from './DividendService.js';
import type {
  CompanyDetails,
  NewsArticle,
  EstimatedPrice,
  PriceSnapshot,
  IndicatorType,
  IndicatorOptions,
  IndicatorResult,
  DividendData,
  TickerSearchResult,
} from './types.js';

export class MarketDataService {
  private client: PolygonClient;
  private companyService: CompanyDataService;
  private priceService: PriceDataService;
  private technicalService: TechnicalIndicatorService;
  private dividendService: DividendService;

  constructor(apiKey: string) {
    this.client = new PolygonClient(apiKey);
    this.companyService = new CompanyDataService(this.client);
    this.priceService = new PriceDataService(this.client);
    this.technicalService = new TechnicalIndicatorService(this.client);
    this.dividendService = new DividendService(this.client, this.priceService);

    Logger.info('MarketDataService initialized with modular sub-services');
  }

  // ============================================================================
  // Company Data Methods
  // ============================================================================

  async getCompanyDetails(symbol: string): Promise<CompanyDetails> {
    return this.companyService.getCompanyDetails(symbol);
  }

  async getStockNews(symbol: string, limit: number = 10): Promise<NewsArticle[]> {
    return this.companyService.getStockNews(symbol, limit);
  }

  async searchTickers(query: string, limit: number = 10): Promise<TickerSearchResult[]> {
    return this.companyService.searchTickers(query, limit);
  }

  // ============================================================================
  // Price Data Methods
  // ============================================================================

  async getEstimatedPrice(symbol: string): Promise<EstimatedPrice> {
    return this.priceService.getEstimatedPrice(symbol);
  }

  async getSnapshot(symbol: string): Promise<PriceSnapshot> {
    return this.priceService.getSnapshot(symbol);
  }

  // ============================================================================
  // Technical Indicator Methods
  // ============================================================================

  async getTechnicalIndicator(
    symbol: string,
    indicator: IndicatorType,
    options?: IndicatorOptions
  ): Promise<IndicatorResult> {
    return this.technicalService.getIndicator(symbol, indicator, options);
  }

  async getSMA(symbol: string, window?: number, limit?: number): Promise<IndicatorResult> {
    return this.technicalService.getSMA(symbol, window, limit);
  }

  async getEMA(symbol: string, window?: number, limit?: number): Promise<IndicatorResult> {
    return this.technicalService.getEMA(symbol, window, limit);
  }

  async getRSI(symbol: string, window?: number, limit?: number): Promise<IndicatorResult> {
    return this.technicalService.getRSI(symbol, window, limit);
  }

  async getMACD(symbol: string, limit?: number): Promise<IndicatorResult> {
    return this.technicalService.getMACD(symbol, limit);
  }

  // ============================================================================
  // Dividend Methods
  // ============================================================================

  async getDividends(symbol: string, limit?: number): Promise<DividendData> {
    return this.dividendService.getDividends(symbol, limit);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  clearCache(): void {
    this.client.clearCache();
  }
}
