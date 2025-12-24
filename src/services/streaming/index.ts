/**
 * Streaming Module
 * Exports for real-time market data streaming and signal detection
 */

export { MarketStreamService } from './MarketStreamService.js';
export { SignalDetectionService } from './SignalDetectionService.js';
export { AgentTriggerService } from './AgentTriggerService.js';
export type { AgentTriggerCallback } from './AgentTriggerService.js';

export type {
  MinuteBar,
  RawMinuteAggregateMessage,
  ConnectionStatus,
  MarketStreamEvents,
  SignalType,
  TradingSignal,
  PriceHistory,
  SignalDetectionConfig,
  AgentTriggerConfig,
  AgentTriggerState,
  TriggerDecision,
  StreamingJobStatus,
  StreamingJobStats,
} from './types.js';

export {
  DEFAULT_AGENT_CONFIGS,
  DEFAULT_SIGNAL_CONFIG,
} from './types.js';
