import YTMusic from "ytmusic-api";

let ytmusic: YTMusic | null = null;

async function getYTMusicClient(): Promise<YTMusic> {
  if (!ytmusic) {
    ytmusic = new YTMusic();
    await ytmusic.initialize();
    console.log("ytmusic-api initialized");
  }
  return ytmusic;
}

export interface SearchResult {
  videoId?: string;
  albumId?: string;
  title: string;
  artist: string;
  duration?: string;
  thumbnailUrl?: string;
  resultType: "song" | "album";
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

export interface AlbumSong {
  videoId: string;
  title: string;
  artist: string;
  duration?: string;
  thumbnailUrl?: string;
}

export async function searchSongs(query: string): Promise<SearchResult[]> {
  const client = await getYTMusicClient();

  try {
    // Search for both songs and albums using specific methods
    const [songResults, albumResults] = await Promise.all([
      client.searchSongs(query),
      client.searchAlbums(query),
    ]);

    // Map song results - duration is in seconds, convert to mm:ss format
    const songs: SearchResult[] = songResults.slice(0, 7).map((item) => ({
      videoId: item.videoId,
      title: item.name,
      artist: item.artist?.name || "unknown artist",
      duration: item.duration ? formatDuration(item.duration) : undefined,
      thumbnailUrl: item.thumbnails?.[0]?.url,
      resultType: "song" as const,
    }));

    // Map album results
    const albums: SearchResult[] = albumResults.slice(0, 3).map((item) => ({
      albumId: item.albumId,
      title: item.name,
      artist: item.artist?.name || "unknown artist",
      thumbnailUrl: item.thumbnails?.[0]?.url,
      resultType: "album" as const,
      year: item.year ?? undefined,
    }));

    // Interleave results: songs first, then albums at the end
    return [...songs, ...albums];
  } catch (error) {
    console.error("ytmusic search error:", error);
    throw new Error("search failed");
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseYTMusicUrl(url: string): { type: "playlist" | "album" | null; id: string | null } {
  try {
    const urlObj = new URL(url);

    // Check if it's a YouTube Music URL
    if (!urlObj.hostname.includes("music.youtube.com")) {
      return { type: null, id: null };
    }

    // Check for playlist: /playlist?list=PLAYLIST_ID
    if (urlObj.pathname === "/playlist") {
      const listId = urlObj.searchParams.get("list");
      if (listId) {
        return { type: "playlist", id: listId };
      }
    }

    // Check for album: /browse/ALBUM_ID (albums start with MPREb_)
    if (urlObj.pathname.startsWith("/browse/")) {
      const browseId = urlObj.pathname.replace("/browse/", "");
      if (browseId.startsWith("MPREb_")) {
        return { type: "album", id: browseId };
      }
    }

    // Check for album via channel route: /channel/ALBUM_ID
    if (urlObj.pathname.startsWith("/channel/")) {
      const channelId = urlObj.pathname.replace("/channel/", "");
      if (channelId.startsWith("MPREb_")) {
        return { type: "album", id: channelId };
      }
    }

    return { type: null, id: null };
  } catch {
    return { type: null, id: null };
  }
}

export async function getPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
  const client = await getYTMusicClient();

  try {
    const playlist = await client.getPlaylist(playlistId);

    return {
      playlistId,
      name: playlist.name || "Unknown Playlist",
      artist: playlist.artist?.name || "Unknown Creator",
      thumbnailUrl: playlist.thumbnails?.[0]?.url,
      videoCount: playlist.videoCount || 0,
    };
  } catch (error) {
    console.error("ytmusic get playlist info error:", error);
    throw new Error("failed to get playlist info");
  }
}

export async function getPlaylistSongs(playlistId: string): Promise<AlbumSong[]> {
  const client = await getYTMusicClient();

  try {
    const videos = await client.getPlaylistVideos(playlistId);

    return videos.map((item) => ({
      videoId: item.videoId,
      title: item.name || "Unknown",
      artist: item.artist?.name || "Unknown Artist",
      duration: item.duration ? formatDuration(item.duration) : undefined,
      thumbnailUrl: item.thumbnails?.[0]?.url,
    }));
  } catch (error) {
    console.error("ytmusic get playlist songs error:", error);
    throw new Error("failed to get playlist songs");
  }
}

export async function getAlbumInfo(albumId: string): Promise<AlbumInfo> {
  const client = await getYTMusicClient();

  try {
    const album = await client.getAlbum(albumId);

    return {
      albumId,
      name: album.name || "Unknown Album",
      artist: album.artist?.name || "Unknown Artist",
      thumbnailUrl: album.thumbnails?.[0]?.url,
      year: album.year ?? undefined,
      songCount: album.songs?.length || 0,
    };
  } catch (error) {
    console.error("ytmusic get album info error:", error);
    throw new Error("failed to get album info");
  }
}

export async function getAlbumSongs(albumId: string): Promise<AlbumSong[]> {
  const client = await getYTMusicClient();

  try {
    const album = await client.getAlbum(albumId);
    const songs = album.songs || [];

    return songs.map((item) => ({
      videoId: item.videoId,
      title: item.name || "Unknown",
      artist: item.artist?.name || album.artist?.name || "Unknown Artist",
      duration: item.duration ? formatDuration(item.duration) : undefined,
      thumbnailUrl: item.thumbnails?.[0]?.url || album.thumbnails?.[0]?.url,
    }));
  } catch (error) {
    console.error("ytmusic get album songs error:", error);
    throw new Error("failed to get album songs");
  }
}
