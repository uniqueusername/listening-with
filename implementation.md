# spike app implementation

## context

this spike app was created to validate the core technical assumptions for the listening-with project before full implementation. listening-with is a collaborative music listening application (similar to spotify's "jams") for youtube music users, consisting of an android host app, a web-based client, and a websocket server.

## design decisions from discussion

### architecture decisions

**platform**: android-only for host app (no ios). clients use web browsers (no app installation required).

**communication protocol**: websockets for real-time bidirectional communication between server, host, and clients. initially considered http requests, but websockets provide better ux for real-time updates (queue changes, currently playing, etc.).

**song search**: using `ytmusic-api` (node.js) on the server side. alternatives considered:
- `ytmusicapi` (python) - more mature but requires python sidecar, unnecessary complexity
- youtube data api (official) - missing ytm-specific features and metadata
- decision: `ytmusic-api` keeps stack simple (all javascript/typescript) and provides necessary search functionality

**youtube music integration**: mediasessionmanager + intents approach
- **playback detection**: mediasessionmanager api to observe ytm's playback state, metadata, and position
- **playback control**: intents/deep links (`https://music.youtube.com/watch?v=VIDEO_ID`)
- **queue management**: custom fifo queue in host app (ytm doesn't expose queue apis)

**alternatives rejected**:
- accessibility services: fragile, battery-intensive, heavily scrutinized by google play, requires special permissions
- adding to ytm's native queue: not possible - ytm doesn't expose queue management apis
- decision: maintain separate listening-with queue, trigger songs one-at-a-time via intent

**room security**:
- primary: qr code containing room url + auth token (instant join, no typing)
- fallback: short room code (4-char like "WXYZ") + pin/password for manual entry
- future enhancement (deferred): nfc via host card emulation (tap-to-join)

**room lifecycle**: rooms close after timeout period when no communication from host. timeout should be long enough to tolerate temporary connection losses.

**client identity**: optional display names. clients can provide name when joining (attached to their song submissions) or remain anonymous.

### mvp scope

included in mvp:
- server with websocket support and room management
- host android app with mediasessionmanager integration and intent-based playback
- web client for searching and submitting songs
- qr code + room code for joining
- optional display names

deferred post-mvp:
- queue visibility for clients (currently clients can only submit, not view)
- host queue management (skip, remove, reorder)
- nfc room joining
- rate limiting
- ios support

## what this spike validates

the spike app answers three critical questions:

1. **can we reliably play a specific song on youtube music via intent?**
   - validates that intents work consistently
   - tests the url format and package targeting

2. **can we observe youtube music's media session via mediasessionmanager?**
   - validates we can access metadata (title, artist, duration)
   - validates we can read playback state (playing/paused/stopped)
   - validates we can read playback position

3. **can we reliably detect when a song ends?**
   - validates we can identify song transitions
   - tests position-based detection (position >= duration - 1000ms)
   - tests state-change detection (stopped/paused at end of track)

## implementation details

### permissions

the app requires notification access permission to use `mediasessionmanager.getactivesessions()`. this is granted via:
- settings > apps > listening-with spike > notifications > notification access
- or: settings > security & privacy > notification access

without this permission, the app cannot observe media sessions from other apps.

### components

#### mainactivity.kt

the main activity implements:

1. **mediasessionmanager setup**:
   - gets system service: `getSystemService(MEDIA_SESSION_SERVICE)`
   - enumerates active sessions via `getActiveSessions()`
   - filters for youtube music: `packageName == "com.google.android.apps.youtube.music"`
   - registers callback on the ytm controller

2. **real-time playback monitoring**:
   - handler posts update runnable every 500ms
   - reads metadata: `controller.metadata.getString("android.media.metadata.TITLE")`, etc.
   - reads playback state: `controller.playbackState`
   - reads position: `playbackState.position`

3. **song end detection** (two approaches):
   - **position-based**: checks if `position >= duration - 1000` (within 1 second of end)
   - **state-based**: monitors state changes to stopped/paused and checks position
   - both approaches log "song ended" when detected

4. **intent-based playback**:
   - creates intent with `ACTION_VIEW`
   - sets data uri: `Uri.parse("https://music.youtube.com/watch?v=VIDEO_ID")`
   - targets ytm package: `setPackage("com.google.android.apps.youtube.music")`
   - starts activity

5. **ui updates**:
   - displays current track info (title, artist)
   - displays playback state (playing, paused, stopped, etc.)
   - displays position and duration (formatted as mm:ss)
   - logs all events with timestamps

#### notificationlistener.kt

a minimal `NotificationListenerService` implementation. this service doesn't need to do anything - it just needs to exist and be declared in the manifest. android requires an app to have a notificationlistenerservice to use `getActiveSessions()`.

#### layout (activity_main.xml)

simple constraint layout with:
- title text
- status text (connection state)
- track info text (title/artist)
- position text (current/duration)
- playback state text
- "play test song" button (triggers test intent)
- log text view (scrollable, monospace, shows all events)

### key technical insights

**mediasessionmanager access pattern**:
```kotlin
val mediaSessionManager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
val controllers = mediaSessionManager.getActiveSessions(
    ComponentName(this, NotificationListener::class.java)
)
```

the `ComponentName` parameter must reference a notificationlistenerservice declared in your manifest.

**metadata keys**:
- `"android.media.metadata.TITLE"` - song title
- `"android.media.metadata.ARTIST"` - artist name
- `"android.media.metadata.DURATION"` - track duration in milliseconds

**playback states**:
- `PlaybackState.STATE_PLAYING` - actively playing
- `PlaybackState.STATE_PAUSED` - paused
- `PlaybackState.STATE_STOPPED` - stopped (often seen at song end)
- `PlaybackState.STATE_BUFFERING` - loading
- others: connecting, skipping_to_next, skipping_to_previous

**intent url format**:
```
https://music.youtube.com/watch?v=VIDEO_ID
```
where `VIDEO_ID` is the youtube video id (e.g., `dQw4w9WgXcQ` for never gonna give you up).

### limitations discovered

**timing challenges**:
- song end detection isn't instant - there's inherent latency in position updates
- position updates happen ~every 500ms (our polling rate)
- ytm may not report position exactly at duration, might stop slightly before

**state ambiguity**:
- paused and stopped states both occur at song end
- need to check position to differentiate "user paused mid-song" from "song ended"

**metadata timing**:
- metadata change callback fires when tracks change
- but there's a race: new metadata may arrive before or after playback state change
- need to handle both orderings gracefully

## data needed from spike testing

when testing the spike app, gather:

1. **intent reliability**:
   - does "play test song" consistently open ytm and play the song?
   - any errors or failures?
   - does it work when ytm is already open? when closed?

2. **media session connection**:
   - does the app consistently find ytm's media session?
   - does connection persist across app switches?
   - what happens if ytm is closed and reopened?

3. **metadata accuracy**:
   - is title/artist/duration always present?
   - are there songs with missing metadata?
   - is duration always accurate?

4. **playback position tracking**:
   - does position update smoothly?
   - is position accurate (compare to ytm's own position display)?
   - does position reach duration or stop slightly before?

5. **song end detection reliability**:
   - does "song end detected" log consistently when songs end?
   - any false positives (detected when song didn't end)?
   - any false negatives (missed when song did end)?
   - timing: how long after song ends until detection?

6. **edge cases**:
   - what happens when user skips to next song manually?
   - what happens when user seeks within a song?
   - what happens during buffering/loading?
   - what happens if connection drops?

## next steps after validation

once spike testing confirms the three core assumptions work:

### 1. design the websocket protocol

define message formats for:
- host creates room → server responds with room code and token
- client joins room (with code + pin or token from qr)
- client submits song (with search query or video id)
- server forwards song to host's queue
- host notifies server when song starts/ends
- server broadcasts queue updates to clients (if implementing visibility)

example message structure:
```json
{
  "type": "create_room",
  "hostId": "uuid"
}

{
  "type": "room_created",
  "roomCode": "ABCD",
  "roomToken": "secret-token-123",
  "qrCodeUrl": "https://listening-with.example.com/join/ABCD?token=secret-token-123"
}

{
  "type": "add_song",
  "videoId": "dQw4w9WgXcQ",
  "submittedBy": "alice"
}
```

### 2. implement the bun server

- websocket server using bun's built-in ws support
- room management (create, join, close on timeout)
- integrate `ytmusic-api` for song search
- qr code generation (can use a library like `qrcode` npm package)
- short code generation (4-character alphanumeric)
- authentication (tokens for qr codes, pins for manual join)

### 3. expand the host android app

build on the spike app:
- add websocket client (okhttp or similar)
- implement queue data structure (fifo list of songs)
- connect mediasessionmanager to queue logic (on song end, pull next from queue)
- add room creation ui (displays qr code and room code)
- add queue visualization (optional for mvp)

### 4. build the web client

- html/css/js (or react/vue/svelte if preferred)
- websocket connection to server
- room join ui (qr scan via camera api, or manual code entry)
- song search ui (text input → server search → results list)
- submit button (adds song to queue)

### 5. integration testing

test the full flow:
1. host creates room on android app
2. client scans qr code on phone → joins room in browser
3. client searches for song → submits to queue
4. host app receives song via websocket → adds to local queue
5. when current song ends, host app plays next song from queue
6. verify song plays on ytm
7. repeat

### 6. refinements based on real-world usage

- tune timeout values (room lifecycle, connection retry)
- improve song end detection if needed (adjust threshold, add hysteresis)
- add error handling (connection drops, ytm not installed, etc.)
- polish ui/ux

## technical reference

### android apis used

- `MediaSessionManager` - access active media sessions
- `MediaController` - control and observe a specific media session
- `MediaController.Callback` - receive playback state and metadata changes
- `PlaybackState` - playback state information
- `MediaMetadata` - track metadata
- `NotificationListenerService` - required for media session access
- `Intent` with `ACTION_VIEW` - trigger playback

### minimum sdk version

api level 26 (android 8.0) - when mediasessionmanager was introduced.

### dependencies

- androidx.core:core-ktx
- androidx.appcompat:appcompat
- com.google.android.material:material
- androidx.constraintlayout:constraintlayout

### build tools

- android gradle plugin 9.0.0
- kotlin 2.3.0
- gradle 8.7

## troubleshooting common issues

**"youtube music not found"**:
- ytm must be installed and actively playing
- try starting a song in ytm before opening spike app
- check notification access permission is granted

**"no controller connected"**:
- restart spike app after granting notification access
- check that notificationlistener service is declared in manifest

**position not updating**:
- check handler is posting runnable correctly
- verify controller is not null
- check playback state is "playing"

**intent doesn't open ytm**:
- verify ytm package name: `com.google.android.apps.youtube.music`
- check intent action and data uri format
- ensure ytm is installed on device

**song end not detected**:
- check duration metadata is present and non-zero
- verify position is updating
- try adjusting threshold (currently 1000ms before duration)
- check logs for state changes

## project structure note

this spike app lives in `spike-app/` subdirectory of the main listening-with repository. it's a standalone android project with its own gradle config and .gitignore. once validation is complete, the core logic (mediasessionmanager + intent code) will be extracted and adapted for the full host app, which may live in a different directory (e.g., `host-app/` or `android/`).

## additional context

**why not use youtube music's api?**
- youtube music doesn't have an official public api for playback control
- youtube data api (v3) covers youtube video content but lacks ytm-specific features
- unofficial libraries reverse-engineer ytm's internal web api for search/browse
- mediasessionmanager is an official android api, safe to use

**why not use spotify's approach?**
- spotify provides an official sdk for remote control
- youtube music does not provide equivalent functionality
- we're limited to what android's system apis expose

**alternative approaches explored but deferred**:
- accessibility services: too invasive, requires special permissions, fragile
- root/adb access (shizuku): too niche, requires user technical setup
- youtube iframe api: web-based, doesn't integrate with ytm app

## spike test results

the spike app was tested on a real android device with youtube music installed. here are the findings:

### 1. intent reliability

**result: ✓ works perfectly**

- "play test song" button consistently opens ytm and plays the specified song
- works whether ytm is already open or closed
- no errors or failures observed
- ytm launches, plays the song, and the spike app immediately picks up the new media session

### 2. media session connection

**result: ✓ works reliably with one caveat**

- app consistently finds ytm's media session when ytm is playing
- connection persists across app switches (switching between spike app and ytm works fine)
- closing and reopening the spike app successfully reconnects to ytm's session
- **caveat**: at one point during testing, the app lost the youtube session and couldn't recover until the spike app was uninstalled and reinstalled. root cause unknown - possible explanations:
  - android killed the notificationlistener service (low memory?)
  - ytm restarted and we didn't re-register the callback
  - some uncaught exception broke the connection

**implication**: the full app needs automatic reconnection logic and better error handling

### 3. metadata accuracy

**result: ✓ highly accurate**

- title, artist, and duration always present and correct
- no songs with missing metadata encountered
- duration is accurate
- when no song is playing:
  - displays "no track playing"
  - playback state shows "unknown"
  - position shows last known duration from previous song
  - status still reads "listening to youtube music" (connection persists even when nothing playing)

### 4. playback position tracking

**result: ✓ accurate**

- position updates smoothly every 500ms (our polling rate)
- position is accurate (matches ytm's position display within imperceptible margin)
- position reaches duration before stopping (within ~1 second threshold)
- no noticeable lag - any difference between spike app and ytm's own display is too small to measure visually

### 5. song end detection reliability

**result: ✓ works for natural song ends, ✗ doesn't detect manual skips**

- when a song ends naturally (plays to completion), "song end detected" logs consistently
- no false positives observed (never detected end when song didn't end)
- no false negatives observed (always detected when song naturally ended)
- timing: detection happens within ~500ms of song ending (based on our polling rate)

**critical gap**: when user manually skips to next song (or hits "play test song" while a song is playing), we do NOT get a "song end detected" signal. this makes sense - the position-based detection only triggers when position >= duration, but manual skips change the track before reaching the end.

**implication**: for the full app, we need to detect track changes via `onMetadataChanged()` callback in addition to position-based detection.

### 6. edge cases

**manual skip/next**:
- ✓ metadata updates correctly when user skips to next song
- ✓ position resets to new song's position
- ✗ no "song end detected" signal (see above)

**seeking within a song**:
- ✓ position updates correctly
- ✓ no false "song end detected" signals

**buffering/loading**:
- ✓ playback state changes to "buffering"
- ✓ metadata remains accurate
- ✓ no crashes or connection issues

**connection drops**:
- ✗ one instance of connection loss that required app reinstall (unable to reproduce)

## lessons learned

### for the full app: song transition detection

the spike revealed that we need **two** mechanisms for detecting when to play the next song:

#### 1. position-based detection (natural song end)
```kotlin
// current approach - works for songs that play to completion
if (position >= duration - 1000 && state == STOPPED/PAUSED) {
    // song ended naturally
    playNextFromQueue()
}
```

#### 2. metadata-based detection (manual skip)
```kotlin
onMetadataChanged(newMetadata) {
    if (newMetadata != previousMetadata) {
        // track changed (user skipped or ytm advanced to next)
        playNextFromQueue()
    }
}
```

**combined logic**:
```kotlin
private var lastTrackId: String? = null

onMetadataChanged(metadata) {
    val currentTrackId = metadata.getString("android.media.metadata.MEDIA_ID")

    if (currentTrackId != lastTrackId && lastTrackId != null) {
        // track changed - play next from our queue
        playNextFromQueue()
    }

    lastTrackId = currentTrackId
}
```

this ensures we trigger the next song whether the user lets it play naturally OR manually skips.

### for the full app: connection resilience

the connection loss issue (requiring reinstall) suggests we need:

#### 1. automatic reconnection attempts
```kotlin
private fun retryConnection() {
    handler.postDelayed({
        if (currentController == null) {
            findYouTubeMusicController()
            retryConnection() // keep trying
        }
    }, 5000) // retry every 5 seconds
}
```

#### 2. lifecycle-based reconnection
```kotlin
override fun onResume() {
    super.onResume()
    // always re-check connection when app comes to foreground
    if (currentController == null) {
        findYouTubeMusicController()
    }
}
```

#### 3. manual retry mechanism
- add a "retry connection" button in the ui
- allows user to manually trigger reconnection without reinstalling
- useful for debugging and as a fallback

#### 4. better error logging
- log when connection is lost (controller becomes null)
- log when callbacks stop firing
- log exceptions from mediasessionmanager
- helps diagnose what caused the connection loss

### for the full app: queue management

when a song transition is detected (via either method above), the full app should:

1. check if our custom queue has songs
2. if yes: pull next song, trigger via intent
3. if no: do nothing (let ytm play its own queue or stop)

this way, the listening-with queue takes priority when it has songs, but doesn't interfere when it's empty.

### position vs metadata for song end detection

**why we need both**:

- **position-based**: catches natural song ends when ytm doesn't advance to next track (queue empty, repeat off)
- **metadata-based**: catches manual skips, ytm auto-advancing to next in its own queue, and any other track changes

**edge case to handle**: when we trigger playback via intent, `onMetadataChanged()` will fire. we need to avoid treating our own triggered songs as "user skipped". solution: track whether we just triggered playback and ignore the first metadata change after our trigger.

```kotlin
private var justTriggeredPlayback = false

fun playNextFromQueue() {
    val nextSong = queue.poll()
    if (nextSong != null) {
        justTriggeredPlayback = true
        playYouTubeMusicSong(nextSong.videoId)
    }
}

onMetadataChanged(metadata) {
    if (justTriggeredPlayback) {
        justTriggeredPlayback = false
        return // ignore this change, it's from our own trigger
    }

    // otherwise, user skipped or ytm advanced - play next from queue
    playNextFromQueue()
}
```

## conclusion

the spike successfully validates all three core technical assumptions:

1. ✓ **intent-based playback works reliably** - we can trigger ytm to play specific songs
2. ✓ **mediasessionmanager can observe ytm** - we can read metadata, state, and position
3. ✓ **song transitions are detectable** - via position (natural end) and metadata changes (manual skip)

with these validations confirmed, we have a clear path forward to build the full application. the key learnings about connection resilience and dual detection mechanisms (position + metadata) will inform the production implementation.

**next step**: proceed with building the websocket server, expanding the host android app with queue management and websocket integration, and creating the web client.
