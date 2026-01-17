## description
*listening-with* is an application that enables functionality similar to spotify's "jams" for youtube music users.

## design
*listening-with* is a two-part hybrid mobile and web application consisting of a server, an android host app, and a web-based client.

### platform
the host app is android-only (no ios support). clients access the application via web browser and do not need to install anything.

### server
the *listening-with* server will be a bun-powered server hosted on a vps that coordinates connections between host and clients using **websockets** for real-time communication.

a host app will connect to the server via websocket, and the server will open a "room" with a unique short code (e.g., 4-character alphanumeric like "WXYZ"). rooms can accommodate one host and several clients.

#### room security
clients join rooms using one of two methods:
- **qr code** (primary): host app displays a qr code containing the room url with an embedded auth token. clients scan and are taken directly to the room, authenticated.
- **room code** (fallback): clients can manually enter the short room code and a pin/password for situations where qr scanning isn't practical.

*future enhancement*: nfc support via host card emulation (hce), allowing clients to tap phones to join. deferred post-mvp due to implementation complexity.

#### room lifecycle
rooms close automatically when the server doesn't receive any communication from the host app for a configured timeout period. the timeout should be long enough to tolerate temporary connection losses.

#### client identity
clients may optionally provide a display name when joining. if provided, the name is attached to songs they submit. if left blank, submissions are anonymous.

### song search
the server will use **`ytmusic-api`** (node.js) to search youtube music's catalog. this library wraps youtube music's internal api and provides search functionality that returns song ids compatible with playback intents.

*note*: this is an unofficial library and could break if youtube changes their internal api. alternatives include `ytmusicapi` (python, more mature) or direct youtube data api calls.

### host app
the host app is a native android application. a "host" user's phone will have youtube music installed alongside the *listening-with* host application.

#### playback detection
the host app uses android's **MediaSessionManager** api to observe youtube music's playback state:
- currently playing song metadata (title, artist, duration)
- playback state (playing, paused, stopped)
- playback position

when the host app detects that a song has ended (playback stops or position reaches track duration), it triggers the next song from the queue.

#### playback control
the host app plays songs on youtube music using **intents/deep links**:
- opens urls like `https://music.youtube.com/watch?v=VIDEO_ID`
- simple, no special permissions required, reliable

*limitation*: intents can only "play this song" - they cannot add to youtube music's native queue. therefore, *listening-with* maintains its own queue.

#### queue management
the host app maintains its own fifo queue, independent from youtube music's queue. when a song ends, the host app:
1. pulls the oldest song from the *listening-with* queue
2. plays that song via intent
3. notifies the server of the queue change

##### alternative queue design
adding songs directly to youtube music's native queue would be cleaner but isn't possible non-invasively - youtube music does not expose queue management apis. accessibility services could theoretically automate the ui, but this is a more complex approach we are deferring for post-mvp. 

### client app
the client app is a **web frontend** accessed via browser - no app installation required. clients connect to the server via websocket for real-time updates.

once in the room, clients can:
- search for songs (search handled server-side via `ytmusic-api`)
- submit songs to the queue

*mvp scope*: clients can only submit songs. viewing the queue, seeing what's currently playing, and other features are deferred post-mvp.

## mvp scope
the mvp includes:
- server with websocket support and room management
- host android app with MediaSessionManager integration and intent-based playback
- web client for searching and submitting songs
- qr code + room code for joining
- optional display names

deferred post-mvp:
- queue visibility for clients
- host queue management (skip, remove, reorder)
- nfc room joining
- rate limiting
- ios support

## open questions / spike needed
before full implementation, a spike is needed to validate:
1. can we reliably play a specific song on youtube music via intent?
2. can we observe youtube music's media session via MediaSessionManager?
3. can we reliably detect when a song ends?
