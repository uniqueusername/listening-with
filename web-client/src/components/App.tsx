import React from 'react';
import { WebSocketProvider, useWebSocket } from './WebSocketProvider';
import JoinRoom from './JoinRoom';
import Room from './Room';

const AppContent: React.FC = () => {
  const { roomCode } = useWebSocket();

  return (
    <>
      {roomCode ? <Room /> : <JoinRoom />}
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
