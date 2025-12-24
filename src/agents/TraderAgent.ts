/**
 * Trader Agent
 * Autonomous trading agent with strategy execution capabilities
 */

import { generateText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ResearcherAgent } from './ResearcherAgent.js';
import { ConsultantAgent } from './ConsultantAgent.js';
import { Logger } from '../utils/logger.js';
import { MarketDataService } from '../services/marketData/index.js';
import { BraveSearchService } from '../services/BraveSearchService.js';
import { AccountService } from '../services/account/index.js';
import { MemoryService } from '../services/memory/index.js';
import { MarketIntelligenceService } from '../services/marketIntelligence/index.js';
import { RiskService } from '../services/risk/index.js';
import { PerformanceAnalyticsService } from '../services/analytics/index.js';
import { TradeLogService } from '../services/TradeLogService.js';
import { DatabaseService } from '../services/database/index.js';
import { ConsensusService } from '../services/consensus/index.js';
import {
  createTradingTools,
  createMarketTools,
  createMemoryTools,
  createRiskTools,
  createAnalyticsTools,
  createTechnicalTools,
  createConsultationTools,
  createWatchlistTools,
} from './tools/index.js';
import { WatchlistService } from '../services/watchlist/index.js';

const TRADER_BASE_INSTRUCTIONS = `Your responsibilities:
- Analyze market conditions using available research tools
- Make informed trading decisions aligned with your strategy
- Manage risk appropriately using risk management tools
- Provide clear rationale for your decisions

Available tools:

RESEARCH & DISCOVERY:
- researcher: Use this to gather market information and news
- getMarketOverview: Get real-time market status, sentiment, and top movers
- discoverStocks: Find new investment opportunities by theme (AI, EVs, etc.) or trending
- getMarketMovers: Get today's top gainers and losers

TECHNICAL ANALYSIS:
- getTechnicalIndicators: Get RSI, SMA, EMA, MACD for a stock
- getQuote: Get current price and daily statistics
- getDividendHistory: Get dividend payment history and yield

TRADING:
- getPortfolio: Check current holdings and cash balance
- buyStock: Execute a buy order
- sellStock: Execute a sell order

RISK MANAGEMENT:
- getPortfolioRisk: Analyze overall portfolio risk, concentration, and get recommendations
- getPositionRisk: Analyze risk for a specific position (stop loss, take profit levels)
- evaluateTradeRisk: ALWAYS use before buying/selling to check if trade is safe
- getRiskLimits: View current risk management limits
- getPositionSizeRecommendation: Get how many shares you can safely buy

PERFORMANCE ANALYTICS:
- getPerformanceSummary: Review your trading performance (returns, win rate, drawdown)
- getSymbolPerformance: See which stocks are your winners and losers

MEMORY & LEARNING:
- reviewMemories: Review your past trading experiences and lessons learned
- reviewCollectiveLessons: Learn from insights discovered by other agents
- recordLesson: Manually record an important insight or lesson

CONSULTATION (Second Opinions):
- consultExpert: Get a second opinion from a senior investment consultant (Claude AI)
- requestPeerConsensus: Ask your peer agents to vote on a proposed trade

WATCHLIST MANAGEMENT:
- addToWatchlist: Add a stock to real-time monitoring for trading opportunities
- removeFromWatchlist: Remove a stock from your watchlist
- getWatchlist: View all stocks you are currently monitoring

Risk Management Guidelines:
1. ALWAYS use evaluateTradeRisk before executing buyStock or sellStock
2. Do not proceed with trades that have blockers
3. Proceed with caution on trades with warnings
4. Monitor position concentration - no single position should dominate
5. Maintain minimum cash reserves for opportunities
6. Use getPositionRisk to check stop loss and take profit levels
7. Use getPositionSizeRecommendation before buying to determine safe quantity

Performance Review:
1. Periodically use getPerformanceSummary to review your trading effectiveness
2. Use getSymbolPerformance to identify which stocks work best for your strategy
3. Learn from your win rate, drawdown, and profit factor metrics

Trading Guidelines:
1. Start by checking getMarketOverview to understand current conditions
2. Check getPortfolioRisk to assess current risk exposure
3. Use discoverStocks to find opportunities beyond your training data
4. Use getTechnicalIndicators for chart analysis (especially RSI, MACD)
5. Always research before making trading decisions
6. Consider your strategy when evaluating opportunities
7. Review your memories and collective lessons to learn from past experiences
8. Record important insights when you discover patterns or lessons
9. For significant trades, consider using consultExpert or requestPeerConsensus
10. Explain your reasoning clearly
11. Be decisive but not reckless`;

