import { RenderStreamConfig } from './types';

export interface StreamClientConfig {
  host: string;
  port?: number;
}

export interface RenderStream {
  id: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  connect(peerId: string): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<{ status: string; peerId?: string }>;
}

export class StreamClient {
  private baseUrl: string;

  constructor(private config: StreamClientConfig) {
    const port = config.port ? `:${config.port}` : '';
    this.baseUrl = `https://${config.host}${port}`;
  }

  async createRenderStream(config: RenderStreamConfig): Promise<RenderStream> {
    const response = await fetch(`${this.baseUrl}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to create stream: ${response.statusText}`);
    }

    const { sessionId } = await response.json();
    return new RenderStreamImpl(this.baseUrl, sessionId);
  }

  async getStream(sessionId: string): Promise<RenderStream | null> {
    try {
      const response = await fetch(`${this.baseUrl}/stream/${sessionId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get stream: ${response.statusText}`);
      }

      const session = await response.json();
      return new RenderStreamImpl(this.baseUrl, sessionId, session.status);
    } catch (error) {
      console.error('Failed to get stream:', error);
      return null;
    }
  }
}

class RenderStreamImpl implements RenderStream {
  constructor(
    private baseUrl: string,
    public id: string,
    public status: RenderStream['status'] = 'starting'
  ) {}

  async connect(peerId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stream/${this.id}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ peerId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to stream: ${response.statusText}`);
    }

    const result = await response.json();
    this.status = result.status;
  }

  async disconnect(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/stream/${this.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to disconnect from stream: ${response.statusText}`);
    }

    this.status = 'stopped';
  }

  async getStatus(): Promise<{ status: string; peerId?: string }> {
    const response = await fetch(`${this.baseUrl}/stream/${this.id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get stream status: ${response.statusText}`);
    }

    const session = await response.json();
    this.status = session.status;
    
    return {
      status: session.status,
      peerId: session.peerId,
    };
  }
}

export function createStreamClient(config: StreamClientConfig): StreamClient {
  return new StreamClient(config);
} 