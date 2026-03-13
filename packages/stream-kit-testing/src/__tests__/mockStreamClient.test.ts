import { describe, test, expect } from 'vitest';
import { createMockStreamClient } from '../mockStreamClient';
import { simulateBrokerEvent } from '../brokerEvents';
import type { StreamState } from '@open-game-system/stream-kit-types';

describe('MockStreamClient', () => {
  test('creates a render stream with initial state', () => {
    const client = createMockStreamClient();
    const stream = client.createRenderStream({
      url: 'https://test.com/stream'
    });

    expect(stream.url).toBe('https://test.com/stream');
    expect(stream.id).toBeDefined();
  });

  test('handles stream lifecycle', async () => {
    const client = createMockStreamClient();
    const stream = client.createRenderStream({
      url: 'https://test.com/stream'
    });

    let currentState: StreamState = { status: 'initializing' };
    stream.subscribe((state: StreamState) => {
      currentState = state;
    });

    await stream.start();
    expect(currentState.status).toBe('connecting');

    simulateBrokerEvent(stream, {
      type: 'peer_assigned',
      peerId: 'test-peer',
      connectionDetails: {
        iceServers: [{ urls: 'stun:test.com' }]
      }
    });
    expect(currentState.status).toBe('streaming');

    await stream.end();
    expect(currentState.status).toBe('ended');
  });

  test('handles error scenarios', () => {
    const client = createMockStreamClient();
    const stream = client.createRenderStream({
      url: 'https://test.com/stream'
    });

    let currentState: StreamState = { status: 'initializing' };
    stream.subscribe((state: StreamState) => {
      currentState = state;
    });

    simulateBrokerEvent(stream, {
      type: 'node_failure',
      reason: 'test failure'
    });

    expect(currentState.status).toBe('error');
    expect(currentState.errorCode).toBe('NODE_FAILURE');
    expect(currentState.errorMessage).toBe('test failure');
  });

  test('creates video element with test id', () => {
    const client = createMockStreamClient();
    const stream = client.createRenderStream({
      url: 'https://test.com/stream'
    });

    const video = stream.getVideoElement();
    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect(video?.dataset.testid).toBe('stream-video');
  });
}); 