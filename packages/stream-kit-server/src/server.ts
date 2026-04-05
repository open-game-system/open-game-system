import { DockerContainerManager } from "./container-manager";
import type {
  ContainerManager,
  RenderStreamConfig,
  StreamKitServerConfig,
  StreamSession,
} from "./types";

export class StreamKitServer {
  private sessions = new Map<string, StreamSession>();
  private containerManager: ContainerManager;

  constructor(private config: StreamKitServerConfig) {
    this.containerManager = new DockerContainerManager({
      image: config.containerImage || "stream-kit-container",
      port: config.containerPort || 8080,
      extensionPath: config.extensionPath,
    });
  }

  async createStream(config: RenderStreamConfig): Promise<{ sessionId: string }> {
    const sessionId = generateSessionId();

    const session: StreamSession = {
      id: sessionId,
      url: config.url,
      status: "starting",
      createdAt: new Date(),
      lastActiveAt: new Date(),
      config,
    };

    this.sessions.set(sessionId, session);

    // Start container in background
    this.startContainer(sessionId).catch((error) => {
      console.error(`Failed to start container for session ${sessionId}:`, error);
      this.updateSessionStatus(sessionId, "error");
    });

    return { sessionId };
  }

  async connectToStream(
    sessionId: string,
    peerId: string,
  ): Promise<{ status: string; peerId?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.peerId = peerId;
    session.lastActiveAt = new Date();
    this.sessions.set(sessionId, session);

    // TODO: Notify container about peer connection

    return {
      status: session.status,
      peerId: session.peerId,
    };
  }

  async getStream(sessionId: string): Promise<StreamSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActiveAt = new Date();
      this.sessions.set(sessionId, session);
    }
    return session || null;
  }

  async deleteStream(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.updateSessionStatus(sessionId, "stopping");

    if (session.containerId) {
      try {
        await this.containerManager.stop(session.containerId);
      } catch (error) {
        console.error(`Failed to stop container ${session.containerId}:`, error);
      }
    }

    this.sessions.delete(sessionId);
  }

  async getActiveSessions(): Promise<StreamSession[]> {
    return Array.from(this.sessions.values());
  }

  async cleanup(): Promise<void> {
    await this.containerManager.cleanup();
  }

  private async startContainer(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const { containerId } = await this.containerManager.start(sessionId, session.config);

      session.containerId = containerId;
      session.status = "running";
      this.sessions.set(sessionId, session);
    } catch (error) {
      this.updateSessionStatus(sessionId, "error");
      throw error;
    }
  }

  private updateSessionStatus(sessionId: string, status: StreamSession["status"]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastActiveAt = new Date();
      this.sessions.set(sessionId, session);
    }
  }
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
