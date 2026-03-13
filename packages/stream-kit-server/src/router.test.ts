import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStreamKitRouter } from './router';
import { createMockHooks, MockEnv } from './mock-hooks';

describe('createStreamKitRouter', () => {
  let mockHooks: ReturnType<typeof createMockHooks>;
  let env: MockEnv;
  let handler: ReturnType<typeof createStreamKitRouter<MockEnv>>;

  beforeEach(() => {
    env = {
      storage: new Map(),
      subscribers: new Map(),
    };
    mockHooks = createMockHooks();
    handler = createStreamKitRouter<MockEnv>({ hooks: mockHooks });
  });

  describe('GET /stream/:streamId', () => {
    it('should return 404 when stream not found', async () => {
      const response = await handler(
        new Request('http://localhost/stream/123'),
        env
      );
      expect(response.status).toBe(404);
    });

    it('should return stream state when found', async () => {
      const testState = { status: 'active', data: 'test' };
      await mockHooks.saveStreamState({
        streamId: '123',
        state: testState,
        env
      });

      const response = await handler(
        new Request('http://localhost/stream/123'),
        env
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(testState);
    });
  });

  describe('POST /stream/:streamId', () => {
    it('should save stream state', async () => {
      const testState = { status: 'active', data: 'test' };
      const response = await handler(
        new Request('http://localhost/stream/123', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testState)
        }),
        env
      );
      expect(response.status).toBe(200);

      // Verify state was saved
      const savedState = await mockHooks.loadStreamState({
        streamId: '123',
        env
      });
      expect(savedState).toEqual(testState);
    });

    it('should return 400 for invalid JSON', async () => {
      const response = await handler(
        new Request('http://localhost/stream/123', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        }),
        env
      );
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /stream/:streamId', () => {
    it('should delete stream state', async () => {
      // First save some state
      await mockHooks.saveStreamState({
        streamId: '123',
        state: { status: 'active' },
        env
      });

      const response = await handler(
        new Request('http://localhost/stream/123', {
          method: 'DELETE'
        }),
        env
      );
      expect(response.status).toBe(200);

      // Verify state was deleted
      const savedState = await mockHooks.loadStreamState({
        streamId: '123',
        env
      });
      expect(savedState).toBeNull();
    });
  });

  describe('GET /stream/:streamId/sse', () => {
    it('should establish SSE connection and send initial state', async () => {
      const testState = { status: 'active', data: 'test' };
      await mockHooks.saveStreamState({
        streamId: '123',
        state: testState,
        env
      });

      const response = await handler(
        new Request('http://localhost/stream/123/sse'),
        env
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      // Read the SSE stream
      const reader = response.body?.getReader();
      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      
      // Should contain the initial state
      expect(text).toContain(JSON.stringify(testState));
    });

    it('should handle Last-Event-ID header', async () => {
      const response = await handler(
        new Request('http://localhost/stream/123/sse', {
          headers: { 'Last-Event-ID': 'event-1' }
        }),
        env
      );
      expect(response.status).toBe(200);
    });

    it('should close SSE connection when stream does not exist', async () => {
      const response = await handler(
        new Request('http://localhost/stream/nonexistent/sse'),
        env
      );
      expect(response.status).toBe(200); // SSE connections always return 200

      // Read the SSE stream - should close immediately
      const reader = response.body?.getReader();
      const { done } = await reader!.read();
      expect(done).toBe(true);
    });

    it('should send state change notifications', async () => {
      // Set up initial state
      const initialState = { status: 'active', data: 'initial' };
      await mockHooks.saveStreamState({
        streamId: '123',
        state: initialState,
        env
      });

      // Start SSE connection
      const response = await handler(
        new Request('http://localhost/stream/123/sse'),
        env
      );

      const reader = response.body?.getReader();
      
      // Read initial state
      const { value: initialValue } = await reader!.read();
      const initialText = new TextDecoder().decode(initialValue);
      expect(initialText).toContain(JSON.stringify(initialState));

      // Trigger a state change
      const newState = { status: 'active', data: 'updated' };
      await mockHooks.saveStreamState({
        streamId: '123',
        state: newState,
        env
      });

      // Read the update
      const { value: updateValue } = await reader!.read();
      const updateText = new TextDecoder().decode(updateValue);
      expect(updateText).toContain(JSON.stringify(newState));
    });

    it('should handle multiple subscribers', async () => {
      // Set up initial state
      await mockHooks.saveStreamState({
        streamId: '123',
        state: { status: 'active', data: 'initial' },
        env
      });

      // Create two SSE connections
      const response1 = await handler(
        new Request('http://localhost/stream/123/sse'),
        env
      );
      const response2 = await handler(
        new Request('http://localhost/stream/123/sse'),
        env
      );

      const reader1 = response1.body?.getReader();
      const reader2 = response2.body?.getReader();

      // Both should receive initial state
      const { value: value1 } = await reader1!.read();
      const { value: value2 } = await reader2!.read();
      
      const text1 = new TextDecoder().decode(value1);
      const text2 = new TextDecoder().decode(value2);
      
      expect(text1).toBe(text2);

      // Update state - both should receive the update
      const newState = { status: 'active', data: 'updated' };
      await mockHooks.saveStreamState({
        streamId: '123',
        state: newState,
        env
      });

      const { value: update1 } = await reader1!.read();
      const { value: update2 } = await reader2!.read();
      
      const updateText1 = new TextDecoder().decode(update1);
      const updateText2 = new TextDecoder().decode(update2);
      
      expect(updateText1).toBe(updateText2);
      expect(updateText1).toContain(JSON.stringify(newState));
    });

    it('should handle errors during streaming', async () => {
      // Mock loadStreamState to throw an error
      const mockLoad = vi.spyOn(mockHooks, 'loadStreamState');
      mockLoad.mockRejectedValueOnce(new Error('Load error'));

      const response = await handler(
        new Request('http://localhost/stream/123/sse'),
        env
      );

      const reader = response.body?.getReader();
      
      // Should get error message
      const { value: errorValue } = await reader!.read();
      const errorText = new TextDecoder().decode(errorValue);
      expect(errorText).toContain('Stream terminated due to error');

      // Next read should indicate stream closure
      const { done } = await reader!.read();
      expect(done).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for invalid paths', async () => {
      const response = await handler(
        new Request('http://localhost/invalid'),
        env
      );
      expect(response.status).toBe(404);
    });

    it('should return 405 for unsupported methods', async () => {
      const response = await handler(
        new Request('http://localhost/stream/123', {
          method: 'PUT'
        }),
        env
      );
      expect(response.status).toBe(405);
    });

    it('should handle hook errors gracefully', async () => {
      // Mock a hook to throw an error
      vi.spyOn(mockHooks, 'loadStreamState').mockRejectedValueOnce(
        new Error('Test error')
      );

      const response = await handler(
        new Request('http://localhost/stream/123'),
        env
      );
      expect(response.status).toBe(500);
    });
  });
}); 