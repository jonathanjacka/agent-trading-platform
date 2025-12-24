/**
 * Signal Detection Service
 * Analyzes incoming price data and detects trading opportunities
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger.js';
import { MarketStreamService } from './MarketStreamService.js';
import { DEFAULT_SIGNAL_CONFIG } from './types.js';
import type {
  MinuteBar,
  TradingSignal,
  SignalType,
  PriceHistory,
  SignalDetectionConfig,
} from './types.js';
import type { AgentName } from '../consensus/types.js';

// Generate unique signal IDs
let signalCounter = 0;
function generateSignalId(): string {
  return `signal-${Date.now()}-${++signalCounter}`;
}

/** Map signal types to target agent strategies */
const SIGNAL_AGENT_MAP: Record<SignalType, AgentName[]> = {
  breakout_up: ['michelangelo', 'donatello'],
  breakout_down: ['donatello'],
  volume_spike: ['leonardo', 'michelangelo', 'raphael', 'donatello'],
  momentum_up: ['michelangelo'],
  momentum_down: ['donatello'],
  reversal_bullish: ['donatello', 'leonardo'],
  reversal_bearish: ['donatello'],
  value_opportunity: ['leonardo'],
};

export class SignalDetectionService extends EventEmitter {
  private streamService: MarketStreamService;
  private config: SignalDetectionConfig;
  private priceHistory: Map<string, PriceHistory> = new Map();
  private signalHistory: TradingSignal[] = [];

  // Keep last N bars for analysis
  private readonly MAX_HISTORY_BARS = 60; // 1 hour of minute bars

  constructor(
    streamService: MarketStreamService,
    config: Partial<SignalDetectionConfig> = {}
  ) {
    super();
    this.streamService = streamService;
    this.config = { ...DEFAULT_SIGNAL_CONFIG, ...config };

    // Listen for minute bars
    this.streamService.on('bar', (bar) => this.handleBar(bar));

    Logger.info('SignalDetectionService initialized');
  }

  /**
   * Handle incoming minute bar
   */
  private handleBar(bar: MinuteBar): void {
    // Update price history
    this.updatePriceHistory(bar);

    // Get price history for this symbol
    const history = this.priceHistory.get(bar.symbol);
    if (!history || history.bars.length < 5) {
      // Not enough data yet
      return;
    }

    // Detect signals
    const signals = this.detectSignals(bar, history);

    // Emit valid signals
    for (const signal of signals) {
      if (signal.confidence >= this.config.minConfidence) {
        this.signalHistory.push(signal);
        Logger.info(
          `Signal detected: ${signal.type} for ${signal.symbol} (confidence: ${signal.confidence.toFixed(2)})`
        );
        this.emit('signal', signal);
      }
    }
  }

  /**
   * Update price history for a symbol
   */
  private updatePriceHistory(bar: MinuteBar): void {
    let history = this.priceHistory.get(bar.symbol);

    if (!history) {
      history = {
        symbol: bar.symbol,
        bars: [],
        lastUpdate: new Date(),
      };
      this.priceHistory.set(bar.symbol, history);
    }

    // Add new bar
    history.bars.push(bar);
    history.lastUpdate = new Date();

    // Trim to max size
    if (history.bars.length > this.MAX_HISTORY_BARS) {
      history.bars = history.bars.slice(-this.MAX_HISTORY_BARS);
    }

    // Compute derived values
    this.computeDerivedValues(history);
  }

  /**
   * Compute derived values for price history
   */
  private computeDerivedValues(history: PriceHistory): void {
    const bars = history.bars;

    if (bars.length < 5) return;

    // Average volume (last 20 bars or all available)
    const volumeBars = bars.slice(-20);
    history.averageVolume =
      volumeBars.reduce((sum, b) => sum + b.volume, 0) / volumeBars.length;

    // Recent high/low (lookback period)
    const lookbackBars = bars.slice(-this.config.breakoutLookbackBars);
    history.recentHigh = Math.max(...lookbackBars.map((b) => b.high));
    history.recentLow = Math.min(...lookbackBars.map((b) => b.low));

    // Simple moving average (20 bars)
    const smaBars = bars.slice(-20);
    history.sma20 =
      smaBars.reduce((sum, b) => sum + b.close, 0) / smaBars.length;
  }

