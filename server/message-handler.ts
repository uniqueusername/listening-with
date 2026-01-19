import type { ServerWebSocket } from "bun";
import type { RoomManager } from "./room-manager";
import { searchSongs } from "./ytmusic";

interface WebSocketData {
  type: "host" | "client";
  roomCode?: string;
  clientId?: string;
}

export async function handleMessage(
  ws: ServerWebSocket<WebSocketData>,
  data: any,
  roomManager: RoomManager
): Promise<void> {
  const { type } = data;

  switch (type) {
    case "create_room": {
      try {
        const { baseUrl } = data;
        const roomData = await roomManager.createRoom(ws, baseUrl);
        ws.send(
          JSON.stringify({
            type: "room_created",
            ...roomData,
          })
        );
      } catch (error) {
        console.error("error creating room:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to create room",
          })
        );
      }
      break;
    }

    case "join_room": {
      const { roomCode, displayName } = data;

      if (!roomCode) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "room code required",
          })
        );
        return;
      }

      // normalize room code to uppercase for case-insensitive matching
      const normalizedRoomCode = roomCode.toUpperCase();

      const success = roomManager.joinRoom(
        normalizedRoomCode,
        ws,
        displayName
      );

      if (success) {
        ws.send(
          JSON.stringify({
            type: "room_joined",
            roomCode: normalizedRoomCode,
          })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to join room",
          })
        );
      }
      break;
    }

    case "search_songs": {
      const { query } = data;

      if (!query) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "query required",
          })
        );
        return;
      }

      try {
        const results = await searchSongs(query);
        ws.send(
          JSON.stringify({
            type: "search_results",
            results,
          })
        );
      } catch (error) {
        console.error("error searching songs:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "search failed",
          })
        );
      }
      break;
    }

    case "add_song": {
      const { videoId, title, artist, submittedBy } = data;

      if (!ws.data.roomCode) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "not in a room",
          })
        );
        return;
      }

      if (!videoId || !title || !artist) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "videoId, title, and artist required",
          })
        );
        return;
      }

      const success = roomManager.addSongToQueue(ws.data.roomCode, {
        videoId,
        title,
        artist,
        submittedBy,
      });

      if (success) {
        ws.send(
          JSON.stringify({
            type: "song_added_success",
          })
        );

        // update room activity
        roomManager.updateActivity(ws.data.roomCode);
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to add song",
          })
        );
      }
      break;
    }

    case "heartbeat": {
      // update room activity on heartbeat
      if (ws.data.roomCode) {
        roomManager.updateActivity(ws.data.roomCode);
      }

      ws.send(
        JSON.stringify({
          type: "heartbeat_ack",
        })
      );
      break;
    }

    case "update_queue": {
      if (!ws.data.roomCode || ws.data.type !== "host") {
        return;
      }

      const { queue, nowPlaying } = data;
      roomManager.broadcastToClients(ws.data.roomCode, {
        type: "queue_update",
        queue,
        nowPlaying,
      });
      break;
    }

    default: {
      console.log(`unknown message type: ${type}`);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "unknown message type",
        })
      );
    }
  }
}
