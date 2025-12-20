/**
 * Account Service Types
 * Interfaces for portfolio and trade operations
 */

export interface HoldingWithPrice {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
}

export interface PortfolioSummary {
  traderName: string;
  cash: number;
  holdings: HoldingWithPrice[];
  totalHoldingsValue: number;
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
}

export interface TradeResult {
  success: boolean;
  message: string;
}

export interface MarketDataSnapshot {
  price: number;
  marketCap?: number;
  estimatedPrice: number;
  gain?: number;
  gainPercent?: number;
}

export interface TradeParams {
  traderName: string;
  symbol: string;
  quantity: number;
  rationale: string;
  prompt?: string;
}
