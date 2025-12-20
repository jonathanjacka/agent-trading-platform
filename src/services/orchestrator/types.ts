/**
 * Trading Orchestrator Types
 * Interfaces for session management and agent results
 */

export interface AgentResult {
  agentName: string;
  success: boolean;
  response?: string;
  error?: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

export interface SessionResult {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  agentResults: AgentResult[];
  totalAgents: number;
  successfulAgents: number;
  failedAgents: number;
  collectiveInsightsGenerated: number;
  errors: string[];
}

export interface SessionOptions {
  /** Specific agents to run (default: all) */
  agents?: string[];
  /** Delay between agents in ms (default: 90000 = 90 seconds) */
  delayBetweenAgentsMs?: number;
  /** Custom prompts per agent (default: use built-in daily prompts) */
  customPrompts?: Record<string, string>;
  /** Skip collective insights generation (default: false) */
  skipInsights?: boolean;
  /** Dry run - log but don't execute (default: false) */
  dryRun?: boolean;
}
