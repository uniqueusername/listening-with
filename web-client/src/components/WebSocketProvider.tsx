import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage, SearchResult, Song } from '../lib/types';

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  roomCode: string | null;
  displayName: string | null;
  searchResults: SearchResult[];
  queue: Song[];
  nowPlaying: Song | null;
  lastError: string | null;
  joinRoom: (roomCode: string, displayName?: string) => void;
  searchSongs: (query: string) => void;
  addSong: (song: SearchResult, submittedBy?: string) => void;
  clearSearchResults: () => void;
  leaveRoom: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [nowPlaying, setNowPlaying] = useState<Song | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Store room info for reconnection after disconnect
  const pendingRejoin = useRef<{ roomCode: string; displayName?: string } | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    // Dynamic WebSocket URL: use env var if set, otherwise derive from current hostname
    let wsUrl = import.meta.env.PUBLIC_WS_URL;
    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const port = window.location.port ? `:${window.location.port}` : '';
      const isProduction = window.location.protocol === 'https:';
      
      if (isProduction) {
        // In production (https), assume same domain, standard port (443), path /ws
        wsUrl = `wss://${window.location.hostname}/ws`;
      } else {
        // In dev (http), default to port 2946 (server default)
        wsUrl = `ws://${window.location.hostname}:2946/ws`;
      }
    }
    
    console.log(`[WebSocket] Attempting connection to: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('connected to websocket server');
      setIsConnected(true);
      setIsConnecting(false);
      setLastError(null);

      // If we have a pending rejoin (reconnecting after disconnect), rejoin the room
      if (pendingRejoin.current) {
        console.log('rejoining room after reconnect:', pendingRejoin.current.roomCode);
        socket.send(JSON.stringify({
          type: 'join_room',
          roomCode: pendingRejoin.current.roomCode,
          displayName: pendingRejoin.current.displayName
        }));
      }
    };

    socket.onclose = () => {
      console.log('disconnected from websocket server');
      setIsConnected(false);
      setIsConnecting(false);
      // Don't clear roomCode - we'll try to reconnect and rejoin
    };

    socket.onerror = (error) => {
      console.error('websocket error:', error);
      setLastError('connection error');
      setIsConnecting(false);
    };

    socket.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error('failed to parse message:', event.data);
      }
    };
  }, []);

  useEffect(() => {
    connect();

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);

    // Reconnect when page becomes visible (handles mobile tab switching/app backgrounding)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('page became visible, checking connection...');
        if (ws.current?.readyState !== WebSocket.OPEN) {
          console.log('connection lost, reconnecting...');
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      ws.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      setLastError('not connected to server');
    }
  }, []);

  const handleMessage = (message: ServerMessage) => {
    switch (message.type) {
      case 'room_joined':
        setRoomCode(message.roomCode);
        setLastError(null);
        break;
      case 'search_results':
        setSearchResults(message.results);
        break;
      case 'song_added_success':
        console.log('song added successfully');
        break;
      case 'queue_update':
        setQueue(message.queue);
        setNowPlaying(message.nowPlaying);
        break;
      case 'error':
        setLastError(message.message.toLowerCase());
        break;
      case 'room_closed':
        setRoomCode(null);
        setLastError(`room closed: ${message.reason.toLowerCase()}`);
        break;
      case 'heartbeat_ack':
        break;
    }
  };

  const joinRoom = (code: string, name?: string) => {
    if (name) setDisplayName(name);
    // Store for reconnection
    pendingRejoin.current = { roomCode: code, displayName: name };
    sendMessage({
      type: 'join_room',
      roomCode: code,
      displayName: name
    });
  };

  const searchSongs = (query: string) => {
    sendMessage({ type: 'search_songs', query });
  };

  const addSong = (song: SearchResult, submittedBy?: string) => {
    sendMessage({
      type: 'add_song',
      videoId: song.videoId,
      title: song.title,
      artist: song.artist,
      submittedBy: submittedBy || displayName || undefined
    });
  };

  const clearSearchResults = () => {
    setSearchResults([]);
  };
  
  const leaveRoom = () => {
    pendingRejoin.current = null;
    setRoomCode(null);
    setDisplayName(null);
    setSearchResults([]);
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isConnecting,
        roomCode,
        displayName,
        searchResults,
        queue,
        nowPlaying,
        lastError,
        joinRoom,
        searchSongs,
        addSong,
        clearSearchResults,
        leaveRoom
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
