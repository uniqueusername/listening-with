package com.listeningwith.host.media

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.listeningwith.host.service.NotificationListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class CurrentTrack(
    val title: String,
    val artist: String,
    val mediaId: String?,
    val duration: Long,
    val position: Long,
    val isPlaying: Boolean
)

class MediaObserver(
    private val context: Context,
    private val onSongEnded: () -> Unit
) {
    companion object {
        private const val TAG = "MediaObserver"
        private const val YTM_PACKAGE = "com.google.android.apps.youtube.music"
        private const val POLL_INTERVAL_MS = 500L
        private const val SONG_END_THRESHOLD_MS = 1000L
        private const val PLAYBACK_TRIGGER_COOLDOWN_MS = 2000L
    }

    private val mediaSessionManager: MediaSessionManager =
        context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager

    private var currentController: MediaController? = null
    private val handler = Handler(Looper.getMainLooper())

    private var lastTrackId: String? = null
    private var lastPosition: Long = 0
    private var lastDuration: Long = 0
    private var justTriggeredPlayback = false

    private val _currentTrack = MutableStateFlow<CurrentTrack?>(null)
    val currentTrack: StateFlow<CurrentTrack?> = _currentTrack.asStateFlow()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val pollRunnable = object : Runnable {
        override fun run() {
            val controller = currentController
            if (controller != null) {
                val metadata = controller.metadata
                checkForTrackChange(metadata)
                updatePlaybackInfo()
            }
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    private val mediaCallback = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(state: PlaybackState?) {
            super.onPlaybackStateChanged(state)
            Log.d(TAG, "playback state changed: ${getStateName(state?.state)}")
            checkForSongEnd(state)
            updatePlaybackInfo()
        }

        override fun onMetadataChanged(metadata: MediaMetadata?) {
            super.onMetadataChanged(metadata)
            Log.d(TAG, "metadata changed")
            checkForTrackChange(metadata)
            updatePlaybackInfo()
        }

        override fun onSessionDestroyed() {
            super.onSessionDestroyed()
            Log.d(TAG, "session destroyed")
            currentController = null
            _isConnected.value = false
            _currentTrack.value = null
        }
    }

    fun start() {
        findYouTubeMusicController()
        handler.post(pollRunnable)
    }

    fun stop() {
        handler.removeCallbacks(pollRunnable)
        currentController?.unregisterCallback(mediaCallback)
        currentController = null
        _isConnected.value = false
    }

    fun retry() {
        Log.d(TAG, "retrying connection...")
        findYouTubeMusicController()
    }

    fun markPlaybackTriggered() {
        justTriggeredPlayback = true
        handler.postDelayed({
            justTriggeredPlayback = false
        }, PLAYBACK_TRIGGER_COOLDOWN_MS)
    }

    private fun findYouTubeMusicController() {
        try {
            val componentName = ComponentName(context, NotificationListener::class.java)
            val controllers = mediaSessionManager.getActiveSessions(componentName)

            Log.d(TAG, "found ${controllers.size} active media sessions")

            for (controller in controllers) {
                Log.d(TAG, "session: ${controller.packageName}")
                if (controller.packageName == YTM_PACKAGE) {
                    currentController?.unregisterCallback(mediaCallback)
                    currentController = controller
                    controller.registerCallback(mediaCallback)
                    _isConnected.value = true
                    Log.d(TAG, "connected to youtube music")
                    updatePlaybackInfo()
                    return
                }
            }

            Log.d(TAG, "youtube music not found")
            _isConnected.value = false
        } catch (e: SecurityException) {
            Log.e(TAG, "permission denied - notification access required", e)
            _isConnected.value = false
        }
    }

    private fun updatePlaybackInfo() {
        val controller = currentController ?: return

        val metadata = controller.metadata
        val playbackState = controller.playbackState

        if (metadata != null) {
            val title = metadata.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "unknown"
            val artist = metadata.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: "unknown"
            val mediaId = metadata.getString(MediaMetadata.METADATA_KEY_MEDIA_ID)
            val duration = metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)
            val position = playbackState?.position ?: 0
            val isPlaying = playbackState?.state == PlaybackState.STATE_PLAYING

            _currentTrack.value = CurrentTrack(
                title = title,
                artist = artist,
                mediaId = mediaId,
                duration = duration,
                position = position,
                isPlaying = isPlaying
            )
        }
    }

    private fun checkForSongEnd(state: PlaybackState?) {
        if (state?.state == PlaybackState.STATE_STOPPED ||
            state?.state == PlaybackState.STATE_PAUSED
        ) {
            val position = state.position
            val duration = currentController?.metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0

            if (duration > 0 && position >= duration - SONG_END_THRESHOLD_MS) {
                Log.d(TAG, "song ended naturally - position: $position, duration: $duration")
                if (!justTriggeredPlayback) {
                    onSongEnded()
                }
            }
        }
    }

    private fun checkForTrackChange(metadata: MediaMetadata?) {
        val currentTrackId = getTrackId(metadata)

        if (currentTrackId != lastTrackId && lastTrackId != null && currentTrackId != null) {
            Log.d(TAG, "track changed from $lastTrackId to $currentTrackId")
            if (!justTriggeredPlayback) {
                // User skipped or YTM auto-advanced
                Log.d(TAG, "external track change detected - playing next from queue")
                onSongEnded()
            }
        }

        if (currentTrackId != null) {
            lastTrackId = currentTrackId
        }
    }

    private fun getTrackId(metadata: MediaMetadata?): String? {
        if (metadata == null) return null
        
        // Try MEDIA_ID first
        val mediaId = metadata.getString(MediaMetadata.METADATA_KEY_MEDIA_ID)
        if (!mediaId.isNullOrEmpty()) return mediaId

        // Fallback to Title + Artist
        val title = metadata.getString(MediaMetadata.METADATA_KEY_TITLE)
        val artist = metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)
        
        return if (!title.isNullOrEmpty() || !artist.isNullOrEmpty()) {
            "${title ?: "unknown"}|${artist ?: "unknown"}"
        } else {
            null
        }
    }

    private fun getStateName(state: Int?): String {
        return when (state) {
            PlaybackState.STATE_PLAYING -> "playing"
            PlaybackState.STATE_PAUSED -> "paused"
            PlaybackState.STATE_STOPPED -> "stopped"
            PlaybackState.STATE_BUFFERING -> "buffering"
            PlaybackState.STATE_CONNECTING -> "connecting"
            PlaybackState.STATE_SKIPPING_TO_NEXT -> "skipping_next"
            PlaybackState.STATE_SKIPPING_TO_PREVIOUS -> "skipping_previous"
            else -> "unknown"
        }
    }
}
