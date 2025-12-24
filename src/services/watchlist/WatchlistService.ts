/**
 * Watchlist Service
 * Manages the watchlist of symbols to monitor for trading signals
 */

import Database from 'better-sqlite3';
import { Logger } from '../../utils/logger.js';
import type {
  WatchlistEntry,
  AddWatchlistInput,
  WatchlistRow,
} from './types.js';

export class WatchlistService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Add a symbol to the watchlist
   */
  add(input: AddWatchlistInput): WatchlistEntry {
    const { symbol, addedBy, reason, expiresAt } = input;
    const normalizedSymbol = symbol.toUpperCase().trim();

    Logger.info(`Adding ${normalizedSymbol} to watchlist (by: ${addedBy})`);

    const stmt = this.db.prepare(`
      INSERT INTO watchlist (symbol, added_by, reason, expires_at, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(symbol, added_by) DO UPDATE SET
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        active = 1,
        added_at = datetime('now')
    `);

    stmt.run(
      normalizedSymbol,
      addedBy,
      reason || null,
      expiresAt?.toISOString() || null
    );

    // Return the inserted/updated entry
    const entry = this.getEntry(normalizedSymbol, addedBy);
    if (!entry) {
      throw new Error(`Failed to add ${normalizedSymbol} to watchlist`);
    }

    return entry;
  }

  /**
   * Remove a symbol from the watchlist
   * If addedBy is specified, only remove that specific entry
   * Otherwise, deactivate all entries for the symbol
   */
  remove(symbol: string, addedBy?: string): number {
    const normalizedSymbol = symbol.toUpperCase().trim();

    if (addedBy) {
      Logger.info(
        `Removing ${normalizedSymbol} from watchlist (by: ${addedBy})`
      );
      const stmt = this.db.prepare(`
        UPDATE watchlist SET active = 0 WHERE symbol = ? AND added_by = ?
      `);
      const result = stmt.run(normalizedSymbol, addedBy);
      return result.changes;
    } else {
      Logger.info(`Removing ${normalizedSymbol} from watchlist (all entries)`);
      const stmt = this.db.prepare(`
        UPDATE watchlist SET active = 0 WHERE symbol = ?
      `);
      const result = stmt.run(normalizedSymbol);
      return result.changes;
    }
  }

  /**
   * Get a specific watchlist entry
   */
  getEntry(symbol: string, addedBy: string): WatchlistEntry | null {
    const normalizedSymbol = symbol.toUpperCase().trim();
    const stmt = this.db.prepare(`
      SELECT * FROM watchlist WHERE symbol = ? AND added_by = ? AND active = 1
    `);
    const row = stmt.get(normalizedSymbol, addedBy) as WatchlistRow | undefined;
    return row ? this.rowToEntry(row) : null;
  }

  /**
   * Get all active symbols (unique list)
   */
  getActiveSymbols(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT symbol FROM watchlist 
      WHERE active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `);
    const rows = stmt.all() as { symbol: string }[];
    return rows.map((r) => r.symbol);
  }

  /**
   * Get all active watchlist entries
   */
  getAll(): WatchlistEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM watchlist 
      WHERE active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY added_at DESC
    `);
    const rows = stmt.all() as WatchlistRow[];
    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Get watchlist entries for a specific agent
   */
  getByAgent(agentName: string): WatchlistEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM watchlist 
      WHERE added_by = ? AND active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY added_at DESC
    `);
    const rows = stmt.all(agentName) as WatchlistRow[];
    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Sync portfolio positions to watchlist
   * Adds all current holdings as watchlist entries with source 'portfolio'
   */
  syncPortfolioPositions(): number {
    Logger.info('Syncing portfolio positions to watchlist');

    // Get all unique symbols from holdings
    const holdingsStmt = this.db.prepare(`
      SELECT DISTINCT symbol FROM holdings WHERE quantity > 0
    `);
    const holdings = holdingsStmt.all() as { symbol: string }[];

    let addedCount = 0;
    for (const holding of holdings) {
      const existing = this.getEntry(holding.symbol, 'portfolio');
      if (!existing) {
        this.add({
          symbol: holding.symbol,
          addedBy: 'portfolio',
          reason: 'Current portfolio position',
          // Portfolio positions never expire
          expiresAt: undefined,
        });
        addedCount++;
      }
    }

    // Deactivate portfolio entries for symbols no longer held
    const deactivateStmt = this.db.prepare(`
      UPDATE watchlist 
      SET active = 0 
      WHERE added_by = 'portfolio' 
      AND symbol NOT IN (SELECT DISTINCT symbol FROM holdings WHERE quantity > 0)
    `);
    deactivateStmt.run();

    Logger.info(`Synced ${addedCount} new portfolio positions to watchlist`);
    return addedCount;
  }

  /**
   * Clean up expired watchlist entries
   */
  cleanupExpired(): number {
    Logger.info('Cleaning up expired watchlist entries');

    const stmt = this.db.prepare(`
      UPDATE watchlist 
      SET active = 0 
      WHERE expires_at IS NOT NULL 
      AND expires_at <= datetime('now') 
      AND active = 1
    `);
    const result = stmt.run();

    if (result.changes > 0) {
      Logger.info(`Deactivated ${result.changes} expired watchlist entries`);
    }

    return result.changes;
  }

  /**
   * Get watchlist statistics
   */
  getStats(): {
    totalActive: number;
    bySource: Record<string, number>;
    expiringToday: number;
  } {
    const totalStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT symbol) as count FROM watchlist 
      WHERE active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `);
    const totalResult = totalStmt.get() as { count: number };

    const bySourceStmt = this.db.prepare(`
      SELECT added_by, COUNT(DISTINCT symbol) as count FROM watchlist 
      WHERE active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      GROUP BY added_by
    `);
    const bySourceRows = bySourceStmt.all() as {
      added_by: string;
      count: number;
    }[];
    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) {
      bySource[row.added_by] = row.count;
    }

    const expiringStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM watchlist 
      WHERE active = 1 
      AND expires_at IS NOT NULL 
      AND expires_at <= datetime('now', '+1 day')
    `);
    const expiringResult = expiringStmt.get() as { count: number };

    return {
      totalActive: totalResult.count,
      bySource,
      expiringToday: expiringResult.count,
    };
  }

  /**
   * Convert database row to WatchlistEntry
   */
  private rowToEntry(row: WatchlistRow): WatchlistEntry {
    return {
      id: row.id,
      symbol: row.symbol,
      addedBy: row.added_by,
      reason: row.reason,
      addedAt: new Date(row.added_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      active: Boolean(row.active),
    };
  }
}
