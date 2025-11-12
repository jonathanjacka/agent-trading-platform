import express from 'express';
import 'dotenv/config';
import { TraderAgent } from './agents/TraderAgent.js';
import { ResearcherAgent } from './agents/ResearcherAgent.js';
import { Logger } from './utils/logger.js';
import { MarketDataService } from './services/MarketDataService.js';
import { BraveSearchService } from './services/BraveSearchService.js';
import { DatabaseService } from './services/DatabaseService.js';
import { AccountService } from './services/AccountService.js';
import { createRoutes } from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize services
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

  Logger.success('Trader accounts initialized');
}

// Initialize accounts on startup
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

// Create traders map for easier management
const traders = new Map<string, TraderAgent>([
  ['leonardo', leonardoAgent],
  ['michelangelo', michelangeloAgent],
]);

// Setup routes
const routes = createRoutes(researcherAgent, traders, accountService);
app.use(routes);

app.listen(PORT, () => {
  Logger.section('Trading Platform Server');
  Logger.success(`Server running on http://localhost:${PORT}`);
});

export default app;
