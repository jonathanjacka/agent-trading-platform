/**
 * Market Stream Service
 * WebSocket client for real-time market data from Polygon.io/Massive
 */

import { websocketClient } from '@massive.com/client-js';
import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger.js';
import type {
  MinuteBar,
  RawMinuteAggregateMessage,
  ConnectionStatus,
  MarketStreamEvents,
} from './types.js';

// WebSocket URLs
// delayed.massive.com for Starter tier (15-min delayed)
// socket.massive.com for real-time (Business tier)
const WS_URL = 'wss://delayed.massive.com';

/** Maximum reconnection attempts */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay for exponential backoff (ms) */
const RECONNECT_BASE_DELAY = 1000;

export class MarketStreamService extends EventEmitter {
  private apiKey: string;
  private ws: ReturnType<ReturnType<typeof websocketClient>['stocks']> | null =
    null;
  private subscriptions: Set<string> = new Set();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionalDisconnect: boolean = false;

  constructor(apiKey: string) {
    super();
    if (!apiKey) {
      throw new Error('POLY_API_KEY is required for MarketStreamService');
    }
    this.apiKey = apiKey;
    Logger.info('MarketStreamService initialized');
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (
      this.connectionStatus === 'connected' ||
      this.connectionStatus === 'connecting'
    ) {
      Logger.info('MarketStreamService already connected or connecting');
      return;
    }

    this.isIntentionalDisconnect = false;
    this.connectionStatus = 'connecting';
    Logger.info(`Connecting to ${WS_URL}...`);

    try {
      // Create WebSocket client
      const client = websocketClient(this.apiKey, WS_URL);
      this.ws = client.stocks();

      // Set up message handler
      this.ws.onmessage = (event: { data: string }) => {
        this.handleMessage(event.data);
      };

      // Handle connection open - re-subscribe to symbols
      // Note: The massive client handles authentication automatically
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      Logger.success('MarketStreamService connected');
      this.emit('connected');

      // Re-subscribe to any existing subscriptions
      if (this.subscriptions.size > 0) {
        const symbols = Array.from(this.subscriptions);
        Logger.info(`Re-subscribing to ${symbols.length} symbols`);
        this.sendSubscription(symbols, 'subscribe');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`WebSocket connection error: ${message}`);
      this.connectionStatus = 'disconnected';
      this.emit('error', new Error(`Connection failed: ${message}`));
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.connectionStatus = 'disconnected';

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        // Unsubscribe from all symbols before closing
        if (this.subscriptions.size > 0) {
          const symbols = Array.from(this.subscriptions);
          this.sendSubscription(symbols, 'unsubscribe');
        }
        // The massive client doesn't expose a close method directly
        // Setting to null will allow garbage collection
        this.ws = null;
      } catch (error) {
        Logger.error(
          `Error during disconnect: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }

    this.subscriptions.clear();
    Logger.info('MarketStreamService disconnected');
    this.emit('disconnected');
  }

  /**
   * Subscribe to minute aggregates for symbols
   */
  subscribe(symbols: string[]): void {
    const normalizedSymbols = symbols.map((s) => s.toUpperCase().trim());
    const newSymbols = normalizedSymbols.filter(
      (s) => !this.subscriptions.has(s)
    );

    if (newSymbols.length === 0) {
      Logger.info('All symbols already subscribed');
      return;
    }

    // Add to tracking set
    newSymbols.forEach((s) => this.subscriptions.add(s));

    // Send subscription if connected
    if (this.connectionStatus === 'connected' && this.ws) {
      this.sendSubscription(newSymbols, 'subscribe');
    }

    Logger.info(`Subscribed to ${newSymbols.length} symbols: ${newSymbols.join(', ')}`);
    this.emit('subscribed', newSymbols);
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[]): void {
    const normalizedSymbols = symbols.map((s) => s.toUpperCase().trim());
    const existingSymbols = normalizedSymbols.filter((s) =>
      this.subscriptions.has(s)
    );

    if (existingSymbols.length === 0) {
      return;
    }

    // Remove from tracking set
    existingSymbols.forEach((s) => this.subscriptions.delete(s));

    // Send unsubscription if connected
    if (this.connectionStatus === 'connected' && this.ws) {
      this.sendSubscription(existingSymbols, 'unsubscribe');
    }

    Logger.info(`Unsubscribed from ${existingSymbols.length} symbols`);
    this.emit('unsubscribed', existingSymbols);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get currently subscribed symbols
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  /**
   * Send subscription/unsubscription message
   */
  private sendSubscription(
    symbols: string[],
    action: 'subscribe' | 'unsubscribe'
  ): void {
    if (!this.ws) return;

    // Subscribe to AM.* (Aggregates per Minute) for each symbol
    const params = symbols.map((s) => `AM.${s}`).join(',');
    const message = JSON.stringify({ action, params });

    try {
      this.ws.send(message);
      Logger.info(`Sent ${action}: ${params}`);
    } catch (error) {
      Logger.error(
        `Failed to send ${action}: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const messages = JSON.parse(data);

      // Messages come as an array
      const messageArray = Array.isArray(messages) ? messages : [messages];

      for (const msg of messageArray) {
        this.processMessage(msg);
      }
    } catch (error) {
      Logger.error(
        `Failed to parse WebSocket message: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Process a single message
   */
  private processMessage(msg: RawMinuteAggregateMessage | { ev: string; status?: string; message?: string }): void {
    switch (msg.ev) {
      case 'AM':
        // Minute aggregate
        this.handleMinuteAggregate(msg as RawMinuteAggregateMessage);
        break;
      case 'status':
        // Status message (connection, auth, etc.)
        Logger.info(`WebSocket status: ${(msg as { message?: string }).message || 'OK'}`);
        break;
      default:
        // Ignore other event types
        break;
    }
  }

  /**
   * Handle minute aggregate message
   */
  private handleMinuteAggregate(msg: RawMinuteAggregateMessage): void {
    const bar: MinuteBar = {
      symbol: msg.sym,
      open: msg.o,
      high: msg.h,
      low: msg.l,
      close: msg.c,
      volume: msg.v,
      vwap: msg.vw,
      timestamp: new Date(),
      startTimestamp: new Date(msg.s),
      endTimestamp: new Date(msg.e),
    };

    this.emit('bar', bar);
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.isIntentionalDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      Logger.error(
        `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      this.emit(
        'error',
        new Error('Max reconnection attempts reached')
      );
      return;
    }

    this.connectionStatus = 'reconnecting';
    this.reconnectAttempts++;

    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1);
    Logger.info(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Type-safe event emitter overrides
  override emit<K extends keyof MarketStreamEvents>(
    event: K,
    ...args: Parameters<MarketStreamEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof MarketStreamEvents>(
    event: K,
    listener: MarketStreamEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override off<K extends keyof MarketStreamEvents>(
    event: K,
    listener: MarketStreamEvents[K]
  ): this {
    return super.off(event, listener);
  }
}
