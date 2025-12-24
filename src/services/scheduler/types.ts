/**
 * Type definitions for Scheduler Service
 */

import { SessionResult } from '../orchestrator/index.js';

// ═══════════════════════════════════════════════════════
// JOB STATUS
// ═══════════════════════════════════════════════════════

export interface JobStatus {
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: 'success' | 'failure';
  nextRun?: string;
}

// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════

export interface SchedulerConfig {
  enabled?: boolean;
  tradingSchedule?: string;
  intradaySchedule?: string;
  timezone?: string;
  enableIntraday?: boolean;
  enableStreaming?: boolean;
}

export interface RequiredSchedulerConfig {
  enabled: boolean;
  tradingSchedule: string;
  intradaySchedule: string;
  timezone: string;
  enableIntraday: boolean;
  enableStreaming: boolean;
}

// ═══════════════════════════════════════════════════════
// MARKET STATUS
// ═══════════════════════════════════════════════════════

export interface MarketStatusResult {
  isOpen: boolean;
  status: string;
  tradingRecommended: boolean;
}

// ═══════════════════════════════════════════════════════
// JOB EXECUTION
// ═══════════════════════════════════════════════════════

export type JobExecutor = () => Promise<SessionResult | null>;

export interface JobDefinition {
  name: string;
  schedule: string;
  timezone: string;
  executor: JobExecutor;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

export const DEFAULT_CONFIG: RequiredSchedulerConfig = {
  enabled: true,
  tradingSchedule: '0 6 * * 1-5', // 6 AM UTC, Mon-Fri
  intradaySchedule: '30 10,14 * * 1-5', // 10:30 AM, 2:30 PM ET
  timezone: 'UTC',
  enableIntraday: false,
  enableStreaming: false,
};

export const JOB_NAMES = {
  DAILY_TRADING: 'daily-trading',
  INTRADAY_TRADING: 'intraday-trading',
  STREAMING: 'streaming-trading',
} as const;

export const TIMEZONES = {
  UTC: 'UTC',
  EASTERN: 'America/New_York',
} as const;

