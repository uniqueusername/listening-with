# host app design document

## overview

the host app is a native android application that enables the "listening-with" experience. the host's phone runs this app alongside youtube music. the app creates a room that clients can join via the web client, maintains a queue of songs submitted by clients, and automatically plays songs from the queue on youtube music when the current song ends.

## architecture

```
+------------------+       websocket       +------------------+
|                  | <------------------> |                  |
|    host app      |                       |     server       |
|    (android)     |                       |   (bun/ws)       |
|                  |                       |                  |
+------------------+                       +------------------+
        |                                          ^
        | MediaSessionManager                      |
        v                                          | websocket
+------------------+                       +------------------+
|                  |                       |                  |
|  youtube music   |                       |   web client     |
|     (ytm)        |                       |   (browser)      |
|                  |                       |                  |
+------------------+                       +------------------+
```

### data flow

1. host app connects to server via websocket
2. host sends `create_room` message
3. server creates room, returns room code + qr code data url
4. host displays qr code on screen
5. client scans qr or enters code, joins room via web client
6. client searches for songs, adds to queue
7. server forwards `song_added` to host with song details
8. host app adds song to local queue
9. when current song ends (detected via MediaSessionManager), host plays next from queue via intent
10. repeat until queue is empty

## architecture principles

### ui/logic separation

the ui layer must be completely decoupled from business logic. the goal is to allow the entire ui to be ripped out and replaced without touching any service, websocket, queue, or media code.

**layer structure:**
```
+-------------------+
|        UI         |  <- observes state, dispatches actions (easily replaceable)
+-------------------+
         |
         | StateFlow / callbacks
         v
+-------------------+
|    ViewModel      |  <- exposes state, handles ui actions, delegates to services
+-------------------+
         |
         v
+-------------------+
|     Services      |  <- ListeningService, WebSocketClient, MediaObserver, etc.
+-------------------+
```

**rules:**
1. **UI only observes and dispatches** - UI components observe state via `StateFlow` and dispatch actions via ViewModel methods. they never directly call services, parse messages, or contain business logic.

2. **ViewModel as the boundary** - all communication between UI and services goes through the ViewModel. the ViewModel exposes a single `UiState` data class that contains everything the UI needs to render.

3. **services are ui-agnostic** - services have no knowledge of android views, fragments, or compose. they expose their state via `StateFlow` or callbacks that the ViewModel consumes.

4. **no android view imports in services** - services should only import android framework classes they need (Context for intents, etc.), never UI classes.

**state exposure pattern:**
```kotlin
// in ViewModel
data class UiState(
    val screen: Screen,
    val roomCode: String?,
    val listenerCount: Int,
    val qrCodeBitmap: Bitmap?,
    val nowPlaying: QueuedSong?,
    val queue: List<QueuedSong>,
    val error: String?,
    val isConnecting: Boolean
)

sealed class Screen {
    object Idle : Screen()
    object Connecting : Screen()
    object RoomActive : Screen()
    object PermissionRequired : Screen()
}

class MainViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(UiState(...))
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    // actions the UI can trigger
    fun createRoom() { ... }
    fun endRoom() { ... }
    fun openSettings() { ... }
    fun retryConnection() { ... }
}
```

**ui implementation:**
```kotlin
// UI just observes and renders - no logic
@Composable
fun MainScreen(viewModel: MainViewModel) {
    val state by viewModel.uiState.collectAsState()

    when (state.screen) {
        Screen.Idle -> IdleScreen(onCreateRoom = viewModel::createRoom)
        Screen.RoomActive -> RoomScreen(
            roomCode = state.roomCode,
            listenerCount = state.listenerCount,
            qrCode = state.qrCodeBitmap,
            nowPlaying = state.nowPlaying,
            queue = state.queue,
            onEndRoom = viewModel::endRoom
        )
        // etc.
    }
}
```

**why this matters:**
- swap compose for xml views (or vice versa) by only changing the ui package
- replace the entire ui with a completely different design without touching services
- unit test all business logic without android ui dependencies
- ui tests can use fake viewmodels with controlled state

### file organization for replaceability

```
com.listeningwith.host/
├── MainActivity.kt              <- minimal, just hosts the UI
├── MainViewModel.kt             <- boundary between UI and services
├── ui/                          <- ENTIRE UI LIVES HERE (replaceable)
│   ├── theme/
│   │   └── Theme.kt
│   ├── screens/
│   │   ├── IdleScreen.kt
│   │   ├── RoomScreen.kt
│   │   └── PermissionScreen.kt
│   └── components/
│       ├── QrCodeImage.kt
│       ├── NowPlayingCard.kt
│       └── QueueList.kt
├── service/                     <- business logic (ui-agnostic)
│   ├── ListeningService.kt
│   └── NotificationListener.kt
├── websocket/
│   ├── WebSocketClient.kt
│   └── Messages.kt
├── media/
│   ├── MediaObserver.kt
│   └── PlaybackController.kt
└── queue/
    ├── QueueManager.kt
    └── QueuedSong.kt
```

to replace the ui: delete the `ui/` folder, create a new one, and have it observe `MainViewModel.uiState`. nothing else changes.

## components

### 1. foreground service: `ListeningService`

the core of the app runs as a foreground service to ensure reliable operation even when the app is backgrounded.

**responsibilities:**
- maintain websocket connection to server
- monitor youtube music via MediaSessionManager
- manage the song queue
- trigger playback via intents
- show persistent notification with current state

**lifecycle:**
- starts when user taps "create room"
- stops when user explicitly ends the session or room times out
- persists through app backgrounding

**notification:**
- persistent notification (required for foreground service)
- shows: "listening-with: room ABCD" and current song info
- actions: "end session" button

### 2. websocket client: `WebSocketClient`

handles all server communication using okhttp.

**connection management:**
- connect on service start
- automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- heartbeat every 30 seconds to keep connection alive and prevent room timeout

**message handling:**

outgoing messages (host -> server):
```kotlin
// create room
{ "type": "create_room" }

// heartbeat
{ "type": "heartbeat" }
```

incoming messages (server -> host):
```kotlin
// room created
{
  "type": "room_created",
  "code": "ABCD",
  "qrCodeDataUrl": "data:image/png;base64,..."
}

// client joined
{
  "type": "client_joined",
  "clientId": "uuid",
  "displayName": "alice",  // optional
  "clientCount": 3
}

// client left
{
  "type": "client_left",
  "clientId": "uuid",
  "clientCount": 2
}

// song added to queue
{
  "type": "song_added",
  "song": {
    "videoId": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "artist": "Rick Astley",
    "submittedBy": "alice"  // optional
  },
  "queueLength": 5
}

// heartbeat ack
{ "type": "heartbeat_ack" }

// room closed
{
  "type": "room_closed",
  "reason": "inactivity timeout"
}

// error
{
  "type": "error",
  "message": "failed to create room"
}
```

### 3. media session observer: `MediaObserver`

monitors youtube music's playback using MediaSessionManager.

**setup requirements:**
- `NotificationListenerService` must be declared in manifest
- user must grant notification access permission
- service component name passed to `getActiveSessions()`

**observation strategy:**
- poll playback state every 500ms via handler
- register `MediaController.Callback` for state/metadata changes
- filter sessions by package name: `com.google.android.apps.youtube.music`

**song transition detection:**

the spike revealed that we need TWO mechanisms:

1. **position-based detection** (natural song end):
```kotlin
if (position >= duration - 1000 &&
    (state == STOPPED || state == PAUSED)) {
    // song ended naturally
    playNextFromQueue()
}
```

