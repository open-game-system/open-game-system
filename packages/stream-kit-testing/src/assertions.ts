import type { RenderStream, StreamState } from '@open-game-system/stream-kit-types';

export function assertStreamConnected(stream: RenderStream): void {
  const state = (stream as any).state;
  if (state.status !== 'streaming') {
    throw new Error(`Expected stream to be streaming but was ${state.status}`);
  }
}

export function assertStreamDisconnected(stream: RenderStream): void {
  const state = (stream as any).state;
  if (state.status !== 'ended') {
    throw new Error(`Expected stream to be ended but was ${state.status}`);
  }
}

export function assertStreamError(stream: RenderStream, code?: string): void {
  const state = (stream as any).state;
  if (state.status !== 'error') {
    throw new Error(`Expected stream to be in error state but was ${state.status}`);
  }
  if (code && state.errorCode !== code) {
    throw new Error(`Expected error code to be ${code} but was ${state.errorCode}`);
  }
}

export function waitForStreamState(stream: RenderStream, status: StreamState['status']): Promise<void> {
  return new Promise((resolve) => {
    const state = (stream as any).state;
    if (state.status === status) {
      resolve();
      return;
    }

    const unsubscribe = stream.subscribe((newState: StreamState) => {
      if (newState.status === status) {
        unsubscribe();
        resolve();
      }
    });
  });
} 