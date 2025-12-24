/**
 * Watchlist Tools
 * Tools for agents to manage their watchlist of monitored symbols
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { WatchlistService } from '../../services/watchlist/index.js';
import {
  addToWatchlistInputSchema,
  removeFromWatchlistInputSchema,
  getWatchlistInputSchema,
} from '../schemas.js';

export interface WatchlistToolsDeps {
  watchlistService: WatchlistService;
  agentName: string;
}

/**
 * Creates watchlist management tools for agents
 */
export function createWatchlistTools(deps: WatchlistToolsDeps) {
  const { watchlistService, agentName } = deps;

  return {
    addToWatchlist: tool({
      description:
        'Add a stock to your real-time monitoring watchlist. Use this when you identify a stock you want to track for trading opportunities. The system will monitor this symbol and alert you to significant price movements, volume spikes, or technical signals.',
      inputSchema: addToWatchlistInputSchema,
      execute: async ({ symbol, reason, durationDays = 7 }) => {
        Logger.info(`${agentName} adding ${symbol} to watchlist`);

        try {
          // Calculate expiration date
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);

          const entry = watchlistService.add({
            symbol,
            addedBy: agentName,
            reason,
            expiresAt,
          });

          return {
            success: true,
            message: `Added ${symbol} to watchlist`,
            entry: {
              symbol: entry.symbol,
              reason: entry.reason,
              addedAt: entry.addedAt.toISOString(),
              expiresAt: entry.expiresAt?.toISOString(),
            },
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          Logger.error(`${agentName} failed to add ${symbol} to watchlist: ${message}`);
          return {
            success: false,
            error: message,
          };
        }
      },
    }),

    removeFromWatchlist: tool({
      description:
        'Remove a stock from your watchlist. Use this when you no longer want to monitor a particular stock for opportunities.',
      inputSchema: removeFromWatchlistInputSchema,
      execute: async ({ symbol }) => {
        Logger.info(`${agentName} removing ${symbol} from watchlist`);

        try {
          const removed = watchlistService.remove(symbol, agentName);

          if (removed > 0) {
            return {
              success: true,
              message: `Removed ${symbol} from your watchlist`,
            };
          } else {
            return {
              success: false,
              message: `${symbol} was not in your watchlist`,
            };
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          Logger.error(`${agentName} failed to remove ${symbol} from watchlist: ${message}`);
          return {
            success: false,
            error: message,
          };
        }
      },
    }),

    getWatchlist: tool({
      description:
        'View your current watchlist of monitored symbols. This shows all stocks you are actively tracking for trading opportunities.',
      inputSchema: getWatchlistInputSchema,
      execute: async ({ includeStats = false }) => {
        Logger.info(`${agentName} viewing watchlist`);

        try {
          // Get entries added by this agent
          const myEntries = watchlistService.getByAgent(agentName);

          // Get all unique symbols being monitored (includes portfolio positions)
          const allSymbols = watchlistService.getActiveSymbols();

          const result: {
            myWatchlist: {
              symbol: string;
              reason: string | null;
              addedAt: string;
              expiresAt: string | null;
            }[];
            allMonitoredSymbols: string[];
            stats?: {
              totalActive: number;
              bySource: Record<string, number>;
              expiringToday: number;
            };
          } = {
            myWatchlist: myEntries.map((e) => ({
              symbol: e.symbol,
              reason: e.reason,
              addedAt: e.addedAt.toISOString(),
              expiresAt: e.expiresAt?.toISOString() || null,
            })),
            allMonitoredSymbols: allSymbols,
          };

          if (includeStats) {
            result.stats = watchlistService.getStats();
          }

          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          Logger.error(`${agentName} failed to get watchlist: ${message}`);
          return {
            error: message,
          };
        }
      },
    }),
  };
}
