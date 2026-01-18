import React, { useState } from 'react';
import { useWebSocket } from './WebSocketProvider';
import { Search, Plus, Music, Clock, LogOut, CheckCircle, ListMusic, Play } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchResult, Song } from '../lib/types';

const Room: React.FC = () => {
  const { roomCode, searchSongs, searchResults, addSong, leaveRoom, queue, nowPlaying } = useWebSocket();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'queue'>('search');
  const [addedSongId, setAddedSongId] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchSongs(query);
    }
  };

  const handleAdd = (song: SearchResult) => {
    addSong(song);
    setAddedSongId(song.videoId);
    setTimeout(() => setAddedSongId(null), 2000);
  };

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
            {queue.length > 0 && (
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                    {queue.length}
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
                        placeholder="search for a song..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    {query && (
                        <button 
                            type="submit"
                            className="absolute right-2 top-2 bg-blue-600 text-white p-1.5 rounded-lg text-xs font-medium hover:bg-blue-700"
                        >
                            search
                        </button>
                    )}
                    </form>
                </div>

                {/* Results List */}
                <div className="p-4 space-y-3">
                    {searchResults.length === 0 && query.length > 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <p>no results yet. try searching!</p>
                    </div>
                    ) : searchResults.map((song) => (
                    <div key={song.videoId} className="flex items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-lg overflow-hidden relative">
                        {song.thumbnailUrl ? (
                            <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Music className="w-8 h-8" />
                            </div>
                        )}
                        </div>

                        {/* Info */}
                        <div className="ml-3 flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{song.title}</h3>
                        <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                        {song.duration && (
                            <div className="flex items-center mt-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3 mr-1" />
                                {song.duration}
                            </div>
                        )}
                        </div>

                        {/* Action */}
                        <button
                        onClick={() => handleAdd(song)}
                        disabled={addedSongId === song.videoId}
                        className={clsx(
                            "ml-3 p-3 rounded-full flex-shrink-0 transition-all",
                            addedSongId === song.videoId
                            ? "bg-green-100 text-green-600"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        )}
                        >
                        {addedSongId === song.videoId ? (
                            <CheckCircle className="w-5 h-5" />
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
                        </div>
                    )}
                </div>
            </>
        ) : (
            // Queue List
            <div className="p-4 space-y-3">
                {queue.length === 0 ? (
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
                    queue.map((song, index) => (
                        <div key={`${song.videoId}-${index}`} className="flex items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                            <div className="w-6 text-center text-gray-400 font-medium text-sm mr-2">
                                {index + 1}
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
                                    <p className="text-xs text-blue-500 mt-0.5 truncate">
                                        added by {song.submittedBy}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Room;