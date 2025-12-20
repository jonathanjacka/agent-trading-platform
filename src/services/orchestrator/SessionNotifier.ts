/**
 * Session Notifier
 * Handles notifications for trading session results
 */

import type { SessionResult } from './types.js';
import { PushoverService } from '../PushoverService.js';

export class SessionNotifier {
  private pushoverService: PushoverService;

  constructor(pushoverService?: PushoverService) {
    this.pushoverService = pushoverService ?? new PushoverService();
  }

  /**
   * Send notification summarizing session results
   */
  async sendSessionNotification(result: SessionResult): Promise<void> {
    const emoji = result.failedAgents === 0 ? '✅' : '⚠️';
    const status =
      result.failedAgents === 0 ? 'Complete' : 'Completed with errors';

    const message = [
      `${emoji} Trading Session ${status}`,
      ``,
      `Duration: ${(result.durationMs / 1000 / 60).toFixed(1)} min`,
      `Agents: ${result.successfulAgents}/${result.totalAgents} successful`,
      result.collectiveInsightsGenerated > 0
        ? `Insights: ${result.collectiveInsightsGenerated} generated`
        : '',
      result.errors.length > 0 ? `Errors: ${result.errors.length}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.pushoverService.sendNotification(message);
  }

  /**
   * Send notification for a specific event
   */
  async sendEventNotification(title: string, message: string): Promise<void> {
    await this.pushoverService.sendNotification(`${title}\n\n${message}`);
  }
}
