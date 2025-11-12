import express, { Request, Response } from 'express';
import 'dotenv/config';
import { TraderAgent } from './agents/TraderAgent.js';
import { ResearcherAgent } from './agents/ResearcherAgent.js';
import { Logger } from './utils/logger.js';
import { MarketDataService } from './services/MarketDataService.js';
import { BraveSearchService } from './services/BraveSearchService.js';
import { DatabaseService } from './services/DatabaseService.js';
import { AccountService } from './services/AccountService.js';

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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    agents: {
      researcher: 'active',
      traders: ['Leonardo', 'Michelangelo'],
    },
  });
});

// Test Researcher endpoint
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    Logger.info(`Received research request: ${query}`);

    const result = await researcherAgent.research(query);

    res.json({
      success: true,
      agent: 'Researcher',
      query,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Research error', error);
    res.status(500).json({
      error: 'Failed to complete research',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test Trader endpoint
app.post('/api/trade/:traderName', async (req: Request, res: Response) => {
  try {
    const { traderName } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    let trader: TraderAgent;

    if (traderName.toLowerCase() === 'leonardo') {
      trader = leonardoAgent;
    } else if (traderName.toLowerCase() === 'michelangelo') {
      trader = michelangeloAgent;
    } else {
      return res.status(404).json({
        error: `Trader '${traderName}' not found. Available: leonardo, michelangelo`,
      });
    }

    Logger.info(`Received trading request for ${traderName}: ${prompt}`);

    const result = await trader.trade(prompt);

    res.json({
      success: true,
      trader: trader.getInfo(),
      prompt,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Trading error', error);
    res.status(500).json({
      error: 'Failed to complete trading operation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get trader info
app.get('/api/traders', (req: Request, res: Response) => {
  res.json({
    traders: [leonardoAgent.getInfo(), michelangeloAgent.getInfo()],
  });
});

// Get trader portfolio
app.get('/api/portfolio/:traderName', async (req: Request, res: Response) => {
  try {
    const { traderName } = req.params;

    // Capitalize first letter to match database
    const formattedName =
      traderName.charAt(0).toUpperCase() + traderName.slice(1).toLowerCase();

    const portfolio = await accountService.getPortfolio(formattedName);

    res.json({
      success: true,
      trader: formattedName,
      portfolio,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Portfolio error', error);
    res.status(500).json({
      error: 'Failed to get portfolio',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get trader transaction history
app.get(
  '/api/transactions/:traderName',
  async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      // Capitalize first letter to match database
      const formattedName =
        traderName.charAt(0).toUpperCase() + traderName.slice(1).toLowerCase();

      const transactions = accountService.getTransactionHistory(
        formattedName,
        limit
      );

      res.json({
        success: true,
        trader: formattedName,
        transactions,
        count: transactions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Transaction history error', error);
      res.status(500).json({
        error: 'Failed to get transaction history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get portfolio value history
app.get(
  '/api/portfolio-history/:traderName',
  async (req: Request, res: Response) => {
    try {
      const { traderName } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      // Capitalize first letter to match database
      const formattedName =
        traderName.charAt(0).toUpperCase() + traderName.slice(1).toLowerCase();

      const history = accountService.getPortfolioHistory(formattedName, limit);

      res.json({
        success: true,
        trader: formattedName,
        history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Portfolio history error', error);
      res.status(500).json({
        error: 'Failed to get portfolio history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

app.listen(PORT, () => {
  Logger.section('Trading Platform Server');
  Logger.success(`Server running on http://localhost:${PORT}`);
});

export default app;
