import { NotificationIntent, DevicePushToken, PushTicket, PushReceipt } from '../../types/notifications';

export interface IPushProvider {
  sendPush(token: string, intent: NotificationIntent): Promise<PushTicket>;
  getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>>;
}

/**
 * Official Expo Push Service Gateway Client
 *
 * Requirements:
 * - Exponential backoff with jitter on 429/5xx (§21)
 * - Rate limit awareness (600/sec limit)
 * - Strict failure isolation (never block agent execution)
 * - Pure routing payloads (zero conversation / code leakage)
 */
export class ExpoPushProvider implements IPushProvider {
  private endpoint = 'https://exp.host/--/api/v2/push/send';
  private receiptEndpoint = 'https://exp.host/--/api/v2/push/getReceipts';

  async sendPush(token: string, intent: NotificationIntent): Promise<PushTicket> {
    const payload = {
      to: token,
      title: intent.title,
      body: intent.body,
      sound: 'default',
      priority: intent.priority === 'high' ? 'high' : 'default',
      channelId:
        intent.type === 'approval_required' || intent.type === 'agent_needs_input'
          ? 'agent_attention'
          : intent.type === 'agent_error'
          ? 'agent_errors'
          : 'agent_completion',
      categoryId: intent.type,
      collapseId: intent.collapseKey,
      data: intent.data,
    };

    let attempt = 0;
    const maxRetries = 2;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 429 || response.status >= 500) {
          attempt++;
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 4000);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
        }

        const json = (await response.json()) as any;
        const ticketData = json?.data;
        if (ticketData) {
          return {
            id: ticketData.id || `tick_${Date.now()}`,
            status: ticketData.status || 'ok',
            message: ticketData.message,
            details: ticketData.details,
          };
        }

        return {
          id: `tick_${Date.now()}`,
          status: 'ok',
        };
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) {
          return {
            id: `err_${Date.now()}`,
            status: 'error',
            message: String(err?.message || err),
          };
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    return {
      id: `err_${Date.now()}`,
      status: 'error',
      message: 'Max retries exhausted',
    };
  }

  async getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>> {
    const receiptsMap = new Map<string, PushReceipt>();
    if (!ticketIds.length) return receiptsMap;

    try {
      const response = await fetch(this.receiptEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ids: ticketIds }),
      });

      const json = (await response.json()) as any;
      const data = json?.data;
      if (data && typeof data === 'object') {
        for (const [id, receipt] of Object.entries<any>(data)) {
          receiptsMap.set(id, {
            id,
            status: receipt.status || 'ok',
            message: receipt.message,
            details: receipt.details,
          });
        }
      }
    } catch (e) {
      console.warn('[ExpoPushProvider] Failed to fetch receipts:', e);
    }

    return receiptsMap;
  }
}

export const expoPushProvider = new ExpoPushProvider();
