import type { RenderStream } from '@open-game-system/stream-kit-types';

export interface StreamQualitySettings {
  resolution: '720p' | '1080p' | '1440p' | '2160p';
  bitrate: number;
  fps: number;
}

export type BrokerEvent =
  | { type: 'peer_assigned'; peerId: string; connectionDetails: RTCConfiguration }
  | { type: 'node_failure'; reason: string }
  | { type: 'stream_ended'; reason: string }
  | { type: 'quality_change'; settings: StreamQualitySettings };

export function simulateBrokerEvent(stream: RenderStream, event: BrokerEvent): void {
  // Access the internal _handleBrokerEvent method using type assertion
  (stream as any)._handleBrokerEvent(event);
} 