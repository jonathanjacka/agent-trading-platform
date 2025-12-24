/**
 * Consensus Service
 * Orchestrates peer voting between trading agents
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Logger } from '../../utils/logger.js';
import type {
  ConsensusRequest,
  ConsensusResponse,
  AgentVote,
} from './types.js';

// Re-export types
export * from './types.js';

const PEER_VOTE_SYSTEM_PROMPT = `You are a trading agent being asked for your opinion on another agent's proposed trade.

Based on your perspective:
- Value investors focus on fundamentals and margin of safety
- Growth investors focus on momentum and future potential
- Dividend investors focus on income stability and yield
- Technical analysts focus on price patterns and indicators

Respond with a JSON object:
{
  "vote": "APPROVE" | "REJECT" | "ABSTAIN",
  "reasoning": "<1-2 sentences explaining your vote>",
  "confidence": <0.0 to 1.0>
}

ABSTAIN if the trade doesn't relate to your strategy.
Be concise and direct.`;

export class ConsensusService {
  private modelName: string;
  private agentStrategies: Map<string, string>;

  constructor(modelName: string = process.env.DEFAULT_MODEL || 'gpt-4o-mini') {
    this.modelName = modelName;

    // Define each agent's perspective for voting
    this.agentStrategies = new Map([
      ['leonardo', 'Value Investor: Focus on fundamentals, P/E ratios, intrinsic value, margin of safety'],
      ['michelangelo', 'Growth Investor: Focus on revenue growth, market trends, innovation, momentum'],
      ['raphael', 'Dividend Investor: Focus on dividend yield, payout ratio, income stability'],
      ['donatello', 'Technical Analyst: Focus on price patterns, indicators, support/resistance, volume'],
    ]);
  }

  async gatherConsensus(request: ConsensusRequest): Promise<ConsensusResponse> {
    Logger.info(
      `Gathering consensus for ${request.action} ${request.symbol} (requested by ${request.requestingAgent})`
    );

    const votes: AgentVote[] = [];
    const agents = Array.from(this.agentStrategies.keys()).filter(
      (name) => name !== request.requestingAgent.toLowerCase()
    );

    // Gather votes from all other agents
    for (const agentName of agents) {
      try {
        const vote = await this.getAgentVote(agentName, request);
        votes.push(vote);
      } catch (error) {
        Logger.warn(`Failed to get vote from ${agentName}: ${error}`);
        votes.push({
          agentName,
          vote: 'ABSTAIN',
          reasoning: 'Unable to provide vote due to technical issues',
          confidence: 0,
        });
      }
    }

    // Calculate summary
    const summary = {
      approve: votes.filter((v) => v.vote === 'APPROVE').length,
      reject: votes.filter((v) => v.vote === 'REJECT').length,
      abstain: votes.filter((v) => v.vote === 'ABSTAIN').length,
      total: votes.length,
    };

    // Determine recommendation
    const recommendation = this.calculateRecommendation(summary);
    const consensusReasoning = this.buildConsensusReasoning(votes, summary);

    Logger.info(
      `Consensus result: ${summary.approve} approve, ${summary.reject} reject, ${summary.abstain} abstain -> ${recommendation}`
    );

    return {
      symbol: request.symbol,
      action: request.action,
      votes,
      summary,
      recommendation,
      consensusReasoning,
    };
  }

  private async getAgentVote(
    agentName: string,
    request: ConsensusRequest
  ): Promise<AgentVote> {
    const strategy = this.agentStrategies.get(agentName) || 'General trader';

    const prompt = `You are ${agentName} (${strategy}).

Another agent (${request.requestingAgent}) is proposing:
Action: ${request.action} ${request.symbol}
Reasoning: ${request.reasoning}

What is your vote on this trade? Consider your investment strategy perspective.`;

    const result = await generateText({
      model: openai(this.modelName),
      system: PEER_VOTE_SYSTEM_PROMPT,
      prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: `consensus-vote-${agentName}`,
        metadata: {
          votingAgent: agentName,
          requestingAgent: request.requestingAgent,
          symbol: request.symbol,
        },
      },
    });

    return this.parseVote(agentName, result.text);
  }

  private parseVote(agentName: string, text: string): AgentVote {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        agentName,
        vote: this.normalizeVote(parsed.vote),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      };
    } catch {
      return {
        agentName,
        vote: 'ABSTAIN',
        reasoning: text.substring(0, 100),
        confidence: 0.3,
      };
    }
  }

  private normalizeVote(vote: unknown): 'APPROVE' | 'REJECT' | 'ABSTAIN' {
    const normalized = String(vote).toUpperCase();
    if (normalized === 'APPROVE' || normalized === 'REJECT') {
      return normalized;
    }
    return 'ABSTAIN';
  }

  private calculateRecommendation(summary: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  }): 'PROCEED' | 'RECONSIDER' | 'ABORT' {
    const votingAgents = summary.approve + summary.reject;

    if (votingAgents === 0) {
      return 'RECONSIDER'; // No opinions, be cautious
    }

    const approvalRate = summary.approve / votingAgents;

    if (approvalRate >= 0.67) {
      return 'PROCEED'; // Strong approval
    } else if (summary.reject > summary.approve) {
      return 'ABORT'; // More rejections
    } else {
      return 'RECONSIDER'; // Mixed opinions
    }
  }

  private buildConsensusReasoning(
    votes: AgentVote[],
    summary: { approve: number; reject: number; abstain: number }
  ): string {
    const approvers = votes
      .filter((v) => v.vote === 'APPROVE')
      .map((v) => v.agentName);
    const rejectors = votes
      .filter((v) => v.vote === 'REJECT')
      .map((v) => v.agentName);

    let reasoning = '';

    if (summary.approve > 0) {
      reasoning += `Approved by: ${approvers.join(', ')}. `;
    }
    if (summary.reject > 0) {
      reasoning += `Rejected by: ${rejectors.join(', ')}. `;
    }
    if (summary.abstain > 0) {
      reasoning += `${summary.abstain} agent(s) abstained. `;
    }

    return reasoning.trim();
  }
}
