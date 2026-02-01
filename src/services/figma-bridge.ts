import { type WebSocket, WebSocketServer } from "ws";
import type { FigmaFrameCreatedPayload, FigmaMessage, Screenshot } from "../types/index.js";

const WEBSOCKET_PORT = 19407;
const REQUEST_TIMEOUT = 30000; // 30 seconds

export class FigmaBridge {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: FigmaFrameCreatedPayload) => void;
      reject: (error: Error) => void;
    }
  >();
  private messageId = 0;

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: WEBSOCKET_PORT });

        this.wss.on("connection", (ws) => {
          console.error("[FigmaBridge] Figma plugin connected");
          this.client = ws;

          ws.on("message", (data) => {
            this.handleMessage(data.toString());
          });

          ws.on("close", () => {
            console.error("[FigmaBridge] Figma plugin disconnected");
            this.client = null;
          });

          ws.on("error", (error) => {
            console.error("[FigmaBridge] WebSocket error:", error.message);
          });
        });

        this.wss.on("listening", () => {
          console.error(`[FigmaBridge] WebSocket server listening on port ${WEBSOCKET_PORT}`);
          resolve();
        });

        this.wss.on("error", (error) => {
          console.error("[FigmaBridge] Server error:", error.message);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.close();
        this.client = null;
      }

      if (this.wss) {
        this.wss.close(() => {
          console.error("[FigmaBridge] WebSocket server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isConnected(): boolean {
    return this.client !== null && this.client.readyState === 1; // WebSocket.OPEN
  }

  async createFrame(name: string, screenshots: Screenshot[]): Promise<FigmaFrameCreatedPayload> {
    if (!this.isConnected()) {
      return {
        frameId: "",
        success: false,
        error: "Figma plugin is not connected",
      };
    }

    const id = this.generateMessageId();
    const message: FigmaMessage = {
      id,
      type: "CREATE_FRAME",
      payload: {
        name,
        screenshots,
      },
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("Request timed out waiting for Figma plugin response"));
      }, REQUEST_TIMEOUT);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      // Send message - client is guaranteed to exist since we checked isConnected()
      if (this.client) {
        this.client.send(JSON.stringify(message));
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as FigmaMessage;

      if (message.type === "FRAME_CREATED") {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          pending.resolve(message.payload as FigmaFrameCreatedPayload);
        }
      } else if (message.type === "ERROR") {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          const payload = message.payload as { error: string };
          pending.reject(new Error(payload.error));
        }
      } else if (message.type === "PING") {
        // Respond to ping with pong
        this.client?.send(JSON.stringify({ id: message.id, type: "PONG", payload: {} }));
      }
    } catch (error) {
      console.error("[FigmaBridge] Failed to parse message:", error);
    }
  }

  private generateMessageId(): string {
    return `msg_${++this.messageId}_${Date.now()}`;
  }
}
