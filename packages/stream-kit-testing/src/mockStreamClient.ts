import type { RenderStream, CreateRenderStreamParams, StreamState, RenderOptions, InputStreamEvent } from '@open-game-system/stream-kit-types';
import { BrokerEvent } from './brokerEvents';

export interface MockStreamClient {
  createRenderStream: (params: CreateRenderStreamParams) => RenderStream;
}

class MockRenderStream implements RenderStream {
  public readonly state: StreamState = { status: 'initializing' };
  private stateListeners: ((state: StreamState) => void)[] = [];

  constructor(
    public readonly id: string,
    public readonly url: string
  ) {}

  async start(): Promise<void> {
    this.updateState({ status: 'connecting' });
  }

  async end(): Promise<void> {
    this.updateState({ status: 'ended' });
  }

  send(_event: InputStreamEvent): void {
    // In the mock, we don't actually send events
  }

  async update(_updates: { renderOptions?: RenderOptions; sceneData?: any }): Promise<void> {
    // In the mock, we don't actually update anything
  }

  getVideoElement(): HTMLVideoElement | null {
    const video = document.createElement('video');
    video.dataset.testid = 'stream-video';
    return video;
  }

  subscribe(listener: (state: StreamState) => void): () => void {
    this.stateListeners.push(listener);
    listener(this.state);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  destroy(): void {
    this.updateState({ status: 'ended' });
    this.stateListeners = [];
  }

  // Internal methods for testing
  _handleBrokerEvent(event: BrokerEvent): void {
    switch (event.type) {
      case 'peer_assigned':
        this.updateState({ status: 'streaming' });
        break;
      case 'node_failure':
        this.updateState({ 
          status: 'error',
          errorCode: 'NODE_FAILURE',
          errorMessage: event.reason
        });
        break;
      case 'stream_ended':
        this.updateState({ status: 'ended' });
        break;
      case 'quality_change':
        this.updateState({
          ...this.state,
          resolution: event.settings.resolution,
          fps: event.settings.fps,
          bitrate: event.settings.bitrate
        });
        break;
    }
  }

  private updateState(newState: StreamState): void {
    Object.assign(this.state, newState);
    this.stateListeners.forEach(listener => listener(this.state));
  }
}

export function createMockStreamClient(): MockStreamClient {
  return {
    createRenderStream: (params: CreateRenderStreamParams): RenderStream => {
      return new MockRenderStream(
        Math.random().toString(36).substring(7),
        params.url
      );
    }
  };
} 