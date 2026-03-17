import { type WebSocket as WS, WebSocket, WebSocketServer } from "ws";
import {
  FIGMA_REQUEST_TIMEOUT,
  MAX_PENDING_REQUESTS,
  WEBSOCKET_PORT,
} from "../config/constants.js";
import type {
  FigmaFrameCreatedPayload,
  FigmaLayerTree,
  FigmaMessage,
  LayersCreatedPayload,
  Screenshot,
} from "../types/index.js";

// Union type so both request kinds share one map and one cleanup path.
type PendingResolve =
  | {
      kind: "frame";
      resolve: (value: FigmaFrameCreatedPayload) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  | {
      kind: "layers";
      resolve: (value: LayersCreatedPayload) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    };

export class FigmaBridge {
  private wss: WebSocketServer | null = null;
  private client: WS | null = null;
  private pendingRequests = new Map<string, PendingResolve>();
  private messageId = 0;

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: WEBSOCKET_PORT });

        this.wss.on("connection", (ws) => {
          // Close any existing connection rather than silently orphaning it.
          if (this.client && this.client.readyState === WebSocket.OPEN) {
            console.error("[FigmaBridge] Replacing existing Figma plugin connection");
            this.client.close();
          }

          console.error("[FigmaBridge] Figma plugin connected");
          this.client = ws;

          ws.on("message", (data) => {
            this.handleMessage(data.toString());
          });

          ws.on("close", () => {
            console.error("[FigmaBridge] Figma plugin disconnected");
            if (this.client === ws) {
              this.client = null;
            }
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
    // Reject all outstanding requests so callers don't hang.
    this.rejectAllPending(new Error("FigmaBridge is shutting down"));

    return new Promise((resolve) => {
      const closeServer = () => {
        if (this.wss) {
          this.wss.close(() => {
            console.error("[FigmaBridge] WebSocket server stopped");
            resolve();
          });
          this.wss = null;
        } else {
          resolve();
        }
      };

      if (this.client) {
        // Wait for the client socket to fully close before closing the server.
        this.client.once("close", closeServer);
        this.client.close();
        this.client = null;
      } else {
        closeServer();
      }
    });
  }

  isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  async createFrame(name: string, screenshots: Screenshot[]): Promise<FigmaFrameCreatedPayload> {
    if (!this.isConnected()) {
      return { frameId: "", success: false, error: "Figma plugin is not connected" };
    }

    if (this.pendingRequests.size >= MAX_PENDING_REQUESTS) {
      return {
        frameId: "",
        success: false,
        error: `Too many pending requests (${this.pendingRequests.size}/${MAX_PENDING_REQUESTS})`,
      };
    }

    const id = this.generateMessageId();
    const message: FigmaMessage = {
      id,
      type: "CREATE_FRAME",
      payload: { name, screenshots },
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("Request timed out waiting for Figma plugin response"));
      }, FIGMA_REQUEST_TIMEOUT);

      this.pendingRequests.set(id, { kind: "frame", resolve, reject, timer });

      // Guard against the client disconnecting between the isConnected() check and send().
      try {
        if (!this.client || this.client.readyState !== WebSocket.OPEN) {
          throw new Error("Figma plugin disconnected before message could be sent");
        }
        this.client.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async createLayers(name: string, layers: FigmaLayerTree[]): Promise<LayersCreatedPayload> {
    if (!this.isConnected()) {
      return {
        frameId: "",
        success: false,
        layersCreated: 0,
        error: "Figma plugin is not connected",
      };
    }

    if (this.pendingRequests.size >= MAX_PENDING_REQUESTS) {
      return {
        frameId: "",
        success: false,
        layersCreated: 0,
        error: `Too many pending requests (${this.pendingRequests.size}/${MAX_PENDING_REQUESTS})`,
      };
    }

    const id = this.generateMessageId();
    const message: FigmaMessage = {
      id,
      type: "CREATE_LAYERS",
      payload: { name, layers },
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("Request timed out waiting for Figma plugin response"));
      }, FIGMA_REQUEST_TIMEOUT);

      this.pendingRequests.set(id, { kind: "layers", resolve, reject, timer });

      try {
        if (!this.client || this.client.readyState !== WebSocket.OPEN) {
          throw new Error("Figma plugin disconnected before message could be sent");
        }
        this.client.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as FigmaMessage;

      if (message.type === "FRAME_CREATED") {
        const pending = this.pendingRequests.get(message.id);
        if (pending?.kind === "frame") {
          this.pendingRequests.delete(message.id);
          clearTimeout(pending.timer);
          pending.resolve(message.payload as FigmaFrameCreatedPayload);
        }
      } else if (message.type === "LAYERS_CREATED") {
        const pending = this.pendingRequests.get(message.id);
        if (pending?.kind === "layers") {
          this.pendingRequests.delete(message.id);
          clearTimeout(pending.timer);
          pending.resolve(message.payload as LayersCreatedPayload);
        }
      } else if (message.type === "ERROR") {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          clearTimeout(pending.timer);
          const payload = message.payload as { error: string };
          pending.reject(new Error(payload.error));
        }
      } else if (message.type === "PING") {
        this.client?.send(JSON.stringify({ id: message.id, type: "PONG", payload: {} }));
      }
    } catch (error) {
      console.error("[FigmaBridge] Failed to parse message:", error);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  private generateMessageId(): string {
    return `msg_${++this.messageId}_${Date.now()}`;
  }
}
