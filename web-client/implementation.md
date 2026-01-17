# web client implementation

## overview
the web client is built with **astro**, **react**, and **tailwind css**. it serves as the user interface for "guests" to join a room, search for songs, and submit them to the queue.

**status**: ✅ complete and functional

## tech stack
- **framework**: astro (static site generation + client-side islands)
- **ui library**: react 19
- **styling**: tailwind css 4
- **icons**: lucide-react
- **qr scanning**: html5-qrcode
- **websocket**: native browser websocket api

## architecture

### core components

1.  **`WebSocketProvider.tsx`**
    - manages the global websocket connection.
    - handles reconnection logic and heartbeats (every 30s).
    - exposes state (`isConnected`, `roomCode`, `searchResults`) and actions (`joinRoom`, `addSong`) via context.
    - **dynamic connection**: automatically connects to `ws://<current-hostname>:3000/ws`, allowing local network testing without config changes.

2.  **`App.tsx`**
    - main "router" component.
    - displays `<JoinRoom />` if not connected to a room.
    - displays `<Room />` if connected.

3.  **`JoinRoom.tsx`**
    - **qr scan mode**: uses camera to scan host code.
    - **manual mode**: simple 4-character code input.
    - **simplified auth**: removed pins and tokens; only the room code is required.

4.  **`Room.tsx`**
    - **search**: text input that sends `search_songs` to server.
    - **results**: displays search results with thumbnails and an "add" button.
    - **feedback**: visual confirmation when a song is added.

### file structure
```
web-client/
├── src/
│   ├── components/
│   │   ├── App.tsx              # main view switcher
│   │   ├── JoinRoom.tsx         # join ui (qr + manual)
│   │   ├── Room.tsx             # main room interface
│   │   ├── QRScanner.tsx        # camera wrapper
│   │   └── WebSocketProvider.tsx # logic & state
│   ├── lib/
│   │   └── types.ts             # shared typescript interfaces
│   ├── pages/
│   │   └── index.astro          # entry point
│   └── styles/
│       └── global.css           # tailwind imports
└── package.json
```

## protocol implementation

the client implements the simplified websocket protocol:

-   **join**: sends `{ type: 'join_room', roomCode: 'ABCD', displayName: 'Optional' }`.
-   **search**: sends `{ type: 'search_songs', query: '...' }`.
-   **add**: sends `{ type: 'add_song', videoId: '...', ... }`.
-   **heartbeat**: sends `{ type: 'heartbeat' }` to keep connection alive.

**key deviation**: original design included PIN/Token auth. this was removed in favor of a simpler "code-only" access model for the MVP.

## usage

### development
```bash
# install dependencies
npm install

# start dev server (exposed to network)
npm run dev
```
access at `http://localhost:4321` or your local IP (e.g., `http://192.168.1.5:4321`).

### building
```bash
npm run build
```
outputs static files to `dist/`.

## future improvements
-   **queue visibility**: currently clients can *add* songs but cannot *see* the queue.
-   **error handling**: better UI for connection drops or server errors.
-   **pwa support**: add manifest.json for "add to home screen" functionality.
