import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { TraderAgent } from './agents/TraderAgent.js';
import { ResearcherAgent } from './agents/ResearcherAgent.js';
import { Logger } from './utils/logger.js';
import {
  standardLimiter,
  globalErrorHandler,
  notFoundHandler,
  setupProcessErrorHandlers,
} from './middleware/index.js';
import { MarketDataService } from './services/MarketDataService.js';
import { BraveSearchService } from './services/BraveSearchService.js';
import { DatabaseService } from './services/DatabaseService.js';
import { AccountService } from './services/AccountService.js';
import { TradingOrchestratorService } from './services/TradingOrchestratorService.js';
import { SchedulerService } from './services/SchedulerService.js';
import { createRoutes } from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL, // Netlify URL
].filter(Boolean) as string[];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

// Apply rate limiting to all requests
app.use(standardLimiter);

// Setup process-level error handlers
setupProcessErrorHandlers();

// Log environment
const isProduction = process.env.NODE_ENV === 'production';
Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
if (!process.env.API_SECRET && isProduction) {
  Logger.warn('API_SECRET not set - API authentication disabled!');
}

const apiKey = process.env.POLY_API_KEY;
if (!apiKey) {
  Logger.error('POLY_API_KEY not found in environment');
  process.exit(1);
}

const braveApiKey = process.env.BRAVE_API_KEY;
if (!braveApiKey) {
  Logger.error('BRAVE_API_KEY not found in environment');
  process.exit(1);
}

const marketData = new MarketDataService(apiKey);
const braveSearch = new BraveSearchService(braveApiKey);
const db = DatabaseService.getInstance();
const accountService = new AccountService(db, marketData);
const researcherAgent = new ResearcherAgent(marketData, braveSearch);

async function initializeAccounts() {
  const initialBalance = 50000; // $50k starting balance

  await accountService.initializeAccount(
    'Leonardo',
    initialBalance,
    `Value-oriented investor who prioritizes long-term wealth creation.
Identifies high-quality companies trading below their intrinsic value.
Invests patiently and holds positions through market fluctuations.`
  );

  await accountService.initializeAccount(
    'Michelangelo',
    initialBalance,
    `Aggressively pursues opportunities in disruptive innovation, particularly in technology.
Identifies and invests boldly in sectors poised to revolutionize the economy.
Accepts higher volatility for potentially exceptional returns.`
  );

  await accountService.initializeAccount(
    'Raphael',
    initialBalance,
    `Aggressive macro trader who actively seeks significant market mispricings.
Looks for large-scale economic and geopolitical events that create opportunities.
Contrarian approach, willing to bet boldly against prevailing market sentiment.`
  );

  await accountService.initializeAccount(
    'Donatello',
    initialBalance,
    `Systematic, principles-based approach rooted in macroeconomic insights and diversification.
Invests broadly across asset classes using risk parity strategies.
Pays close attention to economic indicators, central bank policies, and cycles.`
  );

  Logger.success('Trader accounts initialized');
}

await initializeAccounts();

const leonardoAgent = new TraderAgent(
  'Leonardo',
  `You are a value-oriented investor who prioritizes long-term wealth creation.
You identify high-quality companies trading below their intrinsic value.
You invest patiently and hold positions through market fluctuations, 
relying on meticulous fundamental analysis, steady cash flows, strong management teams, 
and competitive advantages. You rarely react to short-term market movements.`,
  accountService,
  marketData,
  braveSearch
);

const michelangeloAgent = new TraderAgent(
  'Michelangelo',
  `You aggressively pursue opportunities in disruptive innovation, particularly focusing on technology.
Your strategy is to identify and invest boldly in sectors poised to revolutionize the economy, 
accepting higher volatility for potentially exceptional returns. You closely monitor technological breakthroughs, 
market sentiment, ready to take bold positions and actively manage your portfolio to capitalize on growth trends.`,
  accountService,
  marketData,
  braveSearch
);

const raphaelAgent = new TraderAgent(
  'Raphael',
  `You are an aggressive macro trader who actively seeks significant market mispricings.
You look for large-scale economic and geopolitical events that create investment opportunities.
Your approach is contrarian, willing to bet boldly against prevailing market sentiment when your 
macroeconomic analysis suggests a significant imbalance. You leverage careful timing and decisive 
action to capitalize on rapid market shifts.`,
  accountService,
  marketData,
  braveSearch
);

const donatelloAgent = new TraderAgent(
  'Donatello',
  `You apply a systematic, principles-based approach rooted in macroeconomic insights and diversification.
You invest broadly across asset classes, utilizing risk parity strategies to achieve balanced returns 
in varying market environments. You pay close attention to macroeconomic indicators, central bank policies, 
and economic cycles, adjusting your portfolio strategically to manage risk and preserve capital across 
diverse market conditions.`,
  accountService,
  marketData,
  braveSearch
);

// Create traders map
const traders = new Map<string, TraderAgent>([
  ['leonardo', leonardoAgent],
  ['michelangelo', michelangeloAgent],
  ['raphael', raphaelAgent],
  ['donatello', donatelloAgent],
]);

// Create orchestrator and scheduler
const orchestrator = new TradingOrchestratorService(traders);
const scheduler = new SchedulerService(orchestrator, {
  enabled: process.env.ENABLE_SCHEDULER === 'true',
  tradingSchedule: process.env.TRADING_SCHEDULE || '0 6 * * 1-5', // Default: 6 AM UTC, Mon-Fri
  timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
});

const routes = createRoutes(
  researcherAgent,
  traders,
  accountService,
  scheduler,
  orchestrator
);
app.use(routes);

// Error handling (must be after routes)
app.use(notFoundHandler);
app.use(globalErrorHandler);

app.listen(PORT, () => {
  Logger.section('Trading Platform Server');
  Logger.success(`Server running on http://localhost:${PORT}`);

  // Start scheduler if enabled
  if (process.env.ENABLE_SCHEDULER === 'true') {
    scheduler.start();
    Logger.success('Automated trading scheduler started');
  } else {
    Logger.info('Scheduler disabled (set ENABLE_SCHEDULER=true to enable)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, shutting down...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, shutting down...');
  scheduler.stop();
  process.exit(0);
});

export default app;