  /**
   * Detect trading signals from price data
   */
  private detectSignals(bar: MinuteBar, history: PriceHistory): TradingSignal[] {
    const signals: TradingSignal[] = [];

    // Volume spike detection
    const volumeSignal = this.detectVolumeSpike(bar, history);
    if (volumeSignal) signals.push(volumeSignal);

    // Breakout detection
    const breakoutSignal = this.detectBreakout(bar, history);
    if (breakoutSignal) signals.push(breakoutSignal);

    // Momentum detection
    const momentumSignal = this.detectMomentum(history);
    if (momentumSignal) signals.push(momentumSignal);

    return signals;
  }

  /**
   * Detect volume spike
   */
  private detectVolumeSpike(
    bar: MinuteBar,
    history: PriceHistory
  ): TradingSignal | null {
    if (!history.averageVolume || history.averageVolume === 0) return null;

    const volumeRatio = bar.volume / history.averageVolume;

    if (volumeRatio >= this.config.volumeSpikeMultiplier) {
      const priceChange = bar.close - bar.open;
      const priceChangePercent = (priceChange / bar.open) * 100;

      // Confidence based on how much the spike exceeds threshold
      const confidence = Math.min(
        0.5 + (volumeRatio - this.config.volumeSpikeMultiplier) * 0.1,
        0.95
      );

      return {
        id: generateSignalId(),
        symbol: bar.symbol,
        type: 'volume_spike',
        confidence,
        targetAgents: SIGNAL_AGENT_MAP.volume_spike,
        reason: `Volume spike: ${volumeRatio.toFixed(1)}x average volume`,
        detectedAt: new Date(),
        data: {
          price: bar.close,
          priceChange,
          priceChangePercent,
          volume: bar.volume,
          volumeRatio,
        },
      };
    }

    return null;
  }

