import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { SignalDetectionService } from './SignalDetectionService.js';
import { MarketStreamService } from './MarketStreamService.js';
import type { MinuteBar, TradingSignal } from './types.js';

// Create a mock MarketStreamService
function createMockStreamService(): MarketStreamService {
  const emitter = new EventEmitter();
  return emitter as unknown as MarketStreamService;
}

// Helper to create a minute bar
function createBar(overrides: Partial<MinuteBar> = {}): MinuteBar {
  return {
    symbol: 'AAPL',
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 10000,
    vwap: 100.25,
    timestamp: new Date(),
    startTimestamp: new Date(),
    endTimestamp: new Date(),
    ...overrides,
  };
}

// Helper to generate a series of bars
function generateBars(
  count: number,
  basePrice: number,
  baseVolume: number,
  priceDirection: 'up' | 'down' | 'flat' = 'flat'
): MinuteBar[] {
  const bars: MinuteBar[] = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    if (priceDirection === 'up') price += 0.5;
    else if (priceDirection === 'down') price -= 0.5;

    bars.push(
      createBar({
        open: price - 0.25,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: baseVolume,
      })
    );
  }

  return bars;
}

describe('SignalDetectionService', () => {
  let signalService: SignalDetectionService;
  let mockStreamService: MarketStreamService;

  beforeEach(() => {
    mockStreamService = createMockStreamService();
    signalService = new SignalDetectionService(mockStreamService, {
      volumeSpikeMultiplier: 3,
      breakoutLookbackBars: 5,
      breakoutMinPercent: 1.5,
      momentumConsecutiveBars: 5,
      minConfidence: 0.5,
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = signalService.getConfig();

      expect(config.volumeSpikeMultiplier).toBe(3);
      expect(config.breakoutLookbackBars).toBe(5);
      expect(config.minConfidence).toBe(0.5);
    });

    it('should accept custom config', () => {
      const customService = new SignalDetectionService(mockStreamService, {
        volumeSpikeMultiplier: 5,
        minConfidence: 0.7,
      });

      const config = customService.getConfig();
      expect(config.volumeSpikeMultiplier).toBe(5);
      expect(config.minConfidence).toBe(0.7);
    });
  });

  describe('price history', () => {
    it('should build price history from bars', () => {
      // Emit enough bars to build history
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ close: 100 + i }));
      }

      const history = signalService.getPriceHistory('AAPL');

      expect(history).toBeDefined();
      expect(history!.bars).toHaveLength(10);
      expect(history!.symbol).toBe('AAPL');
    });

    it('should compute derived values', () => {
      // Emit bars with known values
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({
            high: 105,
            low: 95,
            close: 100,
            volume: 10000,
          })
        );
      }

      const history = signalService.getPriceHistory('AAPL');

      expect(history!.averageVolume).toBe(10000);
      expect(history!.recentHigh).toBe(105);
      expect(history!.recentLow).toBe(95);
      expect(history!.sma20).toBe(100);
    });

    it('should limit history to MAX_HISTORY_BARS', () => {
      // Emit 70 bars (more than 60 limit)
      for (let i = 0; i < 70; i++) {
        mockStreamService.emit('bar', createBar({ close: 100 + i }));
      }

      const history = signalService.getPriceHistory('AAPL');

      expect(history!.bars.length).toBeLessThanOrEqual(60);
    });

    it('should track multiple symbols independently', () => {
      mockStreamService.emit('bar', createBar({ symbol: 'AAPL', close: 150 }));
      mockStreamService.emit('bar', createBar({ symbol: 'GOOGL', close: 100 }));

      const aaplHistory = signalService.getPriceHistory('AAPL');
      const googlHistory = signalService.getPriceHistory('GOOGL');

      expect(aaplHistory).toBeDefined();
      expect(googlHistory).toBeDefined();
      expect(aaplHistory!.bars[0].close).toBe(150);
      expect(googlHistory!.bars[0].close).toBe(100);
    });
  });

  describe('volume spike detection', () => {
    it('should detect volume spike above threshold', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Build history with normal volume
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }

      // Send bar with volume spike (4x average, above 3x threshold)
      mockStreamService.emit(
        'bar',
        createBar({
          volume: 40000,
          open: 100,
          close: 102,
        })
      );

      const volumeSignals = signals.filter((s) => s.type === 'volume_spike');
      expect(volumeSignals.length).toBeGreaterThanOrEqual(1);

      const signal = volumeSignals[0];
      expect(signal.symbol).toBe('AAPL');
      expect(signal.data.volumeRatio).toBeGreaterThanOrEqual(3);
    });

    it('should not trigger on normal volume', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Build history with normal volume
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }

      // Send bar with slightly elevated volume (2x, below 3x threshold)
      mockStreamService.emit('bar', createBar({ volume: 20000 }));

      const volumeSignals = signals.filter((s) => s.type === 'volume_spike');
      expect(volumeSignals).toHaveLength(0);
    });
  });

  describe('breakout detection', () => {
    it('should detect upward breakout', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Build history with stable prices
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({
            high: 100,
            low: 98,
            close: 99,
          })
        );
      }

      // Send bar breaking above recent high (>1.5% above 100)
      mockStreamService.emit(
        'bar',
        createBar({
          high: 103,
          low: 101,
          close: 102, // 2% above previous high of 100
        })
      );

      const breakoutSignals = signals.filter((s) => s.type === 'breakout_up');
      expect(breakoutSignals.length).toBeGreaterThanOrEqual(1);

      const signal = breakoutSignals[0];
      expect(signal.data.priceChangePercent).toBeGreaterThanOrEqual(1.5);
    });

    it('should detect downward breakdown', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Build history with stable prices
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({
            high: 100,
            low: 98,
            close: 99,
          })
        );
      }

      // Send bar breaking below recent low (>1.5% below 98)
      mockStreamService.emit(
        'bar',
        createBar({
          high: 97,
          low: 95,
          close: 96, // ~2% below previous low of 98
        })
      );

      const breakdownSignals = signals.filter((s) => s.type === 'breakout_down');
      expect(breakdownSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('should not trigger on small moves', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Build history
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({
            high: 100,
            low: 98,
            close: 99,
          })
        );
      }

      // Send bar with small move (0.5% above, below 1.5% threshold)
      mockStreamService.emit(
        'bar',
        createBar({
          high: 100.6,
          low: 99.5,
          close: 100.5,
        })
      );

      const breakoutSignals = signals.filter(
        (s) => s.type === 'breakout_up' || s.type === 'breakout_down'
      );
      expect(breakoutSignals).toHaveLength(0);
    });
  });

  describe('momentum detection', () => {
    it('should detect upward momentum', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Send 6 consecutive up bars
      let price = 100;
      for (let i = 0; i < 6; i++) {
        price += 0.5;
        mockStreamService.emit(
          'bar',
          createBar({
            open: price - 0.25,
            close: price,
          })
        );
      }

      const momentumSignals = signals.filter((s) => s.type === 'momentum_up');
      expect(momentumSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect downward momentum', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Send 6 consecutive down bars
      let price = 100;
      for (let i = 0; i < 6; i++) {
        price -= 0.5;
        mockStreamService.emit(
          'bar',
          createBar({
            open: price + 0.25,
            close: price,
          })
        );
      }

      const momentumSignals = signals.filter((s) => s.type === 'momentum_down');
      expect(momentumSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('should not trigger with mixed price movement', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Send alternating up/down bars
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({
            open: 100,
            close: i % 2 === 0 ? 101 : 99,
          })
        );
      }

      const momentumSignals = signals.filter(
        (s) => s.type === 'momentum_up' || s.type === 'momentum_down'
      );
      expect(momentumSignals).toHaveLength(0);
    });
  });

  describe('signal history', () => {
    it('should store signals in history', () => {
      // Generate a volume spike signal
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }
      mockStreamService.emit('bar', createBar({ volume: 50000 }));

      const signals = signalService.getRecentSignals();
      expect(signals.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter signals by symbol', () => {
      // Generate signals for AAPL
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({ symbol: 'AAPL', volume: 10000 })
        );
      }
      mockStreamService.emit(
        'bar',
        createBar({ symbol: 'AAPL', volume: 50000 })
      );

      // Generate signals for GOOGL
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit(
          'bar',
          createBar({ symbol: 'GOOGL', volume: 10000 })
        );
      }
      mockStreamService.emit(
        'bar',
        createBar({ symbol: 'GOOGL', volume: 50000 })
      );

      const aaplSignals = signalService.getSignalsForSymbol('AAPL');
      const googlSignals = signalService.getSignalsForSymbol('googl'); // test case insensitivity

      expect(aaplSignals.every((s) => s.symbol === 'AAPL')).toBe(true);
      expect(googlSignals.every((s) => s.symbol === 'GOOGL')).toBe(true);
    });

    it('should respect limit in getRecentSignals', () => {
      // Generate multiple signals
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 10; i++) {
          mockStreamService.emit('bar', createBar({ volume: 10000 }));
        }
        mockStreamService.emit('bar', createBar({ volume: 50000 }));
      }

      const limited = signalService.getRecentSignals(2);
      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      signalService.updateConfig({
        volumeSpikeMultiplier: 5,
        minConfidence: 0.8,
      });

      const config = signalService.getConfig();
      expect(config.volumeSpikeMultiplier).toBe(5);
      expect(config.minConfidence).toBe(0.8);
    });

    it('should filter signals below min confidence', () => {
      // Set high confidence threshold
      signalService.updateConfig({ minConfidence: 0.99 });

      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      // Try to generate signals
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }
      mockStreamService.emit('bar', createBar({ volume: 40000 }));

      // Signals should be filtered out due to high threshold
      expect(signals).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear price history and signals', () => {
      // Build up data
      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }
      mockStreamService.emit('bar', createBar({ volume: 50000 }));

      expect(signalService.getPriceHistory('AAPL')).toBeDefined();
      expect(signalService.getRecentSignals().length).toBeGreaterThan(0);

      signalService.clear();

      expect(signalService.getPriceHistory('AAPL')).toBeUndefined();
      expect(signalService.getRecentSignals()).toHaveLength(0);
    });
  });

  describe('signal content', () => {
    it('should include correct target agents for volume spike', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }
      mockStreamService.emit('bar', createBar({ volume: 50000 }));

      const volumeSignal = signals.find((s) => s.type === 'volume_spike');
      expect(volumeSignal).toBeDefined();
      expect(volumeSignal!.targetAgents).toContain('leonardo');
      expect(volumeSignal!.targetAgents).toContain('donatello');
    });

    it('should include correct data fields', () => {
      const signals: TradingSignal[] = [];
      signalService.on('signal', (signal) => signals.push(signal));

      for (let i = 0; i < 10; i++) {
        mockStreamService.emit('bar', createBar({ volume: 10000 }));
      }
      mockStreamService.emit(
        'bar',
        createBar({
          volume: 50000,
          open: 100,
          close: 102,
        })
      );

      const signal = signals.find((s) => s.type === 'volume_spike');
      expect(signal).toBeDefined();
      expect(signal!.id).toMatch(/^signal-/);
      expect(signal!.confidence).toBeGreaterThan(0);
      expect(signal!.confidence).toBeLessThanOrEqual(1);
      expect(signal!.data.price).toBeDefined();
      expect(signal!.data.priceChange).toBeDefined();
      expect(signal!.data.priceChangePercent).toBeDefined();
      expect(signal!.data.volume).toBe(50000);
      expect(signal!.reason).toContain('Volume spike');
    });
  });
});
