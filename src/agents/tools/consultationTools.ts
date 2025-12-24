/**
 * Consultation Tools
 * Tools for getting second opinions from the consultant and peer agents
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { ConsultantAgent } from '../ConsultantAgent.js';
import { ConsensusService } from '../../services/consensus/index.js';
import {
  consultExpertInputSchema,
  peerConsensusInputSchema,
} from '../schemas.js';

export interface ConsultationToolsDeps {
  consultantAgent: ConsultantAgent;
  consensusService: ConsensusService;
  agentName: string;
}

/**
 * Creates consultation tools for getting second opinions
 */
export function createConsultationTools(deps: ConsultationToolsDeps) {
  const { consultantAgent, consensusService, agentName } = deps;

  return {
    consultExpert: tool({
      description:
        'Get a second opinion from a senior investment consultant (Claude AI) on a proposed trade. Use this for significant trades or when you are uncertain about a decision. The consultant provides an independent analysis and recommendation.',
      inputSchema: consultExpertInputSchema,
      execute: async ({ symbol, action, quantity, price, reasoning, concerns }) => {
        Logger.info(`${agentName} consulting expert on ${action} ${symbol}`);

        try {
          const response = await consultantAgent.evaluate({
            symbol,
            action,
            quantity,
            price,
            reasoning,
            concerns,
            requestingAgent: agentName,
          });

          return {
            symbol,
            proposedAction: action,
            consultantOpinion: response.opinion,
            confidence: `${(response.confidence * 100).toFixed(0)}%`,
            reasoning: response.reasoning,
            keyPoints: response.keyPoints,
            warnings: response.warnings.length > 0 ? response.warnings : undefined,
            alternatives: response.alternatives,
            recommendation:
              response.opinion === 'APPROVE'
                ? 'The consultant recommends proceeding with this trade.'
                : response.opinion === 'REJECT'
                  ? 'The consultant recommends NOT proceeding with this trade.'
                  : 'The consultant advises caution - review the warnings before deciding.',
          };
        } catch (error) {
          return {
            error: `Failed to consult expert: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendation: 'Consultation unavailable - use your own judgment with extra caution.',
          };
        }
      },
    }),

    requestPeerConsensus: tool({
      description:
        'Ask your peer trading agents (Leonardo, Michelangelo, Raphael, Donatello) for their opinions on a proposed trade. Each agent votes based on their investment strategy. Use this for important decisions where you want multiple perspectives.',
      inputSchema: peerConsensusInputSchema,
      execute: async ({ symbol, action, reasoning }) => {
        Logger.info(`${agentName} requesting peer consensus on ${action} ${symbol}`);

        try {
          const response = await consensusService.gatherConsensus({
            symbol,
            action,
            reasoning,
            requestingAgent: agentName,
          });

          const voteDetails = response.votes.map((v) => ({
            agent: v.agentName,
            vote: v.vote,
            reasoning: v.reasoning,
          }));

          return {
            symbol,
            proposedAction: action,
            votes: voteDetails,
            summary: {
              approve: response.summary.approve,
              reject: response.summary.reject,
              abstain: response.summary.abstain,
            },
            recommendation: response.recommendation,
            consensusSummary: response.consensusReasoning,
            guidance:
              response.recommendation === 'PROCEED'
                ? 'Your peers support this trade. Consider proceeding.'
                : response.recommendation === 'ABORT'
                  ? 'Your peers have concerns. Consider reconsidering this trade.'
                  : 'Mixed opinions from peers. Weigh the feedback carefully.',
          };
        } catch (error) {
          return {
            error: `Failed to gather peer consensus: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendation: 'Consensus unavailable - use your own judgment.',
          };
        }
      },
    }),
  };
}
