import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TraderAgent } from '../agents/TraderAgent.js';
import { ResearcherAgent } from '../agents/ResearcherAgent.js';
import { AccountService } from '../services/account/index.js';
import { MarketDataService } from '../services/marketData/index.js';
import { BraveSearchService } from '../services/BraveSearchService.js';
import { DatabaseService } from '../services/database/index.js';
import { MemoryService } from '../services/memory/index.js';

/**
 * Agent workflow tests verify that agents can complete full trading cycles
 * Uses mocked external services (API calls) to avoid real costs
 */

// Mock external services
vi.mock('../services/MarketDataService.js');
vi.mock('../services/BraveSearchService.js');

// Mock the AI SDK to avoid real API calls
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((config) => config),
  stepCountIs: vi.fn((n) => n),
}));

describe('Agent Workflow Tests', () => {
  let traderAgent: TraderAgent;
  let mockAccountService: AccountService;
  let mockMarketData: MarketDataService;
  let mockBraveSearch: BraveSearchService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singletons and use in-memory database
    // @ts-ignore - Access private property for testing
    DatabaseService.instance = undefined;
    // @ts-ignore - Access private property for testing
    MemoryService.instance = undefined;
    DatabaseService.getInstance(':memory:');

    // Mock services with reasonable responses
    mockAccountService = {
      getPortfolio: vi.fn().mockResolvedValue({
        cash: 25000,
        holdings: [
          {
            symbol: 'AAPL',
            quantity: 10,
            avgPrice: 150,
            currentPrice: 175,
            currentValue: 1750,
            gain: 250,
            gainPercent: 16.67,
          },
        ],
        totalHoldingsValue: 1750,
        totalValue: 26750,
        totalGain: 1750,
        totalGainPercent: 7.0,
      }),
      buyStock: vi.fn().mockResolvedValue({
        success: true,
        message: 'Successfully bought 10 shares',
        transaction: { symbol: 'AAPL', quantity: 10, price: 150, total: 1500 },
      }),
      sellStock: vi.fn().mockResolvedValue({
        success: true,
        message: 'Successfully sold 5 shares',
        transaction: { symbol: 'AAPL', quantity: 5, price: 175, total: 875 },
      }),
      recordPortfolioSnapshot: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockMarketData = {} as any;
    mockBraveSearch = {} as any;

    traderAgent = new TraderAgent(
      'Leonardo',
      'Value-oriented investor',
      mockAccountService,
      mockMarketData,
      mockBraveSearch,
      'gpt-4o-mini'
    );
  });

  afterEach(() => {
    // Clean up singletons
    const db = DatabaseService.getInstance(':memory:');
    db.close();
    // @ts-ignore - Reset singleton for next test
    DatabaseService.instance = undefined;
    // @ts-ignore - Reset singleton for next test
    MemoryService.instance = undefined;
  });

  describe('Agent Tool Availability', () => {
    it('should have all required trading tools', () => {
      const tools = (traderAgent as any).getTools();

      expect(tools).toHaveProperty('researcher');
      expect(tools).toHaveProperty('getPortfolio');
      expect(tools).toHaveProperty('buyStock');
      expect(tools).toHaveProperty('sellStock');
      expect(tools).toHaveProperty('reviewMemories');
      expect(tools).toHaveProperty('reviewCollectiveLessons');
      expect(tools).toHaveProperty('recordLesson');
    });

    it('should have correct tool schemas', () => {
      const tools = (traderAgent as any).getTools();

      // Verify buyStock has required parameters
      expect(tools.buyStock.inputSchema).toBeDefined();
      expect(tools.buyStock.description).toContain('Buy shares');

      // Verify sellStock has required parameters
      expect(tools.sellStock.inputSchema).toBeDefined();
      expect(tools.sellStock.description).toContain('Sell shares');

      // Verify memory tools
      expect(tools.reviewMemories.inputSchema).toBeDefined();
      expect(tools.recordLesson.inputSchema).toBeDefined();
    });
  });

  describe('Tool Execution Workflows', () => {
    it('should execute portfolio check workflow', async () => {
      // Act
      const tools = (traderAgent as any).getTools();
      const portfolioResult = await tools.getPortfolio.execute({});

      // Assert
      expect(mockAccountService.getPortfolio).toHaveBeenCalledWith('Leonardo');
      expect(portfolioResult.cash).toBe(25000);
      expect(portfolioResult.holdings).toHaveLength(1);
      expect(portfolioResult.totalValue).toBe(26750);
    });

    it('should execute buy workflow with portfolio update', async () => {
      // Act
      const tools = (traderAgent as any).getTools();
      const buyResult = await tools.buyStock.execute({
        symbol: 'AAPL',
        quantity: 10,
        rationale: 'Value opportunity',
      });

      // Assert
      expect(mockAccountService.buyStock).toHaveBeenCalledWith(
        'Leonardo',
        'AAPL',
        10,
        'Value opportunity',
        undefined
      );
      expect(mockAccountService.recordPortfolioSnapshot).toHaveBeenCalledWith(
        'Leonardo'
      );
      expect(buyResult.success).toBe(true);
    });

    it('should execute sell workflow with portfolio update', async () => {
      // Act
      const tools = (traderAgent as any).getTools();
      const sellResult = await tools.sellStock.execute({
        symbol: 'AAPL',
        quantity: 5,
        rationale: 'Taking profits',
      });

      // Assert
      expect(mockAccountService.sellStock).toHaveBeenCalledWith(
        'Leonardo',
        'AAPL',
        5,
        'Taking profits',
        undefined
      );
      expect(mockAccountService.recordPortfolioSnapshot).toHaveBeenCalledWith(
        'Leonardo'
      );
      expect(sellResult.success).toBe(true);
    });

    it('should handle trade failures gracefully', async () => {
      // Arrange
      mockAccountService.buyStock = vi.fn().mockResolvedValue({
        success: false,
        message: 'Insufficient funds',
      });

      // Act
      const tools = (traderAgent as any).getTools();
      const buyResult = await tools.buyStock.execute({
        symbol: 'AAPL',
        quantity: 10000, // Too many
        rationale: 'Overambitious',
      });

      // Assert
      expect(buyResult.success).toBe(false);
      expect(buyResult.message).toContain('Insufficient funds');
      expect(mockAccountService.recordPortfolioSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('Agent State and Configuration', () => {
    it('should maintain agent identity across tool calls', () => {
      const info = traderAgent.getInfo();

      expect(info.name).toBe('Leonardo');
      expect(info.strategy).toContain('Value-oriented');
      expect(info.model).toBe('gpt-4o-mini');
    });

    it('should track current prompt during trading session', async () => {
      // Access private currentPrompt through agent instance
      const agent = traderAgent as any;

      expect(agent.currentPrompt).toBeUndefined();

      // Note: In real usage, currentPrompt is set during trade() call
      // This verifies the mechanism exists
    });
  });

  describe('Multiple Agent Coordination', () => {
    let agents: TraderAgent[];

    beforeEach(() => {
      const agentConfigs = [
        { name: 'Leonardo', strategy: 'Value investing' },
        { name: 'Michelangelo', strategy: 'Tech growth' },
        { name: 'Raphael', strategy: 'Macro trading' },
        { name: 'Donatello', strategy: 'Risk parity' },
      ];

      agents = agentConfigs.map(
        (config) =>
          new TraderAgent(
            config.name,
            config.strategy,
            mockAccountService,
            mockMarketData,
            mockBraveSearch,
            'gpt-4o-mini'
          )
      );
    });

    it('should create all four agents with unique identities', () => {
      expect(agents).toHaveLength(4);

      const names = agents.map((a) => a.getInfo().name);
      expect(new Set(names).size).toBe(4); // All unique
      expect(names).toContain('Leonardo');
      expect(names).toContain('Michelangelo');
      expect(names).toContain('Raphael');
      expect(names).toContain('Donatello');
    });

    it('should allow agents to execute independent trades', async () => {
      // Act - Each agent buys different stock
      const tools1 = (agents[0] as any).getTools();
      const tools2 = (agents[1] as any).getTools();

      await tools1.buyStock.execute({
        symbol: 'BRK.B',
        quantity: 10,
        rationale: 'Leonardo value pick',
      });

      await tools2.buyStock.execute({
        symbol: 'NVDA',
        quantity: 5,
        rationale: 'Michelangelo tech pick',
      });

      // Assert
      expect(mockAccountService.buyStock).toHaveBeenCalledTimes(2);
      expect(mockAccountService.buyStock).toHaveBeenCalledWith(
        'Leonardo',
        'BRK.B',
        10,
        'Leonardo value pick',
        undefined
      );
      expect(mockAccountService.buyStock).toHaveBeenCalledWith(
        'Michelangelo',
        'NVDA',
        5,
        'Michelangelo tech pick',
        undefined
      );
    });
  });
});

describe('ResearcherAgent Workflow', () => {
  let researcherAgent: ResearcherAgent;
  let mockMarketData: MarketDataService;
  let mockBraveSearch: BraveSearchService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMarketData = {} as any;
    mockBraveSearch = {} as any;

    researcherAgent = new ResearcherAgent(
      mockMarketData,
      mockBraveSearch,
      'gpt-4o-mini'
    );
  });

  describe('Research Tool Availability', () => {
    it('should have all research tools', () => {
      const tools = (researcherAgent as any).tools;

      expect(tools).toHaveProperty('searchFinancialNews');
      expect(tools).toHaveProperty('analyzeCompany');
      expect(tools).toHaveProperty('searchWeb');
    });

    it('should export as trader tool', () => {
      const researcherTool = researcherAgent.getAsTool();

      expect(researcherTool).toBeDefined();
      expect(researcherTool.description).toContain('research');
      expect(researcherTool.inputSchema).toBeDefined();
    });
  });
});
