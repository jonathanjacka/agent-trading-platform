/**
 * Risk Management Tools
 * Tools for analyzing and managing portfolio risk
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { AccountService } from '../../services/account/index.js';
import { RiskService, type PortfolioData } from '../../services/risk/index.js';
import {
  emptyInputSchema,
  positionRiskInputSchema,
  evaluateTradeRiskInputSchema,
} from '../schemas.js';

export interface RiskToolsDeps {
  accountService: AccountService;
  riskService: RiskService;
  agentName: string;
}

/**
 * Convert AccountService portfolio format to RiskService format
 */
async function getPortfolioData(
  accountService: AccountService,
  agentName: string
): Promise<PortfolioData> {
  const portfolio = await accountService.getPortfolio(agentName);
  return {
    cash: portfolio.cash,
    holdings: portfolio.holdings.map((h) => ({
      symbol: h.symbol,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      currentPrice: h.currentPrice,
      currentValue: h.currentValue,
      gain: h.gain,
      gainPercent: h.gainPercent,
    })),
    totalValue: portfolio.totalValue,
    totalHoldingsValue: portfolio.totalHoldingsValue,
  };
}

/**
 * Creates risk management tools
 */
export function createRiskTools(deps: RiskToolsDeps) {
  const { accountService, riskService, agentName } = deps;

  return {
    getPositionRisk: tool({
      description:
        'Analyze risk for a specific position. Returns risk level, warnings, stop loss price, take profit price, and portfolio concentration.',
      inputSchema: positionRiskInputSchema,
      execute: async ({ symbol }) => {
        Logger.info(`${agentName} analyzing position risk for ${symbol}`);

        const portfolio = await getPortfolioData(accountService, agentName);
        const risk = riskService.analyzePositionRisk(symbol, portfolio);

        if (!risk) {
          return {
            error: `No position found for ${symbol}`,
            symbol,
          };
        }

        return {
          symbol: risk.symbol,
          quantity: risk.quantity,
          avgPrice: risk.avgPrice,
          currentPrice: risk.currentPrice,
          currentValue: risk.currentValue,
          unrealizedPnL: risk.unrealizedPnL,
          unrealizedPnLPercent: `${risk.unrealizedPnLPercent.toFixed(2)}%`,
          portfolioPercent: `${risk.portfolioPercent.toFixed(1)}%`,
          riskLevel: risk.riskLevel,
          stopLossPrice: risk.stopLossPrice,
          takeProfitPrice: risk.takeProfitPrice,
          warnings: risk.warnings,
        };
      },
    }),

    getPortfolioRisk: tool({
      description:
        'Analyze overall portfolio risk. Returns concentration level, risk score, diversification analysis, and recommendations.',
      inputSchema: emptyInputSchema,
      execute: async () => {
        Logger.info(`${agentName} analyzing portfolio risk`);

        const portfolio = await getPortfolioData(accountService, agentName);
        const risk = riskService.analyzePortfolioRisk(portfolio);

        return {
          totalValue: risk.totalValue,
          cashPercent: `${risk.cashPercent.toFixed(1)}%`,
          investedPercent: `${risk.investedPercent.toFixed(1)}%`,
          positionCount: risk.positionCount,
          largestPosition: risk.largestPosition
            ? {
                symbol: risk.largestPosition.symbol,
                percent: `${risk.largestPosition.percent.toFixed(1)}%`,
              }
            : null,
          concentration: risk.concentration,
          totalUnrealizedPnL: risk.totalUnrealizedPnL,
          totalUnrealizedPnLPercent: `${risk.totalUnrealizedPnLPercent.toFixed(2)}%`,
          riskScore: risk.riskScore,
          riskScoreDescription:
            risk.riskScore < 20
              ? 'Low risk'
              : risk.riskScore < 50
                ? 'Moderate risk'
                : risk.riskScore < 75
                  ? 'High risk'
                  : 'Critical risk',
          warnings: risk.warnings,
          recommendations: risk.recommendations,
        };
      },
    }),

    evaluateTradeRisk: tool({
      description:
        'Evaluate risk BEFORE executing a trade. Returns approval status, risk level, and any warnings or blockers. Use this before buying or selling to ensure the trade is within risk limits.',
      inputSchema: evaluateTradeRiskInputSchema,
      execute: async ({ tradeType, symbol, quantity, estimatedPrice }) => {
        Logger.info(
          `${agentName} evaluating trade risk: ${tradeType} ${quantity} ${symbol} @ $${estimatedPrice}`
        );

        const portfolio = await getPortfolioData(accountService, agentName);
        const evaluation = riskService.evaluateTradeRisk(
          tradeType,
          symbol,
          quantity,
          estimatedPrice,
          portfolio
        );

        return {
          approved: evaluation.approved,
          tradeType: evaluation.tradeType,
          symbol: evaluation.symbol,
          quantity: evaluation.quantity,
          estimatedPrice: evaluation.estimatedPrice,
          estimatedTotal: evaluation.estimatedTotal,
          postTradePositionPercent: `${evaluation.postTradePositionPercent.toFixed(1)}%`,
          postTradeCashPercent: `${evaluation.postTradeCashPercent.toFixed(1)}%`,
          riskLevel: evaluation.riskLevel,
          warnings: evaluation.warnings,
          blockers: evaluation.blockers,
          suggestions: evaluation.suggestions,
          recommendation:
            evaluation.blockers.length > 0
              ? `DO NOT PROCEED: ${evaluation.blockers.join('; ')}`
              : evaluation.warnings.length > 0
                ? `PROCEED WITH CAUTION: ${evaluation.warnings.join('; ')}`
                : 'Trade appears safe to execute',
        };
      },
    }),

    getRiskLimits: tool({
      description:
        'Get current risk management limits (max position size, min cash, stop loss defaults, etc.)',
      inputSchema: emptyInputSchema,
      execute: async () => {
        Logger.info(`${agentName} retrieving risk limits`);

        const limits = riskService.getRiskLimits();

        return {
          maxPositionPercent: `${limits.maxPositionPercent}%`,
          maxPositionDescription: `Maximum ${limits.maxPositionPercent}% of portfolio in a single position`,
          maxSectorPercent: `${limits.maxSectorPercent}%`,
          maxSectorDescription: `Maximum ${limits.maxSectorPercent}% of portfolio in one sector`,
          minCashPercent: `${limits.minCashPercent}%`,
          minCashDescription: `Maintain at least ${limits.minCashPercent}% cash reserve`,
          maxDailyLossPercent: `${limits.maxDailyLossPercent}%`,
          maxDailyLossDescription: `Stop trading if portfolio drops ${limits.maxDailyLossPercent}% in a day`,
          defaultStopLossPercent: `${limits.defaultStopLossPercent}%`,
          defaultStopLossDescription: `Default stop loss at ${limits.defaultStopLossPercent}% below entry`,
          defaultTakeProfitPercent: `${limits.defaultTakeProfitPercent}%`,
          defaultTakeProfitDescription: `Default take profit at ${limits.defaultTakeProfitPercent}% above entry`,
        };
      },
    }),
  };
}
