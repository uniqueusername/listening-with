import React, { useState } from 'react';
import { useWebSocket } from './WebSocketProvider';
import { Search, Plus, Music, Clock, LogOut, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { SearchResult } from '../lib/types';

const Room: React.FC = () => {
  const { roomCode, searchSongs, searchResults, addSong, leaveRoom } = useWebSocket();
  const [query, setQuery] = useState('');
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

      {/* Search Bar */}
      <div className="p-4 bg-white border-b border-gray-200">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                <Music className="w-16 h-16 mb-4" />
                <p>search to add songs to the queue</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Room;