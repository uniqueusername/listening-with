export interface Song {
  videoId: string;
  title: string;
  artist: string;
  submittedBy?: string;
  duration?: string;
  thumbnailUrl?: string;
}

export interface SearchResult extends Song {}

// --- Outgoing Messages (Client -> Server) ---

export type ClientMessage =
  | { type: 'join_room'; roomCode: string; displayName?: string }
  | { type: 'search_songs'; query: string }
  | { type: 'add_song'; videoId: string; title: string; artist: string; submittedBy?: string }
  | { type: 'heartbeat' };

// --- Incoming Messages (Server -> Client) ---

export type ServerMessage =
  | { type: 'room_joined'; roomCode: string }
  | { type: 'search_results'; results: SearchResult[] }
  | { type: 'song_added_success' }
  | { type: 'heartbeat_ack' }
  | { type: 'error'; message: string }
  | { type: 'room_closed'; reason: string }
  | { type: 'queue_update'; queue: Song[]; nowPlaying: Song | null };