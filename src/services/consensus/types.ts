/**
 * Consensus Service Types
 */

/** Names of the trading agents */
export type AgentName = 'leonardo' | 'michelangelo' | 'raphael' | 'donatello';

export interface ConsensusRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  reasoning: string;
  requestingAgent: string;
}

export interface AgentVote {
  agentName: string;
  vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
  reasoning: string;
  confidence: number;
}

export interface ConsensusResponse {
  symbol: string;
  action: 'BUY' | 'SELL';
  votes: AgentVote[];
  summary: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  };
  recommendation: 'PROCEED' | 'RECONSIDER' | 'ABORT';
  consensusReasoning: string;
}
