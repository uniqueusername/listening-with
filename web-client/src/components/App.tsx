import React from 'react';
import { WebSocketProvider, useWebSocket } from './WebSocketProvider';
import JoinRoom from './JoinRoom';
import Room from './Room';

// Parse room code from URL path (/join/ABCD) or query param (?code=ABCD)
function getRoomCodeFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // Check path first (e.g., /join/ABCD)
  const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z]{4})$/);
  if (pathMatch) return pathMatch[1].toUpperCase();

  // Check query param (e.g., ?code=ABCD)
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code && /^[A-Za-z]{4}$/.test(code)) return code.toUpperCase();

  return undefined;
}

const AppContent: React.FC = () => {
  const { roomCode } = useWebSocket();
  const initialRoomCode = getRoomCodeFromUrl();

  return (
    <>
      {roomCode ? <Room /> : <JoinRoom initialRoomCode={initialRoomCode} />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
};

export default App;
