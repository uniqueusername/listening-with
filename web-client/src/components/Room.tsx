import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketProvider';
import { Search, Plus, Music, Clock, LogOut, CheckCircle, ListMusic, Play, Disc, X, Shuffle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchResult, Song } from '../lib/types';

// Helper to detect YouTube Music URLs
function parseYTMusicUrl(url: string): { type: 'playlist' | 'album' | null; id: string | null } {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('music.youtube.com')) {
      return { type: null, id: null };
    }

    if (urlObj.pathname === '/playlist') {
      const listId = urlObj.searchParams.get('list');
      if (listId) return { type: 'playlist', id: listId };
    }

    if (urlObj.pathname.startsWith('/browse/')) {
      const browseId = urlObj.pathname.replace('/browse/', '');
      if (browseId.startsWith('MPREb_')) return { type: 'album', id: browseId };
    }

    if (urlObj.pathname.startsWith('/channel/')) {
      const channelId = urlObj.pathname.replace('/channel/', '');
      if (channelId.startsWith('MPREb_')) return { type: 'album', id: channelId };
    }

    return { type: null, id: null };
  } catch {
    return { type: null, id: null };
  }
}

const Room: React.FC = () => {
  const {
    roomCode,
    searchSongs,
    searchResults,
    addSong,
    leaveRoom,
    primaryQueue,
    auxiliaryQueue,
    nowPlaying,
    playlistPreview,
    albumPreview,
    isLoadingPreview,
    fetchPlaylist,
    fetchAlbum,
    addPlaylist,
    addAlbum,
    clearPreview
  } = useWebSocket();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'queue'>('search');
  const [addedSongId, setAddedSongId] = useState<string | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [detectedUrl, setDetectedUrl] = useState<{ type: 'playlist' | 'album'; id: string } | null>(null);
  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null);

  // Detect URL when query changes
  useEffect(() => {
    const parsed = parseYTMusicUrl(query.trim());
    if (parsed.type && parsed.id) {
      setDetectedUrl({ type: parsed.type, id: parsed.id });
      // Only fetch if we haven't already fetched this ID
      if (parsed.id !== lastFetchedId) {
        setLastFetchedId(parsed.id);
        if (parsed.type === 'playlist') {
          fetchPlaylist(parsed.id);
        } else {
          fetchAlbum(parsed.id);
        }
      }
    } else {
      setDetectedUrl(null);
      setLastFetchedId(null);
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !detectedUrl) {
      searchSongs(query);
    }
  };

  const handleAdd = (song: SearchResult) => {
    if (song.resultType === 'album' && song.albumId) {
      // Show album preview
      fetchAlbum(song.albumId);
    } else if (song.videoId) {
      addSong(song);
      setAddedSongId(song.videoId);
      setTimeout(() => setAddedSongId(null), 2000);
    }
  };

  const handleAddPlaylistOrAlbum = () => {
    if (playlistPreview) {
      addPlaylist(playlistPreview.playlistId, shuffleEnabled);
    } else if (albumPreview) {
      addAlbum(albumPreview.albumId, shuffleEnabled);
    }
    setQuery('');
    setDetectedUrl(null);
    setLastFetchedId(null);
    setShuffleEnabled(true);
  };

  const handleClosePreview = () => {
    clearPreview();
    setDetectedUrl(null);
    setLastFetchedId(null);
    setQuery('');
  };

  const totalQueueCount = primaryQueue.length + auxiliaryQueue.length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-full">
                <Music className="w-5 h-5 text-blue-600" />
            </div>
            <div>
                <h1 className="font-bold text-gray-800 leading-tight">listening with</h1>
                <p className="text-xs text-gray-500 font-mono">room: {roomCode}</p>
            </div>
        </div>
        <button
            onClick={leaveRoom}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="leave room"
        >
            <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('search')}
          className={clsx(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            activeTab === 'search' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Search className="w-4 h-4" /> search
          </div>
          {activeTab === 'search' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={clsx(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            activeTab === 'queue' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <ListMusic className="w-4 h-4" /> queue
            {totalQueueCount > 0 && (
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                    {totalQueueCount}
                </span>
            )}
          </div>
          {activeTab === 'queue' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
      </div>

      {/* Now Playing Banner */}
      {nowPlaying && (
          <div className="bg-blue-600 text-white p-3 shadow-md flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg overflow-hidden flex-shrink-0">
                  {nowPlaying.thumbnailUrl ? (
                      <img src={nowPlaying.thumbnailUrl} alt={nowPlaying.title} className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-blue-200" />
                      </div>
                  )}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-200 uppercase font-semibold tracking-wider mb-0.5">now playing</div>
                  <h3 className="font-medium truncate leading-tight">{nowPlaying.title}</h3>
                  <p className="text-sm text-blue-100 truncate">{nowPlaying.artist}</p>
              </div>
              {nowPlaying.submittedBy && (
                  <div className="text-xs bg-blue-700 px-2 py-1 rounded text-blue-100 flex-shrink-0">
                      by {nowPlaying.submittedBy}
                  </div>
              )}
          </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'search' ? (
            <>
                {/* Search Bar */}
                <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
                    <form onSubmit={handleSearch} className="relative">
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                        placeholder="search or paste youtube music url..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    {query && !detectedUrl && (
                        <button
                            type="submit"
                            className="absolute right-2 top-2 bg-blue-600 text-white p-1.5 rounded-lg text-xs font-medium hover:bg-blue-700"
                        >
                            search
                        </button>
                    )}
                    </form>
                </div>

                {/* Playlist/Album Preview Panel */}
                {(playlistPreview || albumPreview || isLoadingPreview) && (
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-b border-purple-100">
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            {isLoadingPreview ? (
                                <div className="p-8 flex flex-col items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
                                    <p className="text-gray-500 text-sm">loading preview...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 flex items-start gap-4">
                                        {/* Thumbnail */}
                                        <div className="w-20 h-20 bg-purple-100 rounded-xl overflow-hidden flex-shrink-0">
                                            {(playlistPreview?.thumbnailUrl || albumPreview?.thumbnailUrl) ? (
                                                <img
                                                    src={playlistPreview?.thumbnailUrl || albumPreview?.thumbnailUrl}
                                                    alt={playlistPreview?.name || albumPreview?.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Disc className="w-10 h-10 text-purple-300" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={clsx(
                                                    "text-xs font-semibold uppercase px-2 py-0.5 rounded",
                                                    playlistPreview ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                                                )}>
                                                    {playlistPreview ? "playlist" : "album"}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-gray-900 truncate">
                                                {playlistPreview?.name || albumPreview?.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 truncate">
                                                by {playlistPreview?.artist || albumPreview?.artist}
                                                {albumPreview?.year && ` \u2022 ${albumPreview.year}`}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {playlistPreview?.videoCount || albumPreview?.songCount} tracks
                                            </p>
                                        </div>

                                        {/* Close button */}
                                        <button
                                            onClick={handleClosePreview}
                                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Shuffle toggle + Add button */}
                                    <div className="px-4 pb-4 space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={shuffleEnabled}
                                                onChange={(e) => setShuffleEnabled(e.target.checked)}
                                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                            />
                                            <Shuffle className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-700">shuffle before adding</span>
                                        </label>

                                        <button
                                            onClick={handleAddPlaylistOrAlbum}
                                            className="w-full py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-5 h-5" />
                                            add all to queue
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Results List */}
                {!playlistPreview && !albumPreview && !isLoadingPreview && (
                    <div className="p-4 space-y-3">
                        {searchResults.length === 0 && query.length > 0 && !detectedUrl ? (
                        <div className="text-center py-10 text-gray-400">
                            <p>no results yet. try searching!</p>
                        </div>
                        ) : searchResults.map((result, index) => (
                        <div key={result.videoId || result.albumId || index} className="flex items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-lg overflow-hidden relative">
                            {result.thumbnailUrl ? (
                                <img src={result.thumbnailUrl} alt={result.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    {result.resultType === 'album' ? <Disc className="w-8 h-8" /> : <Music className="w-8 h-8" />}
                                </div>
                            )}
                            {/* Type badge */}
                            {result.resultType === 'album' && (
                                <div className="absolute bottom-1 left-1 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    ALBUM
                                </div>
                            )}
                            </div>

                            {/* Info */}
                            <div className="ml-3 flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">{result.title}</h3>
                            <p className="text-xs text-gray-500 truncate">{result.artist}</p>
                            {result.resultType === 'song' && result.duration && (
                                <div className="flex items-center mt-1 text-xs text-gray-400">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {result.duration}
                                </div>
                            )}
                            {result.resultType === 'album' && result.year && (
                                <div className="flex items-center mt-1 text-xs text-gray-400">
                                    {result.year}
                                </div>
                            )}
                            </div>

                            {/* Action */}
                            <button
                            onClick={() => handleAdd(result)}
                            disabled={result.resultType === 'song' && addedSongId === result.videoId}
                            className={clsx(
                                "ml-3 p-3 rounded-full flex-shrink-0 transition-all",
                                result.resultType === 'song' && addedSongId === result.videoId
                                ? "bg-green-100 text-green-600"
                                : result.resultType === 'album'
                                ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            )}
                            >
                            {result.resultType === 'song' && addedSongId === result.videoId ? (
                                <CheckCircle className="w-5 h-5" />
                            ) : result.resultType === 'album' ? (
                                <Disc className="w-5 h-5" />
                            ) : (
                                <Plus className="w-5 h-5" />
                            )}
                            </button>
                        </div>
                        ))}

                        {searchResults.length === 0 && !query && (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50">
                                <Music className="w-16 h-16 mb-4" />
                                <p>search to add songs to the queue</p>
                                <p className="text-xs mt-2">or paste a youtube music playlist/album url</p>
                            </div>
                        )}
                    </div>
                )}
            </>
        ) : (
            // Queue List
            <div className="p-4 space-y-4">
                {primaryQueue.length === 0 && auxiliaryQueue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50">
                        <ListMusic className="w-16 h-16 mb-4" />
                        <p>the queue is empty</p>
                        <button
                            onClick={() => setActiveTab('search')}
                            className="mt-4 text-blue-600 font-medium hover:underline"
                        >
                            add a song
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Primary Queue */}
                        {primaryQueue.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                                    up next
                                </h3>
                                <div className="space-y-2">
                                    {primaryQueue.map((song, index) => (
                                        <QueueItem key={`primary-${song.videoId}-${index}`} song={song} index={index + 1} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Auxiliary Queue */}
                        {auxiliaryQueue.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
                                    <Disc className="w-3 h-3" />
                                    from {auxiliaryQueue[0]?.source?.type || 'playlist'}
                                    {auxiliaryQueue[0]?.source?.name && (
                                        <span className="text-gray-400 font-normal normal-case">
                                            ({auxiliaryQueue[0].source.name})
                                        </span>
                                    )}
                                </h3>
                                <div className="space-y-2">
                                    {auxiliaryQueue.map((song, index) => (
                                        <QueueItem
                                            key={`aux-${song.videoId}-${index}`}
                                            song={song}
                                            index={primaryQueue.length + index + 1}
                                            isAuxiliary
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

// Queue Item Component
const QueueItem: React.FC<{ song: Song; index: number; isAuxiliary?: boolean }> = ({ song, index, isAuxiliary }) => (
    <div className={clsx(
        "flex items-center bg-white p-3 rounded-xl shadow-sm border",
        isAuxiliary ? "border-purple-100" : "border-gray-100"
    )}>
        <div className={clsx(
            "w-6 text-center font-medium text-sm mr-2",
            isAuxiliary ? "text-purple-400" : "text-gray-400"
        )}>
            {index}
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-lg overflow-hidden relative">
            {song.thumbnailUrl ? (
                <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Music className="w-6 h-6" />
                </div>
            )}
        </div>

        {/* Info */}
        <div className="ml-3 flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{song.title}</h3>
            <p className="text-xs text-gray-500 truncate">{song.artist}</p>
            {song.submittedBy && (
                <p className={clsx(
                    "text-xs mt-0.5 truncate",
                    isAuxiliary ? "text-purple-500" : "text-blue-500"
                )}>
                    added by {song.submittedBy}
                </p>
            )}
        </div>
    </div>
);

export default Room;
