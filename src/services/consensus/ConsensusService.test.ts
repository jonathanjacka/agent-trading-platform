import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ConsensusService } from './index.js';
import type { ConsensusRequest } from './types.js';
import { generateText } from 'ai';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

// Cast to mock for type safety
const mockGenerateText = generateText as Mock;

describe('ConsensusService', () => {
  let consensusService: ConsensusService;

  beforeEach(() => {
    vi.clearAllMocks();
    consensusService = new ConsensusService('gpt-4o-mini');
  });

  // Helper to set up mock responses
  function setupMockVotes(votes: Record<string, { vote: string; reasoning: string; confidence: number }>) {
    mockGenerateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      // Extract agent name from the prompt
      const agentMatch = prompt.match(/You are (\w+)/);
      const agentName = agentMatch ? agentMatch[1].toLowerCase() : 'unknown';

      const voteData = votes[agentName] || { vote: 'ABSTAIN', reasoning: 'No data', confidence: 0.5 };

      return {
        text: JSON.stringify(voteData),
      };
    });
  }

  describe('initialization', () => {
    it('should initialize with default model', () => {
      const service = new ConsensusService();
      expect(service).toBeDefined();
    });

    it('should initialize with custom model', () => {
      const service = new ConsensusService('gpt-4');
      expect(service).toBeDefined();
    });
  });

  describe('gatherConsensus', () => {
    it('should gather votes from all other agents', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Good momentum play', confidence: 0.8 },
        raphael: { vote: 'ABSTAIN', reasoning: 'Not my strategy', confidence: 0.3 },
        donatello: { vote: 'APPROVE', reasoning: 'Chart looks bullish', confidence: 0.9 },
      });

      const request: ConsensusRequest = {
        symbol: 'AAPL',
        action: 'BUY',
        reasoning: 'Undervalued based on fundamentals',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.symbol).toBe('AAPL');
      expect(response.action).toBe('BUY');
      expect(response.votes).toHaveLength(3); // 3 other agents
      expect(response.votes.every(v => v.agentName !== 'leonardo')).toBe(true);
    });

    it('should exclude requesting agent from voting', async () => {
      setupMockVotes({
        leonardo: { vote: 'APPROVE', reasoning: 'I approve!', confidence: 1.0 },
        michelangelo: { vote: 'APPROVE', reasoning: 'Looks good', confidence: 0.8 },
        raphael: { vote: 'APPROVE', reasoning: 'Good yield', confidence: 0.7 },
        donatello: { vote: 'APPROVE', reasoning: 'Chart says yes', confidence: 0.9 },
      });

      const request: ConsensusRequest = {
        symbol: 'GOOGL',
        action: 'BUY',
        reasoning: 'Growth opportunity',
        requestingAgent: 'Michelangelo',
      };

      const response = await consensusService.gatherConsensus(request);

      // Should not include michelangelo's vote
      expect(response.votes.find(v => v.agentName === 'michelangelo')).toBeUndefined();
      expect(response.votes).toHaveLength(3);
    });

    it('should calculate summary correctly', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Good', confidence: 0.8 },
        raphael: { vote: 'REJECT', reasoning: 'Bad', confidence: 0.7 },
        donatello: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
      });

      const request: ConsensusRequest = {
        symbol: 'TSLA',
        action: 'SELL',
        reasoning: 'Taking profits',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.summary.approve).toBe(1);
      expect(response.summary.reject).toBe(1);
      expect(response.summary.abstain).toBe(1);
      expect(response.summary.total).toBe(3);
    });

    it('should handle agent vote failures gracefully', async () => {
      let callCount = 0;

      mockGenerateText.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('API Error');
        }
        return {
          text: JSON.stringify({ vote: 'APPROVE', reasoning: 'OK', confidence: 0.8 }),
        };
      });

      const request: ConsensusRequest = {
        symbol: 'MSFT',
        action: 'BUY',
        reasoning: 'Cloud growth',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      // Should still get 3 votes (one will be ABSTAIN due to error)
      expect(response.votes).toHaveLength(3);
      expect(response.votes.some(v => v.vote === 'ABSTAIN')).toBe(true);
    });
  });

  describe('recommendation calculation', () => {
    it('should return PROCEED for strong approval (>= 67%)', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.9 },
        raphael: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.8 },
        donatello: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.7 },
      });

      const request: ConsensusRequest = {
        symbol: 'AAPL',
        action: 'BUY',
        reasoning: 'Good buy',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.recommendation).toBe('PROCEED');
    });

    it('should return ABORT when rejections exceed approvals', async () => {
      setupMockVotes({
        michelangelo: { vote: 'REJECT', reasoning: 'No', confidence: 0.9 },
        raphael: { vote: 'REJECT', reasoning: 'No', confidence: 0.8 },
        donatello: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.7 },
      });

      const request: ConsensusRequest = {
        symbol: 'NVDA',
        action: 'BUY',
        reasoning: 'AI play',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.recommendation).toBe('ABORT');
    });

    it('should return RECONSIDER for mixed opinions', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.6 },
        raphael: { vote: 'REJECT', reasoning: 'No', confidence: 0.6 },
        donatello: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
      });

      const request: ConsensusRequest = {
        symbol: 'AMZN',
        action: 'BUY',
        reasoning: 'E-commerce leader',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.recommendation).toBe('RECONSIDER');
    });

    it('should return RECONSIDER when all abstain', async () => {
      setupMockVotes({
        michelangelo: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
        raphael: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
        donatello: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
      });

      const request: ConsensusRequest = {
        symbol: 'XYZ',
        action: 'BUY',
        reasoning: 'Unknown stock',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.recommendation).toBe('RECONSIDER');
    });
  });

  describe('vote parsing', () => {
    it('should parse valid JSON vote', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Great opportunity', confidence: 0.85 },
        raphael: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
        donatello: { vote: 'APPROVE', reasoning: 'Technical setup', confidence: 0.9 },
      });

      const request: ConsensusRequest = {
        symbol: 'META',
        action: 'BUY',
        reasoning: 'Social media dominance',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);
      const michVote = response.votes.find(v => v.agentName === 'michelangelo');

      expect(michVote?.vote).toBe('APPROVE');
      expect(michVote?.reasoning).toBe('Great opportunity');
      expect(michVote?.confidence).toBe(0.85);
    });

    it('should handle malformed JSON response', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'This is not valid JSON at all',
      });

      const request: ConsensusRequest = {
        symbol: 'XYZ',
        action: 'BUY',
        reasoning: 'Test',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      // Should default to ABSTAIN for unparseable responses
      expect(response.votes.every(v => v.vote === 'ABSTAIN')).toBe(true);
    });

    it('should normalize vote values', async () => {
      setupMockVotes({
        michelangelo: { vote: 'approve', reasoning: 'Yes', confidence: 0.8 }, // lowercase
        raphael: { vote: 'REJECT', reasoning: 'No', confidence: 0.7 },
        donatello: { vote: 'maybe', reasoning: 'Unsure', confidence: 0.5 }, // invalid
      });

      const request: ConsensusRequest = {
        symbol: 'DIS',
        action: 'BUY',
        reasoning: 'Entertainment value',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      const votes = response.votes;
      expect(votes.find(v => v.agentName === 'michelangelo')?.vote).toBe('APPROVE');
      expect(votes.find(v => v.agentName === 'raphael')?.vote).toBe('REJECT');
      expect(votes.find(v => v.agentName === 'donatello')?.vote).toBe('ABSTAIN');
    });

    it('should clamp confidence to 0-1 range', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Yes', confidence: 1.5 }, // > 1
        raphael: { vote: 'APPROVE', reasoning: 'Yes', confidence: -0.5 }, // < 0
        donatello: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.5 },
      });

      const request: ConsensusRequest = {
        symbol: 'NFLX',
        action: 'BUY',
        reasoning: 'Streaming leader',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.votes.every(v => v.confidence >= 0 && v.confidence <= 1)).toBe(true);
    });
  });

  describe('consensus reasoning', () => {
    it('should include approvers in reasoning', async () => {
      setupMockVotes({
        michelangelo: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.8 },
        raphael: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.7 },
        donatello: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
      });

      const request: ConsensusRequest = {
        symbol: 'AAPL',
        action: 'BUY',
        reasoning: 'Test',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.consensusReasoning).toContain('Approved by');
      expect(response.consensusReasoning).toContain('michelangelo');
      expect(response.consensusReasoning).toContain('raphael');
    });

    it('should include rejectors in reasoning', async () => {
      setupMockVotes({
        michelangelo: { vote: 'REJECT', reasoning: 'No', confidence: 0.8 },
        raphael: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.7 },
        donatello: { vote: 'REJECT', reasoning: 'No', confidence: 0.9 },
      });

      const request: ConsensusRequest = {
        symbol: 'GME',
        action: 'BUY',
        reasoning: 'Meme stock',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.consensusReasoning).toContain('Rejected by');
      expect(response.consensusReasoning).toContain('michelangelo');
      expect(response.consensusReasoning).toContain('donatello');
    });

    it('should mention abstentions in reasoning', async () => {
      setupMockVotes({
        michelangelo: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
        raphael: { vote: 'ABSTAIN', reasoning: 'N/A', confidence: 0.3 },
        donatello: { vote: 'APPROVE', reasoning: 'Yes', confidence: 0.8 },
      });

      const request: ConsensusRequest = {
        symbol: 'BTC',
        action: 'BUY',
        reasoning: 'Crypto play',
        requestingAgent: 'Leonardo',
      };

      const response = await consensusService.gatherConsensus(request);

      expect(response.consensusReasoning).toContain('abstained');
    });
  });
});