  /**
   * Detect price breakout
   */
  private detectBreakout(
    bar: MinuteBar,
    history: PriceHistory
  ): TradingSignal | null {
    if (
      !history.recentHigh ||
      !history.recentLow ||
      history.bars.length < this.config.breakoutLookbackBars
    ) {
      return null;
    }

    // Get the high/low BEFORE this bar (exclude current)
    const previousBars = history.bars.slice(0, -1);
    if (previousBars.length < this.config.breakoutLookbackBars - 1) return null;

    const lookbackBars = previousBars.slice(-this.config.breakoutLookbackBars);
    const previousHigh = Math.max(...lookbackBars.map((b) => b.high));
    const previousLow = Math.min(...lookbackBars.map((b) => b.low));

    // Check for breakout above resistance
    if (bar.close > previousHigh) {
      const breakoutPercent = ((bar.close - previousHigh) / previousHigh) * 100;

      if (breakoutPercent >= this.config.breakoutMinPercent) {
        const confidence = Math.min(0.6 + breakoutPercent * 0.05, 0.9);

        return {
          id: generateSignalId(),
          symbol: bar.symbol,
          type: 'breakout_up',
          confidence,
          targetAgents: SIGNAL_AGENT_MAP.breakout_up,
          reason: `Breakout above ${this.config.breakoutLookbackBars}-bar high at $${previousHigh.toFixed(2)} (+${breakoutPercent.toFixed(1)}%)`,
          detectedAt: new Date(),
          data: {
            price: bar.close,
            priceChange: bar.close - previousHigh,
            priceChangePercent: breakoutPercent,
            volume: bar.volume,
            previousHigh,
          },
        };
      }
    }

    // Check for breakdown below support
    if (bar.close < previousLow) {
      const breakdownPercent = ((previousLow - bar.close) / previousLow) * 100;

      if (breakdownPercent >= this.config.breakoutMinPercent) {
        const confidence = Math.min(0.6 + breakdownPercent * 0.05, 0.9);

        return {
          id: generateSignalId(),
          symbol: bar.symbol,
          type: 'breakout_down',
          confidence,
          targetAgents: SIGNAL_AGENT_MAP.breakout_down,
          reason: `Breakdown below ${this.config.breakoutLookbackBars}-bar low at $${previousLow.toFixed(2)} (-${breakdownPercent.toFixed(1)}%)`,
          detectedAt: new Date(),
          data: {
            price: bar.close,
            priceChange: bar.close - previousLow,
            priceChangePercent: -breakdownPercent,
            volume: bar.volume,
            previousLow,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detect momentum (consecutive up/down bars)
   */
  private detectMomentum(history: PriceHistory): TradingSignal | null {
    const bars = history.bars;
    if (bars.length < this.config.momentumConsecutiveBars) return null;

    const recentBars = bars.slice(-this.config.momentumConsecutiveBars);

    // Check for consecutive up bars
    let consecutiveUp = 0;
    let consecutiveDown = 0;

    for (let i = 1; i < recentBars.length; i++) {
      if (recentBars[i].close > recentBars[i - 1].close) {
        consecutiveUp++;
        consecutiveDown = 0;
      } else if (recentBars[i].close < recentBars[i - 1].close) {
        consecutiveDown++;
        consecutiveUp = 0;
      } else {
        // Reset both on flat
        consecutiveUp = 0;
        consecutiveDown = 0;
      }
    }

    const lastBar = recentBars[recentBars.length - 1];
    const firstBar = recentBars[0];
    const totalChange = lastBar.close - firstBar.open;
    const totalChangePercent = (totalChange / firstBar.open) * 100;

    if (consecutiveUp >= this.config.momentumConsecutiveBars - 1) {
      const confidence = Math.min(0.5 + consecutiveUp * 0.08, 0.85);

      return {
        id: generateSignalId(),
        symbol: history.symbol,
        type: 'momentum_up',
        confidence,
        targetAgents: SIGNAL_AGENT_MAP.momentum_up,
        reason: `Momentum: ${consecutiveUp + 1} consecutive up bars (+${totalChangePercent.toFixed(1)}%)`,
        detectedAt: new Date(),
        data: {
          price: lastBar.close,
          priceChange: totalChange,
          priceChangePercent: totalChangePercent,
          volume: lastBar.volume,
          consecutiveBars: consecutiveUp + 1,
        },
      };
    }

    if (consecutiveDown >= this.config.momentumConsecutiveBars - 1) {
      const confidence = Math.min(0.5 + consecutiveDown * 0.08, 0.85);

      return {
        id: generateSignalId(),
        symbol: history.symbol,
        type: 'momentum_down',
        confidence,
        targetAgents: SIGNAL_AGENT_MAP.momentum_down,
        reason: `Momentum: ${consecutiveDown + 1} consecutive down bars (${totalChangePercent.toFixed(1)}%)`,
        detectedAt: new Date(),
        data: {
          price: lastBar.close,
          priceChange: totalChange,
          priceChangePercent: totalChangePercent,
          volume: lastBar.volume,
          consecutiveBars: consecutiveDown + 1,
        },
      };
    }

    return null;
  }

  /**
   * Get recent signals
   */
  getRecentSignals(limit: number = 20): TradingSignal[] {
    return this.signalHistory.slice(-limit);
  }

  /**
   * Get signals for a specific symbol
   */
  getSignalsForSymbol(symbol: string): TradingSignal[] {
    return this.signalHistory.filter(
      (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
    );
  }

  /**
   * Get price history for a symbol
   */
  getPriceHistory(symbol: string): PriceHistory | undefined {
    return this.priceHistory.get(symbol.toUpperCase());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.priceHistory.clear();
    this.signalHistory = [];
    Logger.info('SignalDetectionService data cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SignalDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    Logger.info('SignalDetectionService config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): SignalDetectionConfig {
    return { ...this.config };
  }
}