export class TraderAgent {
  private modelName: string;
  private name: string;
  private strategy: string;
  private researcherAgent: ResearcherAgent;
  private accountService: AccountService;
  private memoryService: MemoryService;
  private marketIntelligence: MarketIntelligenceService;
  private marketData: MarketDataService;
  private riskService: RiskService;
  private analyticsService: PerformanceAnalyticsService;
  private consultantAgent: ConsultantAgent;
  private consensusService: ConsensusService;
  private watchlistService: WatchlistService;
  private currentPrompt: string | undefined;

  constructor(
    name: string,
    strategy: string,
    accountService: AccountService,
    marketData: MarketDataService,
    braveSearch: BraveSearchService,
    modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  ) {
    this.name = name;
    this.strategy = strategy;
    this.modelName = modelName;
    this.accountService = accountService;
    this.marketData = marketData;
    this.memoryService = MemoryService.getInstance();
    this.riskService = new RiskService();
    this.marketIntelligence = new MarketIntelligenceService(
      marketData,
      braveSearch
    );
    this.researcherAgent = new ResearcherAgent(
      marketData,
      braveSearch,
      modelName
    );

    // Initialize analytics with a trade log service
    const db = DatabaseService.getInstance();
    const tradeLogService = new TradeLogService(db);
    this.analyticsService = new PerformanceAnalyticsService(tradeLogService);

    // Initialize consultation services
    this.consultantAgent = new ConsultantAgent();
    this.consensusService = new ConsensusService(modelName);

    // Initialize watchlist service
    this.watchlistService = new WatchlistService(db.getDatabase());
  }

  private getInstructions(): string {
    return `You are ${this.name}, an autonomous stock trader.

Your trading strategy:
${this.strategy}

${TRADER_BASE_INSTRUCTIONS}

Current datetime: ${new Date().toISOString()}`;
  }

  private getTools() {
    // Compose tools from modular tool creators
    const tradingTools = createTradingTools({
      accountService: this.accountService,
      agentName: this.name,
      getCurrentPrompt: () => this.currentPrompt,
    });

    const marketTools = createMarketTools({
      marketIntelligence: this.marketIntelligence,
      agentName: this.name,
    });

    const memoryTools = createMemoryTools({
      memoryService: this.memoryService,
      agentName: this.name,
    });

    const riskTools = createRiskTools({
      accountService: this.accountService,
      riskService: this.riskService,
      agentName: this.name,
    });

    const analyticsTools = createAnalyticsTools({
      analyticsService: this.analyticsService,
      agentName: this.name,
    });

    const technicalTools = createTechnicalTools({
      marketData: this.marketData,
      agentName: this.name,
    });

    const consultationTools = createConsultationTools({
      consultantAgent: this.consultantAgent,
      consensusService: this.consensusService,
      agentName: this.name,
    });

    const watchlistTools = createWatchlistTools({
      watchlistService: this.watchlistService,
      agentName: this.name,
    });

    return {
      researcher: this.researcherAgent.getAsTool(),
      ...tradingTools,
      ...marketTools,
      ...memoryTools,
      ...riskTools,
      ...analyticsTools,
      ...technicalTools,
      ...consultationTools,
      ...watchlistTools,
    };
  }

  async trade(prompt: string): Promise<string> {
    this.currentPrompt = prompt;
    Logger.traderAction(this.name, 'Starting trading session');
    Logger.trader(this.name, `Strategy: ${this.strategy}`);

    const result = await generateText({
      model: openai(this.modelName),
      system: this.getInstructions(),
      prompt,
      tools: this.getTools(),
      stopWhen: stepCountIs(20),
      experimental_telemetry: {
        isEnabled: true,
        functionId: `trader-${this.name}`,
        metadata: {
          agentName: this.name,
          agentType: 'trader',
        },
      },
    });

    Logger.traderAction(
      this.name,
      'Trading session complete',
      `Steps: ${result.steps.length}`
    );

    return result.text;
  }

  getInfo() {
    return {
      name: this.name,
      strategy: this.strategy,
      model: this.modelName,
    };
  }
}