2. **metadata-based detection** (manual skip or ytm auto-advance):
```kotlin
onMetadataChanged(metadata) {
    val currentTrackId = metadata.getString("android.media.metadata.MEDIA_ID")

    if (currentTrackId != lastTrackId && lastTrackId != null) {
        // track changed
        if (!justTriggeredPlayback) {
            playNextFromQueue()
        }
    }

    lastTrackId = currentTrackId
}
```

**avoiding loops:**
when we trigger playback via intent, `onMetadataChanged()` fires. we must NOT treat this as "user skipped" and trigger another song.

solution:
```kotlin
private var justTriggeredPlayback = false

fun playNextFromQueue() {
    val nextSong = queue.poll() ?: return
    justTriggeredPlayback = true
    playYouTubeMusicSong(nextSong.videoId)

    // reset flag after delay (metadata change should arrive within 2s)
    handler.postDelayed({ justTriggeredPlayback = false }, 2000)
}
```

### 4. queue manager: `QueueManager`

manages the local FIFO queue of songs.

**data structure:**
```kotlin
data class QueuedSong(
    val videoId: String,
    val title: String,
    val artist: String,
    val submittedBy: String?,
    val addedAt: Long = System.currentTimeMillis()
)

class QueueManager {
    private val queue = mutableListOf<QueuedSong>()

    fun add(song: QueuedSong)
    fun poll(): QueuedSong?  // removes and returns first
    fun peek(): QueuedSong?  // returns first without removing
    fun getAll(): List<QueuedSong>
    fun size(): Int
    fun isEmpty(): Boolean
    fun clear()
}
```

**queue behavior:**
- FIFO ordering (first submitted = first played)
- when `poll()` is called and queue has songs, return and remove first song
- when queue is empty, do nothing (let ytm continue with its own behavior)

### 5. playback controller: `PlaybackController`

triggers playback on youtube music via intents.

**intent format:**
```kotlin
fun playYouTubeMusicSong(videoId: String) {
    val intent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse("https://music.youtube.com/watch?v=$videoId")
        setPackage("com.google.android.apps.youtube.music")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}
```

**error handling:**
- catch `ActivityNotFoundException` if ytm not installed
- catch generic exceptions and log

### 6. main activity: `MainActivity`

the single activity with UI for room management.

**states:**
1. **idle** - no room active, show "create room" button
2. **connecting** - websocket connecting, show loading
3. **room active** - show qr code, room code, queue, current song
4. **error** - show error message with retry option

## screens and ui

### screen 1: idle state

```
+----------------------------------+
|                                  |
|        listening-with            |
|                                  |
|   [icon: music + people]         |
|                                  |
|   create a room for your         |
|   friends to add songs           |
|                                  |
|   +------------------------+     |
|   |    create room         |     |
|   +------------------------+     |
|                                  |
|   (notification access           |
|    required indicator if         |
|    permission not granted)       |
|                                  |
+----------------------------------+
```

**components:**
- app title/logo
- brief description text
- "create room" primary button
- notification permission status (if not granted, show warning and link to settings)

### screen 2: room active

```
+----------------------------------+
|  listening-with     [end room]   |
+----------------------------------+
|                                  |
|   room: ABCD                     |
|   3 listeners                    |
|                                  |
|   +------------------------+     |
|   |                        |     |
|   |      [QR CODE]         |     |
|   |                        |     |
|   +------------------------+     |
|                                  |
|   scan to join                   |
|                                  |
+----------------------------------+
|  now playing                     |
|  +----------------------------+  |
|  | [thumb] title              |  |
|  |         artist             |  |
|  |         submitted by alice |  |
|  +----------------------------+  |
+----------------------------------+
|  up next (3)                     |
|  +----------------------------+  |
|  | 1. song title - artist     |  |
|  |    submitted by bob        |  |
|  +----------------------------+  |
|  | 2. song title - artist     |  |
|  |    anonymous               |  |
|  +----------------------------+  |
|  | 3. song title - artist     |  |
|  |    submitted by charlie    |  |
|  +----------------------------+  |
+----------------------------------+
```

