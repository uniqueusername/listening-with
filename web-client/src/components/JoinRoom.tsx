import React, { useState } from 'react';
import { useWebSocket } from './WebSocketProvider';
import QRScanner from './QRScanner';
import { QrCode, Keyboard, User } from 'lucide-react';
import { clsx } from 'clsx';

interface JoinRoomProps {
  initialRoomCode?: string;
}

const JoinRoom: React.FC<JoinRoomProps> = ({ initialRoomCode }) => {
  const { joinRoom, lastError, isConnecting } = useWebSocket();
  const [mode, setMode] = useState<'scan' | 'manual'>(initialRoomCode ? 'manual' : 'scan');
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode?.toUpperCase() || '');
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = (decodedText: string) => {
    try {
      const url = new URL(decodedText);
      // Expected format: BASE_URL/join/ABCD
      const pathParts = url.pathname.split('/');
      let code = pathParts[pathParts.length - 1];
      if (code.length !== 4) {
          code = pathParts[pathParts.length - 2];
      }

      if (code && code.length === 4) {
        setIsScanning(false);
        joinRoom(code.toUpperCase(), displayName || undefined);
      } else {
        console.error('invalid qr code format');
      }
    } catch (e) {
      // If it's not a URL, maybe it's just the code?
      if (decodedText.length === 4) {
          setIsScanning(false);
          joinRoom(decodedText.toUpperCase(), displayName || undefined);
      } else {
          console.error('failed to parse qr code:', e);
      }
    }
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length === 4) {
      joinRoom(roomCode.toUpperCase(), displayName || undefined);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">join a room</h1>
      
      {/* Display Name Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">display name (optional)</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="guest"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={clsx(
            "flex-1 py-2 text-center font-medium text-sm focus:outline-none",
            mode === 'scan' ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setMode('scan')}
        >
          <div className="flex items-center justify-center gap-2">
            <QrCode className="w-4 h-4" /> scan qr
          </div>
        </button>
        <button
          className={clsx(
            "flex-1 py-2 text-center font-medium text-sm focus:outline-none",
            mode === 'manual' ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setMode('manual')}
        >
          <div className="flex items-center justify-center gap-2">
            <Keyboard className="w-4 h-4" /> enter code
          </div>
        </button>
      </div>

      {/* Content */}
      {mode === 'scan' ? (
        <div className="text-center">
          {!isScanning ? (
             <button
             onClick={() => setIsScanning(true)}
             className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
           >
             start camera
           </button>
          ) : (
            <div className="relative">
                <QRScanner onScanSuccess={handleScan} />
                <button 
                    onClick={() => setIsScanning(false)}
                    className="mt-4 text-sm text-red-600 underline"
                >
                    stop camera
                </button>
            </div>
          )}
          <p className="text-gray-500 text-sm mt-4">scan the code displayed on the host device.</p>
        </div>
      ) : (
        <form onSubmit={handleManualJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">room code</label>
            <input
              type="text"
              maxLength={4}
              className="block w-full px-3 py-4 border border-gray-300 rounded-xl text-center text-3xl font-bold tracking-widest uppercase focus:ring-blue-500 focus:border-blue-500"
              placeholder="WXYZ"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
          </div>
          <button
            type="submit"
            disabled={roomCode.length !== 4}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            join room
          </button>
        </form>
      )}

      {lastError && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
          {lastError}
        </div>
      )}
      
      {isConnecting && (
         <div className="mt-4 text-center text-gray-500 text-sm">
             connecting to server...
         </div>
      )}
    </div>
  );
};

export default JoinRoom;
