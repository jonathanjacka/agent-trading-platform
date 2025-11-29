import { Logger } from '../utils/logger.js';

export class PushoverService {
  private readonly apiUrl = 'https://api.pushover.net/1/messages.json';
  private readonly userKey: string;
  private readonly appToken: string;
  private readonly enabled: boolean;

  constructor() {
    this.userKey = process.env.PUSHOVER_USER || '';
    this.appToken = process.env.PUSHOVER_TOKEN || '';
    this.enabled = !!(this.userKey && this.appToken);

    if (!this.enabled) {
      Logger.warn(
        'Pushover notifications disabled - missing PUSHOVER_USER or PUSHOVER_TOKEN'
      );
    }
  }

  public async sendNotification(message: string): Promise<boolean> {
    if (!this.enabled) {
      Logger.warn('Pushover disabled - skipping notification');
      return false;
    }

    try {
      Logger.info(
        `Sending Pushover notification: ${message.substring(0, 50)}...`
      );

      const formData = new URLSearchParams({
        token: this.appToken,
        user: this.userKey,
        message: message,
      });

      Logger.info(`Form data: ${formData.toString().substring(0, 100)}...`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(5000),
      });

      const data = (await response.json()) as {
        status: number;
        errors?: string[];
      };

      if (data.status === 1) {
        Logger.success(`📱 Pushover notification sent`);
        return true;
      } else {
        Logger.warn(`Pushover notification failed: ${JSON.stringify(data)}`);
        return false;
      }
    } catch (error) {
      Logger.error('Failed to send Pushover notification', error);
      return false;
    }
  }

  public async notifyTrade(
    traderName: string,
    action: 'BUY' | 'SELL',
    symbol: string,
    quantity: number,
    price: number,
    totalValue: number
  ): Promise<void> {
    const emoji = action === 'BUY' ? '📈' : '📉';
    const actionText = action === 'BUY' ? 'Bought' : 'Sold';
    const message = `${emoji} ${traderName} - ${action}\n${actionText} ${quantity} ${symbol} @ $${price.toFixed(2)}\nTotal: $${totalValue.toFixed(2)}`;

    await this.sendNotification(message);
  }

  public async notifyTradeError(
    traderName: string,
    action: 'BUY' | 'SELL',
    symbol: string,
    quantity: number,
    errorMessage: string
  ): Promise<void> {
    const message = `⚠️ ${traderName} - ${action} FAILED\nAttempted to ${action.toLowerCase()} ${quantity} ${symbol}\nReason: ${errorMessage}`;

    await this.sendNotification(message);
  }

  public async sendTestNotification(): Promise<boolean> {
    return await this.sendNotification(
      '✅ Trading Platform - Pushover notifications are working!'
    );
  }
}
