/**
 * Memory Repository
 * Handles agent memory storage and retrieval
 */

import type Database from 'better-sqlite3';
import type { AgentMemory } from './types.js';

export class MemoryRepository {
  constructor(private db: Database.Database) {}

  public create(memory: Omit<AgentMemory, 'id' | 'created_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (
        agent_name, memory_type, content, context, confidence,
        last_used_at, use_count, success_count, failure_count, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      memory.agent_name,
      memory.memory_type,
      memory.content,
      memory.context,
      memory.confidence,
      memory.last_used_at,
      memory.use_count,
      memory.success_count,
      memory.failure_count,
      memory.tags
    );
    return result.lastInsertRowid as number;
  }

  public get(memoryId: number): AgentMemory | undefined {
    const stmt = this.db.prepare('SELECT * FROM agent_memory WHERE id = ?');
    return stmt.get(memoryId) as AgentMemory | undefined;
  }

  public getByAgent(
    agentName: string,
    options: {
      memoryType?: string;
      minConfidence?: number;
      limit?: number;
      tags?: string[];
    } = {}
  ): AgentMemory[] {
    const { memoryType, minConfidence = 0, limit = 50, tags } = options;

    let query = `SELECT * FROM agent_memory WHERE agent_name = ?`;
    const params: any[] = [agentName];

    if (memoryType) {
      query += ` AND memory_type = ?`;
      params.push(memoryType);
    }

    if (minConfidence > 0) {
      query += ` AND confidence >= ?`;
      params.push(minConfidence);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      tags.forEach((tag) => params.push(`%"${tag}"%`));
    }

    query += ` ORDER BY confidence DESC, created_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as AgentMemory[];
  }

  public update(
    memoryId: number,
    updates: Partial<
      Omit<AgentMemory, 'id' | 'agent_name' | 'created_at' | 'memory_type'>
    >
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    if (updates.context !== undefined) {
      fields.push('context = ?');
      values.push(updates.context);
    }

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    if (updates.last_used_at !== undefined) {
      fields.push('last_used_at = ?');
      values.push(updates.last_used_at);
    }

    if (updates.use_count !== undefined) {
      fields.push('use_count = ?');
      values.push(updates.use_count);
    }

    if (updates.success_count !== undefined) {
      fields.push('success_count = ?');
      values.push(updates.success_count);
    }

    if (updates.failure_count !== undefined) {
      fields.push('failure_count = ?');
      values.push(updates.failure_count);
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      values.push(updates.tags);
    }

    if (fields.length === 0) return;

    values.push(memoryId);
    const stmt = this.db.prepare(`
      UPDATE agent_memory 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `);
    stmt.run(...values);
  }

  public delete(memoryId: number): void {
    const stmt = this.db.prepare('DELETE FROM agent_memory WHERE id = ?');
    stmt.run(memoryId);
  }

  public incrementUsage(memoryId: number, wasSuccessful: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE agent_memory 
      SET use_count = use_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_used_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(wasSuccessful ? 1 : 0, wasSuccessful ? 0 : 1, memoryId);
  }

  public cleanupLowConfidence(
    minConfidence: number = 0.3,
    minAge: number = 7
  ): number {
    const stmt = this.db.prepare(`
      DELETE FROM agent_memory 
      WHERE confidence < ? 
      AND datetime(created_at) <= datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(minConfidence, minAge);
    return result.changes;
  }
}
