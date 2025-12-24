/**
 * Technical Analysis Tools
 * Tools for technical indicators, price quotes, and dividend information
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { MarketDataService } from '../../services/marketData/index.js';
import {
  technicalIndicatorInputSchema,
  quoteInputSchema,
  dividendInputSchema,
} from '../schemas.js';

export interface TechnicalToolsDeps {
  marketData: MarketDataService;
  agentName: string;
}

/**
 * Creates technical analysis tools
 */
export function createTechnicalTools(deps: TechnicalToolsDeps) {
  const { marketData, agentName } = deps;

  return {
    getTechnicalIndicators: tool({
      description:
        'Get technical indicators (RSI, SMA, EMA, MACD) for a stock. Essential for technical analysis and identifying trading signals like overbought/oversold conditions, trend direction, and momentum.',
      inputSchema: technicalIndicatorInputSchema,
      execute: async ({ symbol, indicators, window }) => {
        Logger.info(
          `${agentName} fetching technical indicators for ${symbol}: ${indicators.join(', ')}`
        );

        const results: Record<string, any> = { symbol };

        for (const indicator of indicators) {
          try {
            const indicatorKey = indicator.toLowerCase() as
              | 'sma'
              | 'ema'
              | 'rsi'
              | 'macd';
            const data = await marketData.getTechnicalIndicator(
              symbol,
              indicatorKey,
              { window: window || (indicator === 'RSI' ? 14 : 20), limit: 5 }
            );

            // Get the most recent value
            const latestValue = data.values[0]?.value;
            const previousValue = data.values[1]?.value;

            results[indicator] = {
              current: latestValue?.toFixed(2),
              previous: previousValue?.toFixed(2),
              trend:
                latestValue > previousValue
                  ? 'rising'
                  : latestValue < previousValue
                    ? 'falling'
                    : 'flat',
              window: data.window,
            };

            // Add interpretation for RSI
            if (indicator === 'RSI' && latestValue) {
              results[indicator].interpretation =
                latestValue > 70
                  ? 'Overbought - consider selling'
                  : latestValue < 30
                    ? 'Oversold - consider buying'
                    : 'Neutral range';
            }
          } catch (error) {
            results[indicator] = {
              error: `Failed to fetch ${indicator}`,
            };
          }
        }

        return results;
      },
    }),

    getQuote: tool({
      description:
        'Get the current price quote and daily statistics for a stock. Use this to check current prices before trading.',
      inputSchema: quoteInputSchema,
      execute: async ({ symbol }) => {
        Logger.info(`${agentName} fetching quote for ${symbol}`);

        try {
          const snapshot = await marketData.getSnapshot(symbol);

          return {
            symbol: snapshot.symbol,
            price: `$${snapshot.price.toFixed(2)}`,
            change: `$${snapshot.change.toFixed(2)}`,
            changePercent: `${snapshot.changePercent.toFixed(2)}%`,
            dayRange: `$${snapshot.low.toFixed(2)} - $${snapshot.high.toFixed(2)}`,
            volume: snapshot.volume.toLocaleString(),
            note: snapshot.note,
          };
        } catch (error) {
          return {
            error: `Failed to get quote for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),

    getDividendHistory: tool({
      description:
        'Get dividend payment history and yield for a stock. Use this to evaluate dividend-paying stocks for income investing.',
      inputSchema: dividendInputSchema,
      execute: async ({ symbol, limit }) => {
        Logger.info(`${agentName} fetching dividend history for ${symbol}`);

        try {
          const dividendData = await marketData.getDividends(symbol, limit || 10);

          if (dividendData.dividends.length === 0) {
            return {
              symbol,
              message: `${symbol} does not appear to pay dividends or has no recent dividend history.`,
              dividends: [],
            };
          }

          const latestDividend = dividendData.dividends[0];

          return {
            symbol,
            dividendYield: dividendData.latestYield
              ? `${dividendData.latestYield.toFixed(2)}%`
              : 'Unknown',
            frequency: latestDividend.frequency,
            lastDividend: {
              amount: `$${latestDividend.cashAmount.toFixed(4)}`,
              exDate: latestDividend.exDividendDate,
              payDate: latestDividend.payDate,
            },
            recentPayments: dividendData.dividends.slice(0, 4).map((d) => ({
              amount: `$${d.cashAmount.toFixed(4)}`,
              exDate: d.exDividendDate,
            })),
            totalDividendsShown: dividendData.dividends.length,
          };
        } catch (error) {
          return {
            error: `Failed to get dividend history for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
  };
}
