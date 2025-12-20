/**
 * Memory Tools
 * Tools for reviewing past experiences and recording insights
 */

import { tool } from 'ai';
import { Logger } from '../../utils/logger.js';
import { MemoryService } from '../../services/memory/index.js';
import {
  reviewMemoriesInputSchema,
  reviewInsightsInputSchema,
  recordLessonInputSchema,
} from '../schemas.js';

export interface MemoryToolsDeps {
  memoryService: MemoryService;
  agentName: string;
}

/**
 * Creates memory and insights tools
 */
export function createMemoryTools(deps: MemoryToolsDeps) {
  const { memoryService, agentName } = deps;

  return {
    reviewMemories: tool({
      description:
        'Review your past trading experiences, successes, and failures. Use this to learn from your history.',
      inputSchema: reviewMemoriesInputSchema,
      execute: async ({ memoryType, minConfidence, limit }) => {
        Logger.info(
          `${agentName} reviewing memories: type=${memoryType || 'all'}, minConfidence=${minConfidence || 0}`
        );

        const memories = memoryService.getAgentMemories(agentName, {
          memoryType: memoryType === 'all' ? undefined : memoryType,
          minConfidence: minConfidence || 0.3,
          limit: limit || 10,
        });

        if (memories.length === 0) {
          return {
            message: 'No memories found matching your criteria.',
            memories: [],
          };
        }

        return {
          message: `Found ${memories.length} relevant memories`,
          memories: memories.map((m) => ({
            type: m.memory_type,
            content: m.content,
            confidence: m.confidence,
            usageCount: m.use_count,
            successRate:
              m.use_count > 0
                ? (m.success_count / m.use_count).toFixed(2)
                : 'N/A',
            createdAt: m.created_at,
            tags: m.tags,
          })),
        };
      },
    }),

    reviewCollectiveLessons: tool({
      description:
        'Review insights and patterns discovered by other agents. Learn from collective wisdom.',
      inputSchema: reviewInsightsInputSchema,
      execute: async ({ insightType, minConfidence, limit }) => {
        Logger.info(
          `${agentName} reviewing collective lessons: type=${insightType || 'all'}`
        );

        const insights = memoryService.getCollectiveInsights({
          insightType: insightType === 'all' ? undefined : insightType,
          minConfidence: minConfidence || 0.5,
          limit: limit || 10,
          excludeAgent: agentName, // Don't include insights you contributed to
        });

        if (insights.length === 0) {
          return {
            message:
              'No collective insights found. Other agents may not have traded yet.',
            insights: [],
          };
        }

        return {
          message: `Found ${insights.length} collective insights from other agents`,
          insights: insights.map((i) => ({
            type: i.insight_type,
            content: i.content,
            confidence: i.confidence,
            evidenceCount: i.evidence_count,
            contributingAgents: i.contributing_agents,
            tags: i.tags,
            createdAt: i.created_at,
          })),
        };
      },
    }),

    recordLesson: tool({
      description:
        "Manually record an important insight, pattern, or lesson you've learned. Use this when you discover something significant.",
      inputSchema: recordLessonInputSchema,
      execute: async ({ content, tags }) => {
        Logger.info(
          `${agentName} recording lesson: ${content.substring(0, 50)}...`
        );

        const memoryId = memoryService.storeMemory(
          agentName,
          'manual_insight',
          content,
          undefined,
          0.7, // Start with high confidence for manual insights
          tags || []
        );

        return {
          success: true,
          message: `Lesson recorded successfully (ID: ${memoryId})`,
          memoryId,
        };
      },
    }),
  };
}
