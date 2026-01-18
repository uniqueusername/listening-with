# listening-with server

websocket server for coordinating rooms, song search, and queue management between host and clients.

## setup

install dependencies:

```bash
bun install
```

## run

start the server:

```bash
bun run index.ts
```

the server will start on `ws://localhost:2946/ws` by default.

## environment variables

- `PORT` - server port (default: 2946)
- `BASE_URL` - base url for qr code generation (default: http://localhost:3001)

## websocket protocol

**important**: room codes are case-insensitive. "wxyz", "WXYZ", and "WxYz" all refer to the same room.

### host messages

**create room**
```json
{
  "type": "create_room"
}
```

response:
```json
{
  "type": "room_created",
  "code": "WXYZ",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

**receive notifications**
- `client_joined` - when a client joins
- `client_left` - when a client leaves
- `song_added` - when a client adds a song to the queue
- `room_closed` - when the room is closed

### client messages

**join room**
```json
{
  "type": "join_room",
  "roomCode": "WXYZ",
  "displayName": "alice" // optional
}
```

response:
```json
{
  "type": "room_joined",
  "roomCode": "WXYZ"
}
```

notes:
- room code is the only authentication required
- qr code and manual entry use the same mechanism (just the room code)
- qr code format: `{BASE_URL}/join/{CODE}` (e.g., `http://localhost:3001/join/WXYZ`)

**search songs**
```json
{
  "type": "search_songs",
  "query": "never gonna give you up"
}
```

response:
```json
{
  "type": "search_results",
  "results": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "never gonna give you up",
      "artist": "rick astley",
      "duration": "3:33",
      "thumbnailUrl": "https://..."
    }
  ]
}
```

**add song to queue**
```json
{
  "type": "add_song",
  "videoId": "dQw4w9WgXcQ",
  "title": "never gonna give you up",
  "artist": "rick astley",
  "submittedBy": "alice" // optional
}
```

response:
```json
{
  "type": "song_added_success"
}
```

**heartbeat**
```json
{
  "type": "heartbeat"
}
```

response:
```json
{
  "type": "heartbeat_ack"
}
```

### error responses

```json
{
  "type": "error",
  "message": "error description"
}
```

## testing

### quick test

run the simple test client:

```bash
bun run test-client.ts
```

this will test room creation and song search functionality.

### comprehensive test suite

run the full test suite:

```bash
bun run test-full.ts
```

this tests:
- health endpoint
- room creation
- client joining
- song search
- song submission
- heartbeat
- multiple clients
- error handling
- case-insensitive room codes

### interactive browser test

open `test.html` in a browser for manual testing:

```bash
open test.html
# or just double-click the file
```

this provides a gui to:
- connect/disconnect from server
- create rooms as a host
- join rooms as a client
- search songs
- add songs to queue
- view all websocket messages
- see qr codes

### manual websocket testing

if you have `wscat` installed:

```bash
# install wscat if needed
npm install -g wscat

# connect to server
wscat -c ws://localhost:2946/ws

# then send json messages:
{"type":"create_room"}
{"type":"search_songs","query":"test"}
```

## room lifecycle

- rooms are created when a host connects and sends `create_room`
- rooms close when the host disconnects
- rooms automatically expire after 5 minutes of inactivity
- heartbeat messages keep the room active

## architecture

- `index.ts` - main server entry point
- `room-manager.ts` - room creation, joining, and lifecycle management
- `message-handler.ts` - websocket message routing
- `ytmusic.ts` - youtube music search integration
- `test-client.ts` - simple test client for validation
