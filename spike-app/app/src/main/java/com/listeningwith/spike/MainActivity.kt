package com.listeningwith.spike

import android.content.ComponentName
import android.content.Intent
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.method.ScrollingMovementMethod
import androidx.appcompat.app.AppCompatActivity
import com.listeningwith.spike.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var mediaSessionManager: MediaSessionManager
    private var currentController: MediaController? = null
    private val handler = Handler(Looper.getMainLooper())
    private var lastPosition: Long = 0
    private var lastDuration: Long = 0
    private var lastState: Int = PlaybackState.STATE_NONE
    private var wasConnected: Boolean = false

    // test song: "never gonna give you up" by rick astley
    private val TEST_SONG_ID = "dQw4w9WgXcQ"

    private val updateRunnable = object : Runnable {
        override fun run() {
            updatePlaybackInfo()
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.logText.movementMethod = ScrollingMovementMethod()

        mediaSessionManager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager

        binding.openSettingsButton.setOnClickListener {
            openNotificationSettings()
        }

        binding.retryConnectionButton.setOnClickListener {
            logMessage("manually retrying connection...")
            findYouTubeMusicController()
        }

        binding.playTestSongButton.setOnClickListener {
            playYouTubeMusicSong(TEST_SONG_ID)
        }

        logMessage("app started")
        findYouTubeMusicController()
        handler.post(updateRunnable)
    }

    override fun onResume() {
        super.onResume()
        // re-check connection when app comes to foreground
        if (currentController == null) {
            logMessage("app resumed - checking connection...")
            findYouTubeMusicController()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(updateRunnable)
    }

    private fun findYouTubeMusicController() {
        try {
            val controllers = mediaSessionManager.getActiveSessions(
                ComponentName(this, NotificationListener::class.java)
            )

            logMessage("found ${controllers.size} active media sessions")

            for (controller in controllers) {
                val packageName = controller.packageName
                logMessage("session: $packageName")

                if (packageName == "com.google.android.apps.youtube.music") {
                    currentController = controller
                    controller.registerCallback(mediaCallback)
                    wasConnected = true
                    logMessage("connected to youtube music!")
                    binding.statusText.text = "status: listening to youtube music"
                    updatePlaybackInfo()
                    return
                }
            }

            binding.statusText.text = "status: youtube music not found"
            logMessage("youtube music not found. make sure it's playing.")
        } catch (e: SecurityException) {
            binding.statusText.text = "status: notification permission required"
            logMessage("permission denied - please enable notification access in settings")
            logMessage("go to: settings > apps > listening-with spike > notifications")
            logMessage("or: settings > security & privacy > notification access")
        }
    }

    private val mediaCallback = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(state: PlaybackState?) {
            super.onPlaybackStateChanged(state)
            logMessage("playback state changed: ${getStateName(state?.state)}")
            updatePlaybackInfo()

            // detect song end
            if (state?.state == PlaybackState.STATE_STOPPED ||
                state?.state == PlaybackState.STATE_PAUSED
            ) {
                val position = state.position
                val duration = currentController?.metadata?.getLong("android.media.metadata.DURATION") ?: 0

                if (duration > 0 && position >= duration - 1000) {
                    logMessage("song ended - position: $position, duration: $duration")
                }
            }
        }

        override fun onMetadataChanged(metadata: android.media.MediaMetadata?) {
            super.onMetadataChanged(metadata)
            logMessage("metadata changed")
            updatePlaybackInfo()
        }
    }

    private fun updatePlaybackInfo() {
        currentController?.let { controller ->
            val metadata = controller.metadata
            val playbackState = controller.playbackState

            if (metadata != null) {
                val title = metadata.getString("android.media.metadata.TITLE") ?: "unknown"
                val artist = metadata.getString("android.media.metadata.ARTIST") ?: "unknown"
                val duration = metadata.getLong("android.media.metadata.DURATION")

                binding.trackInfoText.text = "$title\n$artist"

                val position = playbackState?.position ?: 0
                binding.positionText.text = "position: ${formatTime(position)} / ${formatTime(duration)}"

                // check for song end based on position
                val state = playbackState?.state ?: PlaybackState.STATE_NONE
                if (state != lastState || position != lastPosition || duration != lastDuration) {
                    if (duration > 0 && position >= duration - 1000 && position > lastPosition) {
                        logMessage("song end detected - position: $position, duration: $duration")
                    }
                    lastPosition = position
                    lastDuration = duration
                    lastState = state
                }
            } else {
                binding.trackInfoText.text = "no track playing"
            }

            val stateName = getStateName(playbackState?.state)
            binding.playbackStateText.text = "playback: $stateName"
            wasConnected = true
        } ?: run {
            if (wasConnected) {
                logMessage("⚠️ connection lost! controller is null")
                wasConnected = false
            }
            binding.trackInfoText.text = "no controller connected"
            binding.positionText.text = "position: --:-- / --:--"
            binding.playbackStateText.text = "playback: unknown"
        }
    }

    private fun openNotificationSettings() {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            startActivity(intent)
            logMessage("opening notification settings...")
        } catch (e: Exception) {
            logMessage("error opening settings: ${e.message}")
        }
    }

    private fun playYouTubeMusicSong(videoId: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("https://music.youtube.com/watch?v=$videoId")
                setPackage("com.google.android.apps.youtube.music")
            }
            startActivity(intent)
            logMessage("triggered playback for video id: $videoId")
        } catch (e: Exception) {
            logMessage("error playing song: ${e.message}")
        }
    }

    private fun getStateName(state: Int?): String {
        return when (state) {
            PlaybackState.STATE_PLAYING -> "playing"
            PlaybackState.STATE_PAUSED -> "paused"
            PlaybackState.STATE_STOPPED -> "stopped"
            PlaybackState.STATE_BUFFERING -> "buffering"
            PlaybackState.STATE_CONNECTING -> "connecting"
            PlaybackState.STATE_SKIPPING_TO_NEXT -> "skipping to next"
            PlaybackState.STATE_SKIPPING_TO_PREVIOUS -> "skipping to previous"
            else -> "unknown"
        }
    }

    private fun formatTime(ms: Long): String {
        val seconds = (ms / 1000).toInt()
        val minutes = seconds / 60
        val secs = seconds % 60
        return String.format("%d:%02d", minutes, secs)
    }

    private fun logMessage(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val logLine = "[$timestamp] $message\n"
        binding.logText.append(logLine)

        // auto-scroll to bottom
        val scrollAmount = binding.logText.layout?.getLineTop(binding.logText.lineCount) ?: 0
        if (scrollAmount > binding.logText.height) {
            binding.logText.scrollTo(0, scrollAmount - binding.logText.height)
        }
    }
}
