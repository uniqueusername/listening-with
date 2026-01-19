import type { ServerWebSocket } from "bun";
import QRCode from "qrcode";

interface WebSocketData {
  type: "host" | "client";
  roomCode?: string;
  clientId?: string;
}

interface Room {
  code: string;
  host: ServerWebSocket<WebSocketData>;
  clients: Set<ServerWebSocket<WebSocketData>>;
  queue: Song[];
  nowPlaying: Song | null;
  lastActivity: number;
  createdAt: number;
}

interface Song {
  videoId: string;
  title: string;
  artist: string;
  submittedBy?: string;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private readonly ROOM_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity
  private readonly BASE_URL = process.env.BASE_URL || "http://localhost:3001";

  generateRoomCode(): string {
    // generate 4-character alphabetic code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude similar looking chars (I, O)
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    // ensure uniqueness
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }

    return code;
  }

  async createRoom(host: ServerWebSocket<WebSocketData>, baseUrl?: string): Promise<{
    code: string;
    qrCodeDataUrl: string;
    joinUrl: string;
  }> {
    const code = this.generateRoomCode();

    const room: Room = {
      code,
      host,
      clients: new Set(),
      queue: [],
      nowPlaying: null,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    host.data.roomCode = code;
    host.data.type = "host";

    // generate qr code with just the room code
    // use provided baseUrl if available, otherwise fall back to default
    const effectiveBaseUrl = baseUrl || this.BASE_URL;
    const joinUrl = `${effectiveBaseUrl}?code=${code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl);

    console.log(`room created: ${code}`);

    return {
      code,
      qrCodeDataUrl,
      joinUrl,
    };
  }

  joinRoom(
    roomCode: string,
    client: ServerWebSocket<WebSocketData>,
    displayName?: string
  ): { success: false } | { success: true; queue: Song[]; nowPlaying: Song | null } {
    const room = this.rooms.get(roomCode);

    if (!room) {
      console.log(`join failed: room ${roomCode} not found`);
      return { success: false };
    }

    // add client to room
    room.clients.add(client);
    client.data.roomCode = roomCode;
    client.data.type = "client";
    client.data.clientId = crypto.randomUUID();

    room.lastActivity = Date.now();

    console.log(
      `client joined room ${roomCode}${displayName ? ` as ${displayName}` : " anonymously"}`
    );

    // notify host
    room.host.send(
      JSON.stringify({
        type: "client_joined",
        clientId: client.data.clientId,
        displayName,
        clientCount: room.clients.size,
      })
    );

    return { success: true, queue: room.queue, nowPlaying: room.nowPlaying };
  }

  addSongToQueue(roomCode: string, song: Song): boolean {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return false;
    }

    room.queue.push(song);
    room.lastActivity = Date.now();

    console.log(
      `song added to room ${roomCode}: ${song.title} by ${song.artist}${
        song.submittedBy ? ` (submitted by ${song.submittedBy})` : ""
      }`
    );

    // notify host of new song
    room.host.send(
      JSON.stringify({
        type: "song_added",
        song,
        queueLength: room.queue.length,
      })
    );

    return true;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  removeFromRoom(
    roomCode: string,
    connection: ServerWebSocket<WebSocketData>
  ): void {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return;
    }

    // if host disconnects, close the room
    if (connection === room.host) {
      console.log(`host disconnected, closing room ${roomCode}`);

      // notify all clients
      room.clients.forEach((client) => {
        client.send(
          JSON.stringify({
            type: "room_closed",
            reason: "host disconnected",
          })
        );
        client.close();
      });

      this.rooms.delete(roomCode);
      return;
    }

    // remove client
    room.clients.delete(connection);
    room.lastActivity = Date.now();

    console.log(`client left room ${roomCode}`);

    // notify host
    room.host.send(
      JSON.stringify({
        type: "client_left",
        clientId: connection.data.clientId,
        clientCount: room.clients.size,
      })
    );
  }

  cleanupExpiredRooms(): void {
    const now = Date.now();
    const expiredRooms: string[] = [];

    this.rooms.forEach((room, code) => {
      if (now - room.lastActivity > this.ROOM_TIMEOUT) {
        expiredRooms.push(code);
      }
    });

    expiredRooms.forEach((code) => {
      const room = this.rooms.get(code);
      if (room) {
        console.log(`room ${code} expired due to inactivity`);

        // notify all clients
        room.clients.forEach((client) => {
          client.send(
            JSON.stringify({
              type: "room_closed",
              reason: "inactivity timeout",
            })
          );
          client.close();
        });

        // notify host
        room.host.send(
          JSON.stringify({
            type: "room_closed",
            reason: "inactivity timeout",
          })
        );
        room.host.close();

        this.rooms.delete(code);
      }
    });
  }

  updateActivity(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  broadcastToClients(roomCode: string, message: any): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      const messageStr = JSON.stringify(message);
      room.clients.forEach((client) => {
        client.send(messageStr);
      });
    }
  }

  updateQueueState(roomCode: string, queue: Song[], nowPlaying: Song | null): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.queue = queue;
      room.nowPlaying = nowPlaying;
    }
  }
}
