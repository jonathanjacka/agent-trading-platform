/**
 * Watchlist Types
 * Type definitions for watchlist management
 */

/** Source of watchlist entry */
export type WatchlistSource = 'agent' | 'portfolio' | 'screener' | 'manual';

/** Watchlist entry from database */
export interface WatchlistEntry {
  id: number;
  symbol: string;
  addedBy: string;
  reason: string | null;
  addedAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

/** Input for adding to watchlist */
export interface AddWatchlistInput {
  symbol: string;
  addedBy: string;
  reason?: string;
  expiresAt?: Date;
}

/** Row from database */
export interface WatchlistRow {
  id: number;
  symbol: string;
  added_by: string;
  reason: string | null;
  added_at: string;
  expires_at: string | null;
  active: number;
}
