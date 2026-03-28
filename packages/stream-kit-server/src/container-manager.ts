import { spawn } from "node:child_process";
import type { ContainerManager, RenderStreamConfig } from "./types";

export interface DockerContainerConfig {
  image: string;
  port: number;
  extensionPath?: string;
}

export class DockerContainerManager implements ContainerManager {
  private containers = new Map<string, { containerId: string; port: number; sessionId: string }>();
  private nextPort = 8080;

  constructor(private config: DockerContainerConfig) {}

  async start(
    sessionId: string,
    renderConfig: RenderStreamConfig,
  ): Promise<{ containerId: string; port: number }> {
    const port = this.nextPort++;
    const containerId = `stream-kit-${sessionId}`;

    // Build docker run command
    const dockerArgs = [
      "run",
      "-d", // detached
      "--name",
      containerId,
      "-p",
      `${port}:${this.config.port}`,
      "--rm", // auto-remove when stopped
    ];

    // Mount extension if provided
    if (this.config.extensionPath) {
      dockerArgs.push("-v", `${this.config.extensionPath}:/app/extension:ro`);
    }

    // Add environment variables
    dockerArgs.push(
      "-e",
      `RENDER_URL=${renderConfig.url}`,
      "-e",
      `RENDER_WIDTH=${renderConfig.width || 1920}`,
      "-e",
      `RENDER_HEIGHT=${renderConfig.height || 1080}`,
      "-e",
      `DEVICE_SCALE_FACTOR=${renderConfig.deviceScaleFactor || 1}`,
    );

    dockerArgs.push(this.config.image);

    try {
      // Execute docker run
      await this.execCommand("docker", dockerArgs);
      this.containers.set(containerId, { containerId, port, sessionId });
      return { containerId, port };
    } catch (error) {
      throw new Error(`Failed to start container: ${error}`);
    }
  }

  async stop(containerId: string): Promise<void> {
    try {
      await this.execCommand("docker", ["stop", containerId]);
      this.containers.delete(containerId);
    } catch (error) {
      console.error(`Failed to stop container ${containerId}:`, error);
      // Try force removal
      try {
        await this.execCommand("docker", ["rm", "-f", containerId]);
        this.containers.delete(containerId);
      } catch (forceError) {
        console.error(`Failed to force remove container ${containerId}:`, forceError);
      }
    }
  }

  async getStatus(
    containerId: string,
  ): Promise<"starting" | "running" | "stopping" | "stopped" | "error"> {
    try {
      const stdout = await this.execCommand("docker", [
        "inspect",
        "--format",
        "{{.State.Status}}",
        containerId,
      ]);
      const status = stdout.trim();

      switch (status) {
        case "created":
        case "restarting":
          return "starting";
        case "running":
          return "running";
        case "paused":
          return "stopping";
        case "exited":
        case "dead":
          return "stopped";
        default:
          return "error";
      }
    } catch (_error) {
      return "error";
    }
  }

  async cleanup(): Promise<void> {
    const containerIds = Array.from(this.containers.keys());

    await Promise.all(
      containerIds.map(async (containerId) => {
        try {
          await this.stop(containerId);
        } catch (error) {
          console.error(`Failed to cleanup container ${containerId}:`, error);
        }
      }),
    );

    this.containers.clear();
  }

  private async execCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });
    });
  }
}
