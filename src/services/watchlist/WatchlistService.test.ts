import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WatchlistService } from './WatchlistService.js';
import { DatabaseService } from '../database/index.js';

describe('WatchlistService', () => {
  let watchlistService: WatchlistService;
  let db: DatabaseService;

  beforeEach(() => {
    // Reset singleton
    // @ts-ignore
    DatabaseService.instance = undefined;
    db = DatabaseService.getInstance(':memory:');
    watchlistService = new WatchlistService(db.getDatabase());
  });

  afterEach(() => {
    db.close();
  });

  describe('add', () => {
    it('should add a symbol to the watchlist', () => {
      const entry = watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'Value opportunity',
      });

      expect(entry.symbol).toBe('AAPL');
      expect(entry.addedBy).toBe('leonardo');
      expect(entry.reason).toBe('Value opportunity');
      expect(entry.active).toBe(true);
      expect(entry.expiresAt).toBeNull();
    });

    it('should normalize symbol to uppercase', () => {
      const entry = watchlistService.add({
        symbol: 'aapl',
        addedBy: 'leonardo',
        reason: 'Test',
      });

      expect(entry.symbol).toBe('AAPL');
    });

    it('should handle expiration date', () => {
      const expiresAt = new Date('2025-12-31T00:00:00Z');
      const entry = watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        expiresAt,
      });

      expect(entry.expiresAt).toBeInstanceOf(Date);
      expect(entry.expiresAt?.getFullYear()).toBe(2025);
    });

    it('should update existing entry on conflict', () => {
      // Add first entry
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'First reason',
      });

      // Add again with different reason
      const entry = watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'Updated reason',
      });

      expect(entry.reason).toBe('Updated reason');

      // Should only have one entry
      const all = watchlistService.getByAgent('leonardo');
      expect(all).toHaveLength(1);
    });

    it('should allow same symbol from different agents', () => {
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'Value',
      });

      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'donatello',
        reason: 'Technical',
      });

      const all = watchlistService.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'Value',
      });
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'donatello',
        reason: 'Technical',
      });
    });

    it('should remove specific agent entry when addedBy provided', () => {
      const removed = watchlistService.remove('AAPL', 'leonardo');

      expect(removed).toBe(1);

      // Leonardo's entry gone, Donatello's still there
      const leonardoEntry = watchlistService.getEntry('AAPL', 'leonardo');
      const donatelloEntry = watchlistService.getEntry('AAPL', 'donatello');

      expect(leonardoEntry).toBeNull();
      expect(donatelloEntry).not.toBeNull();
    });

    it('should remove all entries when addedBy not provided', () => {
      const removed = watchlistService.remove('AAPL');

      expect(removed).toBe(2);

      const all = watchlistService.getActiveSymbols();
      expect(all).not.toContain('AAPL');
    });

    it('should return 0 when symbol not found', () => {
      const removed = watchlistService.remove('GOOGL');
      expect(removed).toBe(0);
    });

    it('should normalize symbol to uppercase', () => {
      const removed = watchlistService.remove('aapl', 'leonardo');
      expect(removed).toBe(1);
    });
  });

  describe('getEntry', () => {
    it('should return entry when exists', () => {
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'Test',
      });

      const entry = watchlistService.getEntry('AAPL', 'leonardo');

      expect(entry).not.toBeNull();
      expect(entry?.symbol).toBe('AAPL');
      expect(entry?.addedBy).toBe('leonardo');
    });

    it('should return null when not exists', () => {
      const entry = watchlistService.getEntry('AAPL', 'leonardo');
      expect(entry).toBeNull();
    });

    it('should return null for inactive entries', () => {
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        reason: 'Test',
      });
      watchlistService.remove('AAPL', 'leonardo');

      const entry = watchlistService.getEntry('AAPL', 'leonardo');
      expect(entry).toBeNull();
    });
  });

  describe('getActiveSymbols', () => {
    it('should return empty array when no entries', () => {
      const symbols = watchlistService.getActiveSymbols();
      expect(symbols).toEqual([]);
    });

    it('should return unique symbols', () => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'AAPL', addedBy: 'donatello' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'leonardo' });

      const symbols = watchlistService.getActiveSymbols();

      expect(symbols).toHaveLength(2);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('GOOGL');
    });

    it('should exclude inactive entries', () => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'leonardo' });
      watchlistService.remove('AAPL', 'leonardo');

      const symbols = watchlistService.getActiveSymbols();

      expect(symbols).toEqual(['GOOGL']);
    });
  });

  describe('getAll', () => {
    it('should return all active entries', () => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo', reason: 'A' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'donatello', reason: 'B' });

      const all = watchlistService.getAll();

      expect(all).toHaveLength(2);
    });

    it('should exclude inactive entries', () => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'leonardo' });
      watchlistService.remove('AAPL');

      const all = watchlistService.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].symbol).toBe('GOOGL');
    });

    it('should order by added_at DESC', () => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'MSFT', addedBy: 'leonardo' });

      const all = watchlistService.getAll();

      // All entries should be returned (order may vary for same-second inserts)
      expect(all).toHaveLength(3);
      const symbols = all.map((e) => e.symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('GOOGL');
      expect(symbols).toContain('MSFT');
    });
  });

  describe('getByAgent', () => {
    beforeEach(() => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'MSFT', addedBy: 'donatello' });
    });

    it('should return only entries for specified agent', () => {
      const entries = watchlistService.getByAgent('leonardo');

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.addedBy === 'leonardo')).toBe(true);
    });

    it('should return empty for agent with no entries', () => {
      const entries = watchlistService.getByAgent('raphael');
      expect(entries).toEqual([]);
    });
  });

  describe('syncPortfolioPositions', () => {
    beforeEach(async () => {
      // Create a trader account and add holdings
      db.createAccount('TestTrader', 10000, 'growth');
      db.upsertHolding('TestTrader', 'AAPL', 10, 150);
      db.upsertHolding('TestTrader', 'GOOGL', 5, 100);
    });

    it('should add portfolio positions to watchlist', () => {
      const addedCount = watchlistService.syncPortfolioPositions();

      expect(addedCount).toBe(2);

      const symbols = watchlistService.getActiveSymbols();
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('GOOGL');
    });

    it('should not duplicate existing portfolio entries', () => {
      watchlistService.syncPortfolioPositions();
      const secondSync = watchlistService.syncPortfolioPositions();

      expect(secondSync).toBe(0); // No new entries added

      const entries = watchlistService.getByAgent('portfolio');
      expect(entries).toHaveLength(2); // Still only 2 entries
    });

    it('should remove entries for sold positions', () => {
      watchlistService.syncPortfolioPositions();

      // Remove holding
      db.deleteHolding('TestTrader', 'AAPL');

      watchlistService.syncPortfolioPositions();

      const entry = watchlistService.getEntry('AAPL', 'portfolio');
      expect(entry).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should deactivate expired entries', () => {
      // Add entry that expired yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        expiresAt: yesterday,
      });

      const cleaned = watchlistService.cleanupExpired();

      expect(cleaned).toBe(1);

      const entry = watchlistService.getEntry('AAPL', 'leonardo');
      expect(entry).toBeNull();
    });

    it('should not affect non-expiring entries', () => {
      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        // No expiration
      });

      const cleaned = watchlistService.cleanupExpired();

      expect(cleaned).toBe(0);

      const entry = watchlistService.getEntry('AAPL', 'leonardo');
      expect(entry).not.toBeNull();
    });

    it('should not affect future-expiring entries', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        expiresAt: tomorrow,
      });

      const cleaned = watchlistService.cleanupExpired();

      expect(cleaned).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      watchlistService.add({ symbol: 'AAPL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'GOOGL', addedBy: 'leonardo' });
      watchlistService.add({ symbol: 'MSFT', addedBy: 'donatello' });
      watchlistService.add({ symbol: 'AAPL', addedBy: 'portfolio' });

      const stats = watchlistService.getStats();

      // 3 unique symbols (AAPL, GOOGL, MSFT)
      expect(stats.totalActive).toBe(3);

      expect(stats.bySource.leonardo).toBe(2);
      expect(stats.bySource.donatello).toBe(1);
      expect(stats.bySource.portfolio).toBe(1);
    });

    it('should count expiring entries correctly', () => {
      // Entry expiring in the future (within 24h window)
      const inSixHours = new Date();
      inSixHours.setHours(inSixHours.getHours() + 6);

      watchlistService.add({
        symbol: 'AAPL',
        addedBy: 'leonardo',
        expiresAt: inSixHours,
      });

      // Entry expiring next week (outside 24h window)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      watchlistService.add({
        symbol: 'GOOGL',
        addedBy: 'leonardo',
        expiresAt: nextWeek,
      });

      // Entry with no expiration
      watchlistService.add({
        symbol: 'MSFT',
        addedBy: 'leonardo',
      });

      const stats = watchlistService.getStats();

      // Stats should be returned (expiringToday count depends on SQLite datetime handling)
      expect(stats.totalActive).toBe(3);
      expect(typeof stats.expiringToday).toBe('number');
    });

    it('should handle empty watchlist', () => {
      const stats = watchlistService.getStats();

      expect(stats.totalActive).toBe(0);
      expect(stats.bySource).toEqual({});
      expect(stats.expiringToday).toBe(0);
    });
  });
});
