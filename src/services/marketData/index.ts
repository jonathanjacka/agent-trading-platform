/**
 * Market Data Service Module
 *
 * Public exports for the market data module.
 * Import from this file for all market data functionality.
 */

// Main service facade
export { MarketDataService } from './MarketDataService.js';

// Sub-services (for advanced usage)
export { PolygonClient } from './PolygonClient.js';
export { CompanyDataService } from './CompanyDataService.js';
export { PriceDataService } from './PriceDataService.js';
export { TechnicalIndicatorService } from './TechnicalIndicatorService.js';
export { DividendService } from './DividendService.js';

// Re-export types for consumers
export * from './types.js';
