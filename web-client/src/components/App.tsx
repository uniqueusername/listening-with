import React from 'react';
import { WebSocketProvider, useWebSocket } from './WebSocketProvider';
import JoinRoom from './JoinRoom';
import Room from './Room';

interface AppContentProps {
  initialRoomCode?: string;
}

const AppContent: React.FC<AppContentProps> = ({ initialRoomCode }) => {
  const { roomCode } = useWebSocket();

  return (
    <>
      {roomCode ? <Room /> : <JoinRoom initialRoomCode={initialRoomCode} />}
    </>
  );
};

interface AppProps {
  initialRoomCode?: string;
}

const App: React.FC<AppProps> = ({ initialRoomCode }) => {
  return (
    <WebSocketProvider>
      <AppContent initialRoomCode={initialRoomCode} />
    </WebSocketProvider>
  );
};

export default App;
