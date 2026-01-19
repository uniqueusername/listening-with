export interface SongSource {
  type: 'search' | 'playlist' | 'album';
  id?: string;
  name?: string;
}

export interface Song {
  videoId: string;
  title: string;
  artist: string;
  submittedBy?: string;
  duration?: string;
  thumbnailUrl?: string;
  source?: SongSource;
}

export interface SearchResult {
  videoId?: string;
  albumId?: string;
  title: string;
  artist: string;
  duration?: string;
  thumbnailUrl?: string;
  resultType: 'song' | 'album';
  year?: number;
  songCount?: number;
}

export interface PlaylistInfo {
  playlistId: string;
  name: string;
  artist: string;
  thumbnailUrl?: string;
  videoCount: number;
}

export interface AlbumInfo {
  albumId: string;
  name: string;
  artist: string;
  thumbnailUrl?: string;
  year?: number;
  songCount: number;
}

// --- Outgoing Messages (Client -> Server) ---

export type ClientMessage =
  | { type: 'join_room'; roomCode: string; displayName?: string }
  | { type: 'search_songs'; query: string }
  | { type: 'add_song'; videoId: string; title: string; artist: string; submittedBy?: string }
  | { type: 'heartbeat' }
  | { type: 'parse_url'; url: string }
  | { type: 'fetch_playlist'; playlistId: string }
  | { type: 'fetch_album'; albumId: string }
  | { type: 'add_playlist'; playlistId: string; shuffle: boolean; submittedBy?: string }
  | { type: 'add_album'; albumId: string; shuffle: boolean; submittedBy?: string };

// --- Incoming Messages (Server -> Client) ---

export type ServerMessage =
  | { type: 'room_joined'; roomCode: string }
  | { type: 'search_results'; results: SearchResult[] }
  | { type: 'song_added_success' }
  | { type: 'heartbeat_ack' }
  | { type: 'error'; message: string }
  | { type: 'room_closed'; reason: string }
  | { type: 'queue_update'; primaryQueue: Song[]; auxiliaryQueue: Song[]; nowPlaying: Song | null }
  | { type: 'url_parsed'; urlType: 'playlist' | 'album' | null; id: string | null }
  | { type: 'playlist_info' } & PlaylistInfo
  | { type: 'album_info' } & AlbumInfo
  | { type: 'playlist_added_success'; songCount: number; playlistName: string }
  | { type: 'album_added_success'; songCount: number; albumName: string };