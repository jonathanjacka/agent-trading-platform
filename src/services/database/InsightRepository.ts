/**
 * Insight Repository
 * Handles collective insights from cross-agent patterns
 */

import type Database from 'better-sqlite3';
import type { CollectiveInsight } from './types.js';

export class InsightRepository {
  constructor(private db: Database.Database) {}

  public create(insight: Omit<CollectiveInsight, 'id' | 'created_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO collective_insights (
        insight_type, content, contributing_agents, 
        confidence, evidence_count, tags
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      insight.insight_type,
      insight.content,
      insight.contributing_agents,
      insight.confidence,
      insight.evidence_count,
      insight.tags
    );
    return result.lastInsertRowid as number;
  }

  public get(insightId: number): CollectiveInsight | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM collective_insights WHERE id = ?'
    );
    return stmt.get(insightId) as CollectiveInsight | undefined;
  }

  public getAll(
    options: {
      insightType?: string;
      minConfidence?: number;
      minEvidenceCount?: number;
      limit?: number;
      tags?: string[];
      excludeAgent?: string;
    } = {}
  ): CollectiveInsight[] {
    const {
      insightType,
      minConfidence = 0,
      minEvidenceCount = 1,
      limit = 50,
      tags,
      excludeAgent,
    } = options;

    let query = `SELECT * FROM collective_insights WHERE evidence_count >= ?`;
    const params: any[] = [minEvidenceCount];

    if (insightType) {
      query += ` AND insight_type = ?`;
      params.push(insightType);
    }

    if (minConfidence > 0) {
      query += ` AND confidence >= ?`;
      params.push(minConfidence);
    }

    if (excludeAgent) {
      query += ` AND contributing_agents NOT LIKE ?`;
      params.push(`%"${excludeAgent}"%`);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      tags.forEach((tag) => params.push(`%"${tag}"%`));
    }

    query += ` ORDER BY confidence DESC, evidence_count DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as CollectiveInsight[];
  }

  public update(
    insightId: number,
    updates: Partial<
      Omit<CollectiveInsight, 'id' | 'created_at' | 'insight_type'>
    >
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    if (updates.contributing_agents !== undefined) {
      fields.push('contributing_agents = ?');
      values.push(updates.contributing_agents);
    }

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    if (updates.evidence_count !== undefined) {
      fields.push('evidence_count = ?');
      values.push(updates.evidence_count);
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(updates.tags);
    }

    if (fields.length === 0) return;

    values.push(insightId);
    const stmt = this.db.prepare(`
      UPDATE collective_insights 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    stmt.run(...values);
  }

  public delete(insightId: number): void {
    const stmt = this.db.prepare(
      'DELETE FROM collective_insights WHERE id = ?'
    );
    stmt.run(insightId);
  }
}