**components:**
- header: app name + "end room" button (top right)
- room info section: room code (large, prominent), listener count
- qr code: large, centered, with "scan to join" helper text
- now playing card: thumbnail (if available), title, artist, submitter
- queue list: scrollable list of upcoming songs with position numbers

**skipping songs:**
- no skip button in the app - host uses youtube music's native controls (in-app, notification, or media buttons) to skip
- the app detects the skip via `onMetadataChanged()` and automatically plays the next song from the queue
- this keeps the UI simple and leverages controls the host is already familiar with

**dynamic updates:**
- listener count updates on client join/leave
- queue list updates when songs added
- now playing updates when track changes

### screen 3: permission required

```
+----------------------------------+
|                                  |
|        listening-with            |
|                                  |
|   [icon: warning]                |
|                                  |
|   notification access            |
|   required                       |
|                                  |
|   this app needs notification    |
|   access to detect when songs    |
|   end on youtube music.          |
|                                  |
|   +------------------------+     |
|   |   open settings        |     |
|   +------------------------+     |
|                                  |
|   +------------------------+     |
|   |   check again          |     |
|   +------------------------+     |
|                                  |
+----------------------------------+
```

**shown when:**
- notification listener permission not granted
- user tries to create room without permission

## permissions

### required permissions

**1. INTERNET**
```xml
<uses-permission android:name="android.permission.INTERNET" />
```
for websocket communication with server.

**2. FOREGROUND_SERVICE**
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```
for running the listening service in the background.

**3. POST_NOTIFICATIONS (android 13+)**
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
for showing the foreground service notification.

### special permissions (granted via settings)

**notification listener access**

required for `MediaSessionManager.getActiveSessions()` to work.

the app must have a `NotificationListenerService` declared:
```xml
<service
    android:name=".NotificationListener"
    android:exported="true"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

the service itself can be minimal:
```kotlin
class NotificationListener : NotificationListenerService()
```

user must enable in: settings > apps > [app name] > notifications > notification access

**permission check:**
```kotlin
fun hasNotificationAccess(): Boolean {
    val enabledListeners = Settings.Secure.getString(
        contentResolver,
        "enabled_notification_listeners"
    )
    return enabledListeners?.contains(packageName) == true
}
```

## error handling

### connection errors

| error | handling |
|-------|----------|
| websocket connect failed | show error, retry with backoff |
| websocket disconnected | auto-reconnect with backoff |
| room creation failed | show error message, allow retry |
| room closed by server | show message, return to idle state |

### youtube music errors

| error | handling |
|-------|----------|
| ytm not installed | show error, link to play store |
| ytm not playing | show "start youtube music" prompt |
| media session lost | auto-retry connection, show warning |
| intent failed | log error, skip to next song |

### permission errors

| error | handling |
|-------|----------|
| notification access not granted | show permission screen, block room creation |
| notification permission (android 13+) not granted | request permission, show rationale |

## dependencies

