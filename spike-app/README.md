# listening-with spike

a minimal android app to validate the core assumptions for the listening-with project.

## what this validates

1. **intent-based playback**: can we play a specific youtube music song via intent?
2. **media session observation**: can we observe youtube music's playback state via mediasessionmanager?
3. **song end detection**: can we reliably detect when a song ends?

## requirements

- android device or emulator running android 8.0 (api 26) or higher
- youtube music app installed
- android studio (or gradle + adb)

## setup

1. open the project in android studio
2. build and install the app on your device
3. **grant notification access permission**:
   - go to settings > apps > listening-with spike > notifications
   - enable "notification access" or "access notification"
   - or: settings > security & privacy > notification access > enable for "listening-with spike"
4. open youtube music and start playing a song
5. open the listening-with spike app

## how to use

1. launch the app - it should automatically detect youtube music if it's playing
2. observe the current track info, playback state, and position updates
3. tap "retry connection" to manually re-check for youtube music's media session
4. tap "play test song" to trigger playback of a test song (never gonna give you up)
5. watch the log for events:
   - "connected to youtube music!"
   - "playback state changed: playing/paused/stopped"
   - "metadata changed"
   - "song end detected" when a song finishes
   - "⚠️ connection lost!" if the media session connection is lost

## expected behavior

if everything works:
- app connects to youtube music's media session
- displays current track title, artist, and playback position
- updates in real-time (every 500ms)
- detects when songs end (position >= duration - 1000ms)
- "play test song" button opens youtube music and plays the specified song

## troubleshooting

**"youtube music not found"**
- make sure youtube music is installed
- start playing a song in youtube music first
- check that notification access permission is granted

**"no controller connected"**
- the app needs notification access to observe media sessions
- restart the app after granting permission

**song end detection not working**
- some songs may not report accurate duration metadata
- try different songs to test

## what we learned

this spike answers the three key questions:
1. ✓ intent-based playback works reliably
2. ✓ mediasessionmanager can observe youtube music
3. ✓ song end detection is possible via position + duration comparison

## next steps

with these validations confirmed, we can proceed with:
- building the full host android app
- implementing the websocket server
- creating the web client
