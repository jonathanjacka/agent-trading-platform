/**
 * Scheduler Run Repository
 * Handles scheduler run tracking and history
 */

import type Database from 'better-sqlite3';
import type { SchedulerRun } from './types.js';

export class SchedulerRunRepository {
  constructor(private db: Database.Database) {}

  public create(sessionId: string, jobName: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO scheduler_runs (session_id, job_name, status)
      VALUES (?, ?, 'running')
    `);
    const result = stmt.run(sessionId, jobName);
    return result.lastInsertRowid as number;
  }

  public update(
    sessionId: string,
    updates: {
      status?: 'running' | 'success' | 'failure';
      completedAt?: string;
      totalAgents?: number;
      successfulAgents?: number;
      failedAgents?: number;
      totalTrades?: number;
      collectiveInsightsGenerated?: number;
      durationMs?: number;
      errorMessage?: string;
      resultsJson?: string;
    }
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.totalAgents !== undefined) {
      fields.push('total_agents = ?');
      values.push(updates.totalAgents);
    }
    if (updates.successfulAgents !== undefined) {
      fields.push('successful_agents = ?');
      values.push(updates.successfulAgents);
    }
    if (updates.failedAgents !== undefined) {
      fields.push('failed_agents = ?');
      values.push(updates.failedAgents);
    }
    if (updates.totalTrades !== undefined) {
      fields.push('total_trades = ?');
      values.push(updates.totalTrades);
    }
    if (updates.collectiveInsightsGenerated !== undefined) {
      fields.push('collective_insights_generated = ?');
      values.push(updates.collectiveInsightsGenerated);
    }
    if (updates.durationMs !== undefined) {
      fields.push('duration_ms = ?');
      values.push(updates.durationMs);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.resultsJson !== undefined) {
      fields.push('results_json = ?');
      values.push(updates.resultsJson);
    }

    if (fields.length === 0) return;

    values.push(sessionId);
    const stmt = this.db.prepare(`
      UPDATE scheduler_runs 
      SET ${fields.join(', ')} 
      WHERE session_id = ?
    `);
    stmt.run(...values);
  }

  public get(sessionId: string): SchedulerRun | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM scheduler_runs WHERE session_id = ?'
    );
    return stmt.get(sessionId) as SchedulerRun | undefined;
  }

  public getAll(
    options: {
      limit?: number;
      status?: 'running' | 'success' | 'failure';
      jobName?: string;
    } = {}
  ): SchedulerRun[] {
    const { limit = 50, status, jobName } = options;

    let query = 'SELECT * FROM scheduler_runs WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (jobName) {
      query += ' AND job_name = ?';
      params.push(jobName);
    }

    query += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as SchedulerRun[];
  }

  public getLatest(jobName?: string): SchedulerRun | undefined {
    let query = 'SELECT * FROM scheduler_runs';
    const params: any[] = [];

    if (jobName) {
      query += ' WHERE job_name = ?';
      params.push(jobName);
    }

    query += ' ORDER BY started_at DESC LIMIT 1';

    const stmt = this.db.prepare(query);
    return stmt.get(...params) as SchedulerRun | undefined;
  }
}