```kotlin
// build.gradle.kts (app level)

android {
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
}

dependencies {
    // android core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // compose (ui layer - can be swapped for xml views if needed)
    implementation(platform("androidx.compose:compose-bom:2024.01.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // lifecycle + viewmodel (the boundary between ui and logic)
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

    // websocket
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // json parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // qr code display (decode base64 data url)
    // no additional library needed - use android's BitmapFactory

    // coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

**note on ui framework:** the examples use jetpack compose, but the architecture supports swapping to xml views. the key is keeping all ui code in `ui/` and having it only interact with `MainViewModel`.

## project structure

```
host-app/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/listeningwith/host/
│   │       │   ├── MainActivity.kt           <- minimal shell, hosts UI
│   │       │   ├── MainViewModel.kt          <- boundary between UI and logic
│   │       │   │
│   │       │   ├── ui/                       <- REPLACEABLE UI LAYER
│   │       │   │   ├── theme/
│   │       │   │   │   └── Theme.kt
│   │       │   │   ├── screens/
│   │       │   │   │   ├── IdleScreen.kt
│   │       │   │   │   ├── RoomScreen.kt
│   │       │   │   │   └── PermissionScreen.kt
│   │       │   │   └── components/
│   │       │   │       ├── QrCodeImage.kt
│   │       │   │       ├── NowPlayingCard.kt
│   │       │   │       └── QueueList.kt
│   │       │   │
│   │       │   ├── service/                  <- UI-AGNOSTIC LOGIC
│   │       │   │   ├── ListeningService.kt
│   │       │   │   └── NotificationListener.kt
│   │       │   ├── websocket/
│   │       │   │   ├── WebSocketClient.kt
│   │       │   │   └── Messages.kt
│   │       │   ├── media/
│   │       │   │   ├── MediaObserver.kt
│   │       │   │   └── PlaybackController.kt
│   │       │   └── queue/
│   │       │       ├── QueueManager.kt
│   │       │       └── QueuedSong.kt
│   │       │
│   │       ├── res/
│   │       │   ├── values/
│   │       │   │   ├── strings.xml
│   │       │   │   ├── colors.xml
│   │       │   │   └── themes.xml
│   │       │   └── drawable/
│   │       │       └── (icons)
│   │       └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

**note:** the `ui/` folder is entirely self-contained. to swap the ui, delete it and create a new implementation that observes `MainViewModel.uiState`. the rest of the app remains untouched.

## configuration

### server url

the websocket server url should be configurable:

```kotlin
// build.gradle.kts
android {
    defaultConfig {
        buildConfigField("String", "WS_URL", "\"ws://your-server.com/ws\"")
    }

    buildTypes {
        debug {
            buildConfigField("String", "WS_URL", "\"wss://lw.hyperbeam.sh/ws\"") // production server
        }
        release {
            buildConfigField("String", "WS_URL", "\"wss://your-server.com/ws\"")
        }
    }
}
```

accessed via:
```kotlin
val wsUrl = BuildConfig.WS_URL
```

### timeouts

| setting | value | notes |
|---------|-------|-------|
| websocket connect timeout | 10s | okhttp default |
| websocket read timeout | 0 (infinite) | long-lived connection |
| heartbeat interval | 30s | matches server room timeout check |
| reconnect backoff | 1s -> 30s max | exponential backoff |
| song end detection threshold | 1000ms | position within 1s of duration |
| playback trigger cooldown | 2000ms | ignore metadata changes for 2s after we trigger playback |

## testing checklist

### unit tests

- [ ] QueueManager: add, poll, peek, skip, clear
- [ ] Message parsing: all incoming message types
- [ ] Message serialization: all outgoing message types

### integration tests

- [ ] WebSocket connection and reconnection
- [ ] Room creation flow
- [ ] Song added to queue flow

### manual testing

- [ ] create room, verify qr code displays correctly
- [ ] scan qr from web client, verify join succeeds
- [ ] add song from client, verify appears in host queue
- [ ] play a song, verify it plays on youtube music
- [ ] let song end naturally, verify next song plays automatically
- [ ] manually skip song in ytm (via notification/in-app), verify next song from queue plays
- [ ] background the app, verify service continues running
- [ ] kill the app from recents, verify service handles cleanup
- [ ] disconnect internet, verify reconnection works
- [ ] test with ytm closed, verify error handling

## implementation order

suggested order for incremental development:

### phase 1: foundation
1. create new android project with proper package structure
2. implement `NotificationListener` service (minimal, just for permission)
3. implement permission checking and settings navigation
4. create basic `MainActivity` with permission check UI

### phase 2: media observation
5. implement `MediaObserver` (based on spike app code)
6. verify ytm detection and playback state observation works
7. implement `PlaybackController` for intent-based playback
8. test song end detection (position + metadata based)

