import type { ServerWebSocket } from "bun";
import type { RoomManager } from "./room-manager";
import {
  searchSongs,
  parseYTMusicUrl,
  getPlaylistInfo,
  getPlaylistSongs,
  getAlbumInfo,
  getAlbumSongs,
} from "./ytmusic";

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

      const result = roomManager.joinRoom(
        normalizedRoomCode,
        ws,
        displayName
      );

      if (result.success) {
        ws.send(
          JSON.stringify({
            type: "room_joined",
            roomCode: normalizedRoomCode,
          })
        );
        // Send current queue state to the newly joined client
        ws.send(
          JSON.stringify({
            type: "queue_update",
            primaryQueue: result.primaryQueue,
            auxiliaryQueue: result.auxiliaryQueue,
            nowPlaying: result.nowPlaying,
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

      const { primaryQueue, auxiliaryQueue, nowPlaying } = data;
      // Store the queue state so new clients can receive it when they join
      roomManager.updateQueueState(ws.data.roomCode, primaryQueue, auxiliaryQueue, nowPlaying);
      roomManager.broadcastToClients(ws.data.roomCode, {
        type: "queue_update",
        primaryQueue,
        auxiliaryQueue,
        nowPlaying,
      });
      break;
    }

    case "parse_url": {
      const { url } = data;

      if (!url) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "url required",
          })
        );
        return;
      }

      const parsed = parseYTMusicUrl(url);
      ws.send(
        JSON.stringify({
          type: "url_parsed",
          urlType: parsed.type,
          id: parsed.id,
        })
      );
      break;
    }

    case "fetch_playlist": {
      const { playlistId } = data;

      if (!playlistId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "playlistId required",
          })
        );
        return;
      }

      try {
        const info = await getPlaylistInfo(playlistId);
        ws.send(
          JSON.stringify({
            type: "playlist_info",
            ...info,
          })
        );
      } catch (error) {
        console.error("error fetching playlist:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to fetch playlist",
          })
        );
      }
      break;
    }

    case "fetch_album": {
      const { albumId } = data;

      if (!albumId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "albumId required",
          })
        );
        return;
      }

      try {
        const info = await getAlbumInfo(albumId);
        ws.send(
          JSON.stringify({
            type: "album_info",
            ...info,
          })
        );
      } catch (error) {
        console.error("error fetching album:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to fetch album",
          })
        );
      }
      break;
    }

    case "add_playlist": {
      const { playlistId, shuffle, submittedBy } = data;

      if (!ws.data.roomCode) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "not in a room",
          })
        );
        return;
      }

      if (!playlistId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "playlistId required",
          })
        );
        return;
      }

      try {
        const [info, songs] = await Promise.all([
          getPlaylistInfo(playlistId),
          getPlaylistSongs(playlistId),
        ]);

        const songsToAdd = songs.map((song) => ({
          ...song,
          submittedBy,
        }));

        if (shuffle) {
          // Fisher-Yates shuffle
          for (let i = songsToAdd.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = songsToAdd[i];
            songsToAdd[i] = songsToAdd[j]!;
            songsToAdd[j] = temp!;
          }
        }

        const success = roomManager.addSongsToAuxiliaryQueue(
          ws.data.roomCode,
          songsToAdd,
          info.name,
          "playlist",
          playlistId
        );

        if (success) {
          ws.send(
            JSON.stringify({
              type: "playlist_added_success",
              songCount: songsToAdd.length,
              playlistName: info.name,
            })
          );
          roomManager.updateActivity(ws.data.roomCode);
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "failed to add playlist",
            })
          );
        }
      } catch (error) {
        console.error("error adding playlist:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to add playlist",
          })
        );
      }
      break;
    }

    case "add_album": {
      const { albumId, shuffle, submittedBy } = data;

      if (!ws.data.roomCode) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "not in a room",
          })
        );
        return;
      }

      if (!albumId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "albumId required",
          })
        );
        return;
      }

      try {
        const [info, songs] = await Promise.all([
          getAlbumInfo(albumId),
          getAlbumSongs(albumId),
        ]);

        const songsToAdd = songs.map((song) => ({
          ...song,
          submittedBy,
        }));

        if (shuffle) {
          // Fisher-Yates shuffle
          for (let i = songsToAdd.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = songsToAdd[i];
            songsToAdd[i] = songsToAdd[j]!;
            songsToAdd[j] = temp!;
          }
        }

        const success = roomManager.addSongsToAuxiliaryQueue(
          ws.data.roomCode,
          songsToAdd,
          info.name,
          "album",
          albumId
        );

        if (success) {
          ws.send(
            JSON.stringify({
              type: "album_added_success",
              songCount: songsToAdd.length,
              albumName: info.name,
            })
          );
          roomManager.updateActivity(ws.data.roomCode);
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "failed to add album",
            })
          );
        }
      } catch (error) {
        console.error("error adding album:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "failed to add album",
          })
        );
      }
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
