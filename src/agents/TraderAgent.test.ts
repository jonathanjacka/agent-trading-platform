import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraderAgent } from '../agents/TraderAgent.js';
import { AccountService } from '../services/account/index.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { BraveSearchService } from '../services/BraveSearchService.js';

// Mock the services
vi.mock('../services/AccountService.js');
vi.mock('../services/MarketDataService.js');
vi.mock('../services/BraveSearchService.js');
vi.mock('../services/MemoryService.js');

describe('TraderAgent Tools', () => {
  let traderAgent: TraderAgent;
  let mockAccountService: AccountService;
  let mockMarketData: MarketDataService;
  let mockBraveSearch: BraveSearchService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock instances
    mockAccountService = {
      getPortfolio: vi.fn(),
      buyStock: vi.fn(),
      sellStock: vi.fn(),
    } as any;

    mockMarketData = {} as any;
    mockBraveSearch = {} as any;

    // Create trader agent instance
    traderAgent = new TraderAgent(
      'TestTrader',
      'Test strategy for unit testing',
      mockAccountService,
      mockMarketData,
      mockBraveSearch,
      'gpt-4o-mini'
    );
  });

  describe('getPortfolio tool', () => {
    it('should return formatted portfolio data', async () => {
      // Arrange
      const mockPortfolio = {
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
      };

      mockAccountService.getPortfolio = vi
        .fn()
        .mockResolvedValue(mockPortfolio);

      // Act
      const tools = (traderAgent as any).getTools();
      const result = await tools.getPortfolio.execute({});

      // Assert
      expect(mockAccountService.getPortfolio).toHaveBeenCalledWith(
        'TestTrader'
      );
      expect(result).toEqual({
        cash: 25000,
        holdings: [
          {
            symbol: 'AAPL',
            shares: 10,
            avgPrice: 150,
            currentPrice: 175,
            currentValue: 1750,
            gain: 250,
            gainPercent: '16.67%',
          },
        ],
        totalHoldingsValue: 1750,
        totalValue: 26750,
        totalGain: 1750,
        totalGainPercent: '7.00%',
      });
    });

    it('should handle empty portfolio', async () => {
      // Arrange
      const emptyPortfolio = {
        cash: 50000,
        holdings: [],
        totalHoldingsValue: 0,
        totalValue: 50000,
        totalGain: 0,
        totalGainPercent: 0,
      };

      mockAccountService.getPortfolio = vi
        .fn()
        .mockResolvedValue(emptyPortfolio);

      // Act
      const tools = (traderAgent as any).getTools();
      const result = await tools.getPortfolio.execute({});

      // Assert
      expect(result.holdings).toHaveLength(0);
      expect(result.cash).toBe(50000);
    });
  });

  describe('buyStock tool', () => {
    it('should execute successful buy order', async () => {
      // Arrange
      const mockBuyResult = {
        success: true,
        message: 'Successfully bought 10 shares of AAPL',
        transaction: {
          symbol: 'AAPL',
          quantity: 10,
          price: 150,
          total: 1500,
        },
      };

      mockAccountService.buyStock = vi.fn().mockResolvedValue(mockBuyResult);
      mockAccountService.recordPortfolioSnapshot = vi
        .fn()
        .mockResolvedValue(undefined);

      // Act
      const tools = (traderAgent as any).getTools();
      const result = await tools.buyStock.execute({
        symbol: 'AAPL',
        quantity: 10,
        rationale: 'Strong fundamentals',
      });

      // Assert
      expect(mockAccountService.buyStock).toHaveBeenCalledWith(
        'TestTrader',
        'AAPL',
        10,
        'Strong fundamentals',
        undefined // currentPrompt
      );
      expect(mockAccountService.recordPortfolioSnapshot).toHaveBeenCalledWith(
        'TestTrader'
      );
      expect(result.success).toBe(true);
    });

    it('should handle failed buy order', async () => {
      // Arrange
      const mockFailResult = {
        success: false,
        message: 'Insufficient funds',
      };

      mockAccountService.buyStock = vi.fn().mockResolvedValue(mockFailResult);
      mockAccountService.recordPortfolioSnapshot = vi.fn();

      // Act
      const tools = (traderAgent as any).getTools();
      const result = await tools.buyStock.execute({
        symbol: 'AAPL',
        quantity: 1000, // Too many shares
        rationale: 'Testing failure',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Insufficient funds');
      expect(mockAccountService.recordPortfolioSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('sellStock tool', () => {
    it('should execute successful sell order', async () => {
      // Arrange
      const mockSellResult = {
        success: true,
        message: 'Successfully sold 5 shares of AAPL',
        transaction: {
          symbol: 'AAPL',
          quantity: 5,
          price: 175,
          total: 875,
        },
      };

      mockAccountService.sellStock = vi.fn().mockResolvedValue(mockSellResult);
      mockAccountService.recordPortfolioSnapshot = vi
        .fn()
        .mockResolvedValue(undefined);

      // Act
      const tools = (traderAgent as any).getTools();
      const result = await tools.sellStock.execute({
        symbol: 'AAPL',
        quantity: 5,
        rationale: 'Taking profits',
      });

      // Assert
      expect(mockAccountService.sellStock).toHaveBeenCalledWith(
        'TestTrader',
        'AAPL',
        5,
        'Taking profits',
        undefined
      );
      expect(mockAccountService.recordPortfolioSnapshot).toHaveBeenCalledWith(
        'TestTrader'
      );
      expect(result.success).toBe(true);
    });

    it('should handle insufficient shares', async () => {
      // Arrange
      const mockFailResult = {
        success: false,
        message: 'Insufficient shares to sell',
      };

      mockAccountService.sellStock = vi.fn().mockResolvedValue(mockFailResult);

      // Act
      const tools = (traderAgent as any).getTools();
      const result = await tools.sellStock.execute({
        symbol: 'TSLA',
        quantity: 100,
        rationale: 'Cutting losses',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient shares');
    });
  });

  describe('Agent info', () => {
    it('should return correct agent information', () => {
      // Act
      const info = traderAgent.getInfo();

      // Assert
      expect(info).toEqual({
        name: 'TestTrader',
        strategy: 'Test strategy for unit testing',
        model: 'gpt-4o-mini',
      });
    });
  });
});
