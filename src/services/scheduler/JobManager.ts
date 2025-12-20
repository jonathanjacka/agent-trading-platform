/**
 * Job Manager
 *
 * Handles cron job scheduling, lifecycle management, and status tracking.
 */

import cron, { ScheduledTask } from 'node-cron';
import { Logger } from '../../utils/logger.js';
import { JobStatus, JobDefinition } from './types.js';

export class JobManager {
  private jobs: Map<string, ScheduledTask> = new Map();
  private jobStatuses: Map<string, JobStatus> = new Map();

  /**
   * Schedule a new job
   */
  scheduleJob(definition: JobDefinition): boolean {
    const { name, schedule, timezone, executor } = definition;

    if (!cron.validate(schedule)) {
      Logger.error(`Invalid cron expression for ${name}: ${schedule}`);
      return false;
    }

    const task = cron.schedule(
      schedule,
      async () => {
        await executor();
      },
      { timezone }
    );

    this.jobs.set(name, task);
    this.jobStatuses.set(name, {
      name,
      schedule,
      enabled: true,
    });

    Logger.success(`Scheduled job: ${name} (${schedule} ${timezone})`);
    return true;
  }

  /**
   * Stop a specific job
   */
  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      return false;
    }

    job.stop();
    this.jobs.delete(name);
    Logger.info(`Stopped job: ${name}`);
    return true;
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      Logger.info(`Stopped job: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Update job status after execution
   */
  updateJobStatus(
    name: string,
    result: 'success' | 'failure',
    runTime: Date = new Date()
  ): void {
    const status = this.jobStatuses.get(name);
    if (status) {
      status.lastRun = runTime;
      status.lastResult = result;
    }
  }

  /**
   * Get all job statuses
   */
  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  /**
   * Get status for a specific job
   */
  getJobStatus(name: string): JobStatus | undefined {
    return this.jobStatuses.get(name);
  }

  /**
   * Get count of active jobs
   */
  getActiveJobCount(): number {
    return this.jobs.size;
  }

  /**
   * Check if a job exists
   */
  hasJob(name: string): boolean {
    return this.jobs.has(name);
  }
}
