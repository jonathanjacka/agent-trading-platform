export interface Trader {
  name: string;
  strategy: string;
  model: string;
}

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  gain: number;
  gainPercent: string;
}

export interface Portfolio {
  traderName: string;
  cash: number;
  holdings: Holding[];
  totalHoldingsValue: number;
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
}

export interface Transaction {
  id: number;
  trader_name: string;
  timestamp: string;
  symbol: string;
  quantity: number;
  price: number;
  type: 'BUY' | 'SELL';
  rationale: string;
}

export interface PortfolioValue {
  id: number;
  trader_name: string;
  timestamp: string;
  value: number;
  pnl: number;
}

export interface TradeRequest {
  prompt: string;
}

export interface TradeResponse {
  success: boolean;
  trader: Trader;
  prompt: string;
  result: string;
  timestamp: string;
}
