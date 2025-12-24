/**
 * Consultant Agent
 * A specialized agent using Claude for independent trade evaluation
 */

import { generateText, type LanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Logger } from '../utils/logger.js';

export interface ConsultationRequest {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity?: number;
  price?: number;
  reasoning: string;
  concerns?: string;
  requestingAgent: string;
}

export interface ConsultationResponse {
  opinion: 'APPROVE' | 'REJECT' | 'CAUTION';
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  warnings: string[];
  alternatives?: string;
}

const CONSULTANT_SYSTEM_PROMPT = `You are "The Consultant", a senior investment advisor with 30+ years of experience across value investing, growth investing, dividend strategies, and technical analysis.

Your role is to provide an independent second opinion on proposed trades. You are reviewing decisions made by autonomous trading agents, each with their own strategy.

When evaluating a trade proposal:

1. **Consider the reasoning objectively** - Is the trading rationale sound?
2. **Identify blind spots** - What might the proposing agent be missing?
3. **Assess risk** - Is the risk/reward appropriate?
4. **Look for red flags** - Any obvious concerns?
5. **Consider timing** - Is now a good time for this trade?

Your response MUST be a valid JSON object with this exact structure:
{
  "opinion": "APPROVE" | "REJECT" | "CAUTION",
  "confidence": <number between 0 and 1>,
  "reasoning": "<2-3 sentences explaining your overall assessment>",
  "keyPoints": ["<point 1>", "<point 2>", ...],
  "warnings": ["<warning 1>", ...] or [],
  "alternatives": "<optional suggestion for a different approach>"
}

Guidelines:
- APPROVE: The trade makes sense, proceed
- CAUTION: Some concerns, but may proceed with awareness
- REJECT: Significant issues, recommend not proceeding
- Be direct and actionable in your feedback
- Focus on what matters most for the decision`;

export class ConsultantAgent {
  private modelName: string;

  constructor(modelName: string = 'claude-3-5-sonnet-20241022') {
    this.modelName = modelName;
    Logger.info(`ConsultantAgent initialized with model: ${modelName}`);
  }

  async evaluate(request: ConsultationRequest): Promise<ConsultationResponse> {
    Logger.info(
      `Consultant evaluating ${request.action} ${request.symbol} for ${request.requestingAgent}`
    );

    const prompt = this.buildPrompt(request);

    try {
      // Note: Type assertion needed due to SDK v2/v3 compatibility
      // The Anthropic SDK exports v3 models, but generateText expects LanguageModel (v2 compatible)
      // This works at runtime; the types will align when SDK versions stabilize
      const result = await generateText({
        model: anthropic(this.modelName) as unknown as LanguageModel,
        system: CONSULTANT_SYSTEM_PROMPT,
        prompt,
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'consultant-agent',
          metadata: {
            agentType: 'consultant',
            symbol: request.symbol,
            action: request.action,
            requestingAgent: request.requestingAgent,
          },
        },
      });

      // Parse the JSON response
      const response = this.parseResponse(result.text);

      Logger.info(
        `Consultant opinion for ${request.symbol}: ${response.opinion} (confidence: ${response.confidence})`
      );

      return response;
    } catch (error) {
      Logger.error('Consultant evaluation failed', error);

      // Return a cautious fallback response
      return {
        opinion: 'CAUTION',
        confidence: 0.3,
        reasoning:
          'Unable to complete full analysis due to technical issues. Recommend manual review.',
        keyPoints: ['Consultation service temporarily unavailable'],
        warnings: ['This is a fallback response - proceed with extra caution'],
      };
    }
  }

  private buildPrompt(request: ConsultationRequest): string {
    let prompt = `TRADE PROPOSAL FOR REVIEW

Requesting Agent: ${request.requestingAgent}
Action: ${request.action}
Symbol: ${request.symbol}`;

    if (request.quantity) {
      prompt += `\nQuantity: ${request.quantity} shares`;
    }
    if (request.price) {
      prompt += `\nEstimated Price: $${request.price.toFixed(2)}`;
    }

    prompt += `

AGENT'S REASONING:
${request.reasoning}`;

    if (request.concerns) {
      prompt += `

AGENT'S STATED CONCERNS:
${request.concerns}`;
    }

    prompt += `

Please evaluate this trade proposal and provide your expert opinion as a JSON object.`;

    return prompt;
  }

  private parseResponse(text: string): ConsultationResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      return {
        opinion: this.normalizeOpinion(parsed.opinion),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map(String)
          : [],
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings.map(String)
          : [],
        alternatives: parsed.alternatives ? String(parsed.alternatives) : undefined,
      };
    } catch (error) {
      Logger.warn('Failed to parse consultant response, using fallback');
      return {
        opinion: 'CAUTION',
        confidence: 0.4,
        reasoning: text.substring(0, 200),
        keyPoints: ['Response parsing failed - review raw output'],
        warnings: ['Could not parse structured response'],
      };
    }
  }

  private normalizeOpinion(opinion: unknown): 'APPROVE' | 'REJECT' | 'CAUTION' {
    const normalized = String(opinion).toUpperCase();
    if (normalized === 'APPROVE' || normalized === 'REJECT') {
      return normalized;
    }
    return 'CAUTION';
  }
}
