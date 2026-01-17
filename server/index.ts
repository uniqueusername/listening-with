import type { ServerWebSocket } from "bun";
import { RoomManager } from "./room-manager";
import { handleMessage } from "./message-handler";

const PORT = process.env.PORT || 3000;
const roomManager = new RoomManager();

interface WebSocketData {
  type: "host" | "client";
  roomCode?: string;
  clientId?: string;
}

const server = Bun.serve<WebSocketData>({
  port: PORT,
  fetch(req, server) {
    // Upgrade HTTP requests to WebSocket
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: {
          type: "client", // default, will be set based on first message
        },
      });

      if (upgraded) {
        return undefined;
      }

      return new Response("websocket upgrade failed", { status: 500 });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    return new Response("not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log("websocket connection opened");
    },

    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        handleMessage(ws, data, roomManager);
      } catch (error) {
        console.error("error parsing message:", error);
        ws.send(JSON.stringify({
          type: "error",
          message: "invalid message format",
        }));
      }
    },

    close(ws) {
      console.log("websocket connection closed");

      // Clean up: remove from room if connected
      if (ws.data.roomCode) {
        roomManager.removeFromRoom(ws.data.roomCode, ws);
      }
    },
  },
});

console.log(`listening-with server running on ws://localhost:${PORT}/ws`);

// Cleanup expired rooms periodically
setInterval(() => {
  roomManager.cleanupExpiredRooms();
}, 30000); // check every 30 seconds
