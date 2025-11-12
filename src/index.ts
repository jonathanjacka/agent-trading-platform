import express, { Request, Response } from 'express';
import 'dotenv/config';
import { TraderAgent } from './agents/TraderAgent.js';
import { ResearcherAgent } from './agents/ResearcherAgent.js';
import { Logger } from './utils/logger.js';
import { MarketDataService } from './services/MarketDataService.js';
import { BraveSearchService } from './services/BraveSearchService.js';

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
const researcherAgent = new ResearcherAgent(marketData, braveSearch);

const leonardoAgent = new TraderAgent(
  'Leonardo',
  `You are a value-oriented investor who prioritizes long-term wealth creation.
You identify high-quality companies trading below their intrinsic value.
You invest patiently and hold positions through market fluctuations, 
relying on meticulous fundamental analysis, steady cash flows, strong management teams, 
and competitive advantages. You rarely react to short-term market movements.`,
  marketData,
  braveSearch
);

const michelangeloAgent = new TraderAgent(
  'Michelangelo',
  `You aggressively pursue opportunities in disruptive innovation, particularly focusing on technology.
Your strategy is to identify and invest boldly in sectors poised to revolutionize the economy, 
accepting higher volatility for potentially exceptional returns. You closely monitor technological breakthroughs, 
market sentiment, ready to take bold positions and actively manage your portfolio to capitalize on growth trends.`,
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

app.listen(PORT, () => {
  Logger.section('Trading Platform Server');
  Logger.success(`Server running on http://localhost:${PORT}`);
});

export default app;
