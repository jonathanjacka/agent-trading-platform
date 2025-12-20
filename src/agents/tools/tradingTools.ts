/**
 * Trading Tools
 * Tools for executing trades and managing portfolio
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { AccountService } from '../../services/account/index.js';
import { emptyInputSchema, tradeInputSchema } from '../schemas.js';

export interface TradingToolsDeps {
  accountService: AccountService;
  agentName: string;
  getCurrentPrompt: () => string | undefined;
}

/**
 * Creates trading-related tools
 */
export function createTradingTools(deps: TradingToolsDeps) {
  const { accountService, agentName, getCurrentPrompt } = deps;

  return {
    getPortfolio: tool({
      description:
        'Get current portfolio holdings with real-time valuations and cash balance',
      inputSchema: emptyInputSchema,
      execute: async () => {
        Logger.portfolio(agentName, 'Checking portfolio');

        const portfolio = await accountService.getPortfolio(agentName);

        return {
          cash: portfolio.cash,
          holdings: portfolio.holdings.map((h) => ({
            symbol: h.symbol,
            shares: h.quantity,
            avgPrice: h.avgPrice,
            currentPrice: h.currentPrice,
            currentValue: h.currentValue,
            gain: h.gain,
            gainPercent: `${h.gainPercent.toFixed(2)}%`,
          })),
          totalHoldingsValue: portfolio.totalHoldingsValue,
          totalValue: portfolio.totalValue,
          totalGain: portfolio.totalGain,
          totalGainPercent: `${portfolio.totalGainPercent.toFixed(2)}%`,
        };
      },
    }),

    buyStock: tool({
      description:
        'Buy shares of a stock. Provide the symbol, quantity, and rationale.',
      inputSchema: tradeInputSchema,
      execute: async ({ symbol, quantity, rationale }) => {
        const result = await accountService.buyStock(
          agentName,
          symbol,
          quantity,
          rationale,
          getCurrentPrompt()
        );

        if (!result.success) {
          Logger.warn(`Buy order failed: ${result.message}`);
        } else {
          await accountService.recordPortfolioSnapshot(agentName);
        }

        return result;
      },
    }),

    sellStock: tool({
      description:
        'Sell shares of a stock. Provide the symbol, quantity, and rationale.',
      inputSchema: tradeInputSchema,
      execute: async ({ symbol, quantity, rationale }) => {
        const result = await accountService.sellStock(
          agentName,
          symbol,
          quantity,
          rationale,
          getCurrentPrompt()
        );

        if (!result.success) {
          Logger.warn(`Sell order failed: ${result.message}`);
        } else {
          await accountService.recordPortfolioSnapshot(agentName);
        }

        return result;
      },
    }),
  };
}
