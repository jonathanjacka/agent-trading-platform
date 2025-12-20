/**
 * Database types and interfaces
 * Central type definitions for all database entities
 */

export interface Account {
  trader_name: string;
  cash: number;
  initial_balance: number;
  strategy: string;
  created_at: string;
}

export interface Holding {
  id: number;
  trader_name: string;
  symbol: string;
  quantity: number;
  avg_price: number;
}

export interface Transaction {
  id: number;
  trader_name: string;
  timestamp: string;
  symbol: string;
  quantity: number;
  price: number;
  type: 'BUY' | 'SELL';
  rationale: string | null;
}

export interface PortfolioValue {
  id: number;
  trader_name: string;
  timestamp: string;
  total_value: number;
  pnl: number;
}

export interface Log {
  id: number;
  trader_name: string;
  timestamp: string;
  type: string;
  message: string;
}

export interface TradeLog {
  id: number;
  trader_name: string;
  timestamp: string;
  prompt: string | null;
  action: 'BUY' | 'SELL' | 'HOLD' | 'ERROR';
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  success: boolean;
  error_message: string | null;
  execution_time_ms: number;
  rationale: string | null;
  market_data_snapshot: string | null;
  portfolio_before: string | null;
  portfolio_after: string | null;
}

export interface TraderState {
  trader_name: string;
  last_trade_timestamp: string | null;
  trades_today: number;
  last_reset_date: string;
  api_calls_today: number;
}

export interface AgentMemory {
  id: number;
  agent_name: string;
  memory_type: string;
  content: string;
  context: string | null;
  confidence: number;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
  success_count: number;
  failure_count: number;
  tags: string | null;
}

export interface CollectiveInsight {
  id: number;
  insight_type: string;
  content: string;
  contributing_agents: string;
  confidence: number;
  evidence_count: number;
  created_at: string;
  tags: string | null;
}

export interface SchedulerRun {
  id: number;
  session_id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failure';
  total_agents: number;
  successful_agents: number;
  failed_agents: number;
  total_trades: number;
  collective_insights_generated: number;
  duration_ms: number | null;
  error_message: string | null;
  results_json: string | null;
}
