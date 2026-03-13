import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createNotificationClient, NotificationApiError } from './index';

// Mock the global fetch
const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

describe('NotificationClient', () => {
  beforeEach(() => {
    globalFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNotificationClient', () => {
    it('uses the default base URL if none provided', async () => {
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', status: 'sent' }),
      });

      const client = createNotificationClient({ apiKey: 'test-key' });

      await client.sendNotification({
        deviceId: 'd1',
        notification: { title: 'T', body: 'B' }
      });

      expect(globalFetch).toHaveBeenCalledWith(
        'https://api.opengame.org/api/v1/notifications/send',
        expect.any(Object)
      );
    });

    it('uses custom base URL', async () => {
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', status: 'sent' }),
      });

      const client = createNotificationClient({
        apiKey: 'test-key',
        baseUrl: 'http://localhost:8787'
      });

      await client.sendNotification({
        deviceId: 'd1',
        notification: { title: 'T', body: 'B' }
      });

      expect(globalFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/v1/notifications/send',
        expect.any(Object)
      );
    });
  });

  describe('sendNotification', () => {
    it('sends correct headers and body', async () => {
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', status: 'sent' }),
      });

      const client = createNotificationClient({ apiKey: 'test-key' });

      const payload = {
        deviceId: 'd1',
        notification: { title: 'T', body: 'B', data: { url: '/x' } }
      };

      await client.sendNotification(payload);

      expect(globalFetch).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key',
          },
          body: JSON.stringify(payload),
        }
      );
    });

    it('throws NotificationApiError when fetch is not ok', async () => {
      globalFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'auth_failed', message: 'Invalid key', status: 401 } }),
      });

      const client = createNotificationClient({ apiKey: 'test-key' });

      try {
        await client.sendNotification({ deviceId: 'd1', notification: { title: 'T', body: 'B' } });
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotificationApiError);
        expect(err.code).toBe('auth_failed');
        expect(err.status).toBe(401);
        expect(err.message).toBe('Invalid key');
      }
    });
  });

  describe('sendBulkNotifications', () => {
    it('returns mixed results gracefully', async () => {
      // First fails, second succeeds
      globalFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 'bad', message: 'bad', status: 400 } }),
      });
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'success-id', status: 'sent' }),
      });

      const client = createNotificationClient({ apiKey: 'test-key' });

      const result = await client.sendBulkNotifications({
        deviceIds: ['d1', 'd2'],
        notification: { title: 'T', body: 'B' }
      });

      expect(globalFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);

      // Failed item
      expect(result[0]).toEqual({ id: '', status: 'failed' });

      // Success item
      expect(result[1]).toEqual({ id: 'success-id', status: 'sent' });
    });
  });
});
