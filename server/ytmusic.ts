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
  videoId: string;
  title: string;
  artist: string;
  duration?: string;
  thumbnailUrl?: string;
}

export async function searchSongs(query: string): Promise<SearchResult[]> {
  const client = await getYTMusicClient();

  try {
    const results = await client.search(query, "song");

    // map results to our format
    return results.slice(0, 10).map((item: any) => ({
      videoId: item.videoId,
      title: item.name,
      artist: item.artist?.name || "unknown artist",
      duration: item.duration?.label,
      thumbnailUrl: item.thumbnails?.[0]?.url,
    }));
  } catch (error) {
    console.error("ytmusic search error:", error);
    throw new Error("search failed");
  }
}
