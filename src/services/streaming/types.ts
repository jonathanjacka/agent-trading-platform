/**
 * Streaming Types
 * Type definitions for WebSocket streaming and signal detection
 */

import type { AgentName } from '../consensus/types.js';

// ============================================================================
// Market Stream Types
// ============================================================================

/** Minute bar (OHLCV) from WebSocket */
export interface MinuteBar {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  timestamp: Date;
  startTimestamp: Date;
  endTimestamp: Date;
}

/** Raw WebSocket message for minute aggregates */
export interface RawMinuteAggregateMessage {
  ev: 'AM'; // Event type: Aggregate Minute
  sym: string; // Symbol
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  vw: number; // VWAP
  s: number; // Start timestamp (Unix ms)
  e: number; // End timestamp (Unix ms)
  z: number; // Average trade size
}

/** WebSocket connection status */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Market stream events */
export interface MarketStreamEvents {
  bar: (bar: MinuteBar) => void;
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  subscribed: (symbols: string[]) => void;
  unsubscribed: (symbols: string[]) => void;
}

// ============================================================================
// Signal Detection Types
// ============================================================================

/** Types of trading signals */
export type SignalType =
  | 'breakout_up'
  | 'breakout_down'
  | 'volume_spike'
  | 'momentum_up'
  | 'momentum_down'
  | 'reversal_bullish'
  | 'reversal_bearish'
  | 'value_opportunity';

/** Trading signal detected by SignalDetectionService */
export interface TradingSignal {
  id: string;
  symbol: string;
  type: SignalType;
  confidence: number; // 0-1
  targetAgents: AgentName[];
  reason: string;
  detectedAt: Date;
  data: {
    price: number;
    priceChange: number;
    priceChangePercent: number;
    volume: number;
    volumeRatio?: number; // Compared to average
    // Additional context
    [key: string]: unknown;
  };
}

/** Price history for a symbol (used for signal detection) */
export interface PriceHistory {
  symbol: string;
  bars: MinuteBar[];
  lastUpdate: Date;
  // Computed values
  averageVolume?: number;
  recentHigh?: number;
  recentLow?: number;
  sma20?: number;
}

/** Signal detection configuration */
export interface SignalDetectionConfig {
  // Volume spike detection
  volumeSpikeMultiplier: number; // Default: 3x average

  // Breakout detection
  breakoutLookbackBars: number; // How many bars to look back for high/low
  breakoutMinPercent: number; // Minimum % move to consider breakout

  // Momentum detection
  momentumConsecutiveBars: number; // How many consecutive up/down bars

  // Minimum confidence to emit signal
  minConfidence: number;
}

// ============================================================================
// Agent Trigger Types
// ============================================================================

/** Configuration for agent triggering */
export interface AgentTriggerConfig {
  cooldownMinutes: number;
  dailyLimit: number;
  minimumConfidence: number;
}

/** Agent trigger state */
export interface AgentTriggerState {
  agentName: AgentName;
  lastTrigger: Date | null;
  dailyTriggerCount: number;
  lastResetDate: string; // YYYY-MM-DD
}

/** Trigger decision result */
export interface TriggerDecision {
  allowed: boolean;
  reason: string;
  agentName: AgentName;
  signal?: TradingSignal;
}

/** Default agent trigger configurations */
export const DEFAULT_AGENT_CONFIGS: Record<AgentName, AgentTriggerConfig> = {
  leonardo: { cooldownMinutes: 60, dailyLimit: 3, minimumConfidence: 0.7 },
  michelangelo: { cooldownMinutes: 30, dailyLimit: 5, minimumConfidence: 0.6 },
  raphael: { cooldownMinutes: 120, dailyLimit: 2, minimumConfidence: 0.8 },
  donatello: { cooldownMinutes: 15, dailyLimit: 8, minimumConfidence: 0.5 },
};

/** Default signal detection configuration */
export const DEFAULT_SIGNAL_CONFIG: SignalDetectionConfig = {
  volumeSpikeMultiplier: 3,
  breakoutLookbackBars: 20,
  breakoutMinPercent: 1.5,
  momentumConsecutiveBars: 5,
  minConfidence: 0.5,
};

// ============================================================================
// Streaming Job Types
// ============================================================================

/** Streaming job status */
export type StreamingJobStatus = 'stopped' | 'starting' | 'running' | 'stopping';

/** Streaming job statistics */
export interface StreamingJobStats {
  status: StreamingJobStatus;
  startedAt: Date | null;
  symbolsMonitored: number;
  barsReceived: number;
  signalsDetected: number;
  agentsTriggered: number;
  errors: number;
}