### phase 3: websocket
9. implement `WebSocketClient` with okhttp
10. implement message types (`Messages.kt`)
11. implement connection, reconnection, heartbeat logic
12. test against local server

### phase 4: service
13. implement `ListeningService` as foreground service
14. integrate websocket client into service
15. integrate media observer into service
16. implement notification for foreground service

### phase 5: queue and coordination
17. implement `QueueManager`
18. wire up: song_added -> queue -> playNextFromQueue -> intent
19. handle the playback trigger cooldown (avoid loops)

### phase 6: viewmodel (the bridge)
20. implement `MainViewModel` with `UiState` data class
21. wire viewmodel to observe service state via StateFlow
22. expose actions (createRoom, endRoom, etc.) that delegate to services
23. verify viewmodel is the ONLY connection between ui and services

### phase 7: ui (replaceable layer)
24. implement `MainActivity` as minimal compose host
25. implement idle screen (observes viewmodel state)
26. implement room screen with qr code, queue list, now playing
27. implement permission screen
28. ensure ALL ui code lives in `ui/` folder

### phase 8: polish
29. add error handling throughout
30. add loading states
31. test edge cases
32. optimize for battery/performance
33. verify ui can be deleted and rebuilt without touching other code

## notes for implementation agent

### critical: ui/logic separation

**this is a hard requirement, not a suggestion.**

the ui must be completely decoupled from business logic. see the "architecture principles" section for full details. key rules:

1. **all ui code goes in `ui/` folder** - screens, components, theme
2. **MainViewModel is the only bridge** - ui observes `UiState`, calls viewmodel methods
3. **services never import ui classes** - no views, no compose, no fragments
4. **services expose state via StateFlow** - viewmodel collects and maps to UiState

**test yourself:** could someone delete the entire `ui/` folder and rebuild it from scratch using only `MainViewModel` as the interface? if yes, you've done it right. if no, refactor until yes.

### key technical insights from spike

1. **MediaSessionManager requires NotificationListenerService** - the service doesn't need to do anything, it just needs to exist and be declared in manifest.

2. **Song end detection is tricky** - use BOTH position-based (for natural endings) AND metadata-based (for skips). see the MediaObserver section for details.

3. **Avoid playback loops** - when we trigger a song via intent, metadata changes. we must track `justTriggeredPlayback` and ignore the metadata change we caused.

4. **Connection resilience** - the spike had one instance where connection was lost and couldn't recover. implement automatic reconnection AND a manual "retry" option.

### code from spike to reuse

the spike app's `MainActivity.kt` has working implementations of:
- MediaSessionManager setup and session finding
- MediaController.Callback for state/metadata changes
- playback state polling via handler
- intent-based playback
- song end detection logic

these can be adapted/refactored into the MediaObserver and PlaybackController classes.

### websocket message format

the server expects/sends JSON. use gson for serialization:

```kotlin
// incoming
sealed class ServerMessage {
    data class RoomCreated(val code: String, val qrCodeDataUrl: String) : ServerMessage()
    data class SongAdded(val song: Song, val queueLength: Int) : ServerMessage()
    // etc.
}

// outgoing
sealed class ClientMessage {
    object CreateRoom : ClientMessage()
    object Heartbeat : ClientMessage()
}
```

### qr code display

the server returns qr code as a data url (`data:image/png;base64,...`). to display:

```kotlin
fun decodeQrCodeDataUrl(dataUrl: String): Bitmap? {
    val base64 = dataUrl.substringAfter("base64,")
    val bytes = Base64.decode(base64, Base64.DEFAULT)
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
}
```

### foreground service type

for android 14+, specify the foreground service type:

```xml
<service
    android:name=".service.ListeningService"
    android:foregroundServiceType="mediaPlayback"
    android:exported="false" />
```

### minimum sdk

api level 26 (android 8.0) - this is when MediaSessionManager was introduced and is also a reasonable modern baseline.
