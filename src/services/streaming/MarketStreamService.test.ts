import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketStreamService } from './MarketStreamService.js';
import type { MinuteBar, RawMinuteAggregateMessage } from './types.js';

// Create a mock WebSocket for testing
const mockSend = vi.fn();
const mockWs = {
  send: mockSend,
  onmessage: null as ((event: { data: string }) => void) | null,
};

// Mock the websocketClient from @massive.com/client-js
vi.mock('@massive.com/client-js', () => ({
  websocketClient: vi.fn(() => ({
    stocks: vi.fn(() => mockWs),
  })),
}));

describe('MarketStreamService', () => {
  let streamService: MarketStreamService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockClear();
    mockWs.onmessage = null;
    streamService = new MarketStreamService('test-api-key');
  });

  describe('initialization', () => {
    it('should initialize with API key', () => {
      expect(streamService.getStatus()).toBe('disconnected');
      expect(streamService.isConnected()).toBe(false);
    });

    it('should throw error without API key', () => {
      expect(() => new MarketStreamService('')).toThrow(
        'POLY_API_KEY is required'
      );
    });

    it('should start with empty subscriptions', () => {
      expect(streamService.getSubscriptions()).toEqual([]);
    });
  });

  describe('connection status', () => {
    it('should report disconnected initially', () => {
      expect(streamService.getStatus()).toBe('disconnected');
      expect(streamService.isConnected()).toBe(false);
    });

    it('should report connected after connect', () => {
      streamService.connect();

      expect(streamService.getStatus()).toBe('connected');
      expect(streamService.isConnected()).toBe(true);
    });

    it('should emit connected event', () => {
      const connectedHandler = vi.fn();
      streamService.on('connected', connectedHandler);

      streamService.connect();

      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', () => {
      streamService.connect();
      streamService.connect(); // Second call

      expect(streamService.getStatus()).toBe('connected');
    });
  });

  describe('disconnect', () => {
    it('should set status to disconnected', () => {
      streamService.connect();
      streamService.disconnect();

      expect(streamService.getStatus()).toBe('disconnected');
      expect(streamService.isConnected()).toBe(false);
    });

    it('should emit disconnected event', () => {
      const disconnectedHandler = vi.fn();
      streamService.on('disconnected', disconnectedHandler);

      streamService.connect();
      streamService.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should clear subscriptions on disconnect', () => {
      streamService.connect();
      streamService.subscribe(['AAPL', 'GOOGL']);
      streamService.disconnect();

      expect(streamService.getSubscriptions()).toEqual([]);
    });
  });

  describe('subscribe', () => {
    beforeEach(() => {
      streamService.connect();
    });

    it('should add symbols to subscriptions', () => {
      streamService.subscribe(['AAPL', 'GOOGL']);

      const subs = streamService.getSubscriptions();
      expect(subs).toContain('AAPL');
      expect(subs).toContain('GOOGL');
    });

    it('should normalize symbols to uppercase', () => {
      streamService.subscribe(['aapl', 'googl']);

      const subs = streamService.getSubscriptions();
      expect(subs).toContain('AAPL');
      expect(subs).toContain('GOOGL');
    });

    it('should not duplicate existing subscriptions', () => {
      streamService.subscribe(['AAPL']);
      streamService.subscribe(['AAPL', 'GOOGL']);

      const subs = streamService.getSubscriptions();
      expect(subs.filter((s) => s === 'AAPL')).toHaveLength(1);
    });

    it('should emit subscribed event with new symbols', () => {
      const subscribedHandler = vi.fn();
      streamService.on('subscribed', subscribedHandler);

      streamService.subscribe(['AAPL', 'GOOGL']);

      expect(subscribedHandler).toHaveBeenCalledWith(['AAPL', 'GOOGL']);
    });

    it('should handle empty array', () => {
      streamService.subscribe(['AAPL']);
      streamService.subscribe([]); // Empty

      expect(streamService.getSubscriptions()).toHaveLength(1);
    });

    it('should send subscription message when connected', () => {
      streamService.subscribe(['AAPL']);

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('AM.AAPL')
      );
    });
  });

  describe('unsubscribe', () => {
    beforeEach(() => {
      streamService.connect();
      streamService.subscribe(['AAPL', 'GOOGL', 'MSFT']);
    });

    it('should remove symbols from subscriptions', () => {
      streamService.unsubscribe(['AAPL']);

      const subs = streamService.getSubscriptions();
      expect(subs).not.toContain('AAPL');
      expect(subs).toContain('GOOGL');
      expect(subs).toContain('MSFT');
    });

    it('should normalize symbols to uppercase', () => {
      streamService.unsubscribe(['aapl']);

      expect(streamService.getSubscriptions()).not.toContain('AAPL');
    });

    it('should emit unsubscribed event', () => {
      const unsubscribedHandler = vi.fn();
      streamService.on('unsubscribed', unsubscribedHandler);

      streamService.unsubscribe(['AAPL']);

      expect(unsubscribedHandler).toHaveBeenCalledWith(['AAPL']);
    });

    it('should handle unsubscribe from non-existent symbol', () => {
      const unsubscribedHandler = vi.fn();
      streamService.on('unsubscribed', unsubscribedHandler);

      streamService.unsubscribe(['TSLA']); // Not subscribed

      expect(unsubscribedHandler).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      streamService.connect();
    });

    it('should emit bar event for minute aggregate messages', () => {
      const barHandler = vi.fn();
      streamService.on('bar', barHandler);

      // Simulate receiving a minute aggregate message
      const rawMessage: RawMinuteAggregateMessage = {
        ev: 'AM',
        sym: 'AAPL',
        o: 150.0,
        h: 151.5,
        l: 149.5,
        c: 151.0,
        v: 10000,
        vw: 150.5,
        s: Date.now() - 60000,
        e: Date.now(),
        z: 100,
      };

      // Trigger the onmessage handler
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify([rawMessage]) });
      }

      expect(barHandler).toHaveBeenCalled();
      const bar: MinuteBar = barHandler.mock.calls[0][0];
      expect(bar.symbol).toBe('AAPL');
      expect(bar.open).toBe(150.0);
      expect(bar.close).toBe(151.0);
      expect(bar.volume).toBe(10000);
    });

    it('should handle status messages', () => {
      const statusMessage = { ev: 'status', message: 'auth_success' };

      // Should not throw
      if (mockWs.onmessage) {
        expect(() =>
          mockWs.onmessage!({ data: JSON.stringify([statusMessage]) })
        ).not.toThrow();
      }
    });

    it('should handle unknown event types gracefully', () => {
      const unknownMessage = { ev: 'unknown_type', data: 'test' };

      if (mockWs.onmessage) {
        expect(() =>
          mockWs.onmessage!({ data: JSON.stringify([unknownMessage]) })
        ).not.toThrow();
      }
    });

    it('should handle malformed JSON gracefully', () => {
      if (mockWs.onmessage) {
        expect(() =>
          mockWs.onmessage!({ data: 'not valid json {{{' })
        ).not.toThrow();
      }
    });

    it('should handle single message (not array)', () => {
      const barHandler = vi.fn();
      streamService.on('bar', barHandler);

      const rawMessage: RawMinuteAggregateMessage = {
        ev: 'AM',
        sym: 'GOOGL',
        o: 100.0,
        h: 101.0,
        l: 99.0,
        c: 100.5,
        v: 5000,
        vw: 100.25,
        s: Date.now() - 60000,
        e: Date.now(),
        z: 50,
      };

      if (mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify(rawMessage) });
      }

      expect(barHandler).toHaveBeenCalled();
      expect(barHandler.mock.calls[0][0].symbol).toBe('GOOGL');
    });
  });

  describe('subscription persistence', () => {
    it('should track subscriptions before connecting', () => {
      // Subscribe before connecting
      streamService.subscribe(['AAPL', 'GOOGL']);

      expect(streamService.getSubscriptions()).toHaveLength(2);
    });

    it('should re-subscribe when connecting with existing subs', () => {
      // Subscribe before connecting
      streamService.subscribe(['AAPL']);

      // Now connect
      streamService.connect();

      // Should have called send with subscribe action
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('subscribe')
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('AM.AAPL')
      );
    });
  });

  describe('event emitter overrides', () => {
    it('should support on/off for typed events', () => {
      const handler = vi.fn();

      streamService.on('connected', handler);
      streamService.connect();
      expect(handler).toHaveBeenCalledTimes(1);

      streamService.off('connected', handler);
      streamService.disconnect();
      streamService.connect();
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should support error events', () => {
      const errorHandler = vi.fn();
      streamService.on('error', errorHandler);

      // Emit error manually for test
      streamService.emit('error', new Error('Test error'));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
