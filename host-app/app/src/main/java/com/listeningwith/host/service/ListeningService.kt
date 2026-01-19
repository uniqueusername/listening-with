package com.listeningwith.host.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import com.listeningwith.host.BuildConfig
import com.listeningwith.host.MainActivity
import com.listeningwith.host.R
import com.listeningwith.host.media.CurrentTrack
import com.listeningwith.host.media.MediaObserver
import com.listeningwith.host.media.PlaybackController
import com.listeningwith.host.queue.QueueManager
import com.listeningwith.host.queue.QueuedSong
import com.listeningwith.host.websocket.ConnectionState
import com.listeningwith.host.websocket.ServerMessage
import com.listeningwith.host.websocket.WebSocketClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ServiceState(
    val connectionState: ConnectionState = ConnectionState.DISCONNECTED,
    val roomCode: String? = null,
    val qrCodeBitmap: Bitmap? = null,
    val listenerCount: Int = 0,
    val queue: List<QueuedSong> = emptyList(),
    val nowPlaying: QueuedSong? = null,
    val currentTrack: CurrentTrack? = null,
    val isYtmConnected: Boolean = false,
    val error: String? = null
)

class ListeningService : Service() {
    companion object {
        private const val TAG = "ListeningService"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "listening_session"
        private const val ACTION_END_SESSION = "com.listeningwith.host.END_SESSION"
    }

    private val binder = LocalBinder()

    private lateinit var webSocketClient: WebSocketClient
    private lateinit var mediaObserver: MediaObserver
    private lateinit var playbackController: PlaybackController
    private val queueManager = QueueManager()
    private var webClientBaseUrl: String? = null

    private val _serviceState = MutableStateFlow(ServiceState())
    val serviceState: StateFlow<ServiceState> = _serviceState.asStateFlow()

    inner class LocalBinder : Binder() {
        fun getService(): ListeningService = this@ListeningService
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "service created")

        createNotificationChannel()
        initializeComponents()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_END_SESSION -> {
                endSession()
                return START_NOT_STICKY
            }
        }

        // Check if a custom URL was passed
        val customUrl = intent?.getStringExtra("WS_URL")
        if (customUrl != null && ::webSocketClient.isInitialized) {
             // If we already have a client but the URL changed, we might need to handle it.
             // But usually onStartCommand is called before startSession
        }

        startForeground(NOTIFICATION_ID, createNotification())
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "service destroyed")
        cleanup()
    }

    private fun initializeComponents() {
        // Initialize with default, will be re-initialized if startSession is called with a different URL
        webSocketClient = WebSocketClient(
            serverUrl = BuildConfig.WS_URL,
            onMessage = ::handleServerMessage,
            onConnectionStateChange = ::handleConnectionStateChange
        )

        mediaObserver = MediaObserver(
            context = this,
            onSongEnded = ::playNextFromQueue
        )

        playbackController = PlaybackController(this)
    }

    fun startSession(url: String = BuildConfig.WS_URL, webClientUrl: String = "https://lw.hyperbeam.sh") {
        Log.d(TAG, "starting session with server url: $url, web client url: $webClientUrl")

        webClientBaseUrl = webClientUrl

        // Re-initialize WebSocketClient if URL is different
        // Or just create a new one since we are starting a fresh session
        if (::webSocketClient.isInitialized) {
            webSocketClient.disconnect()
        }

        webSocketClient = WebSocketClient(
            serverUrl = url,
            onMessage = ::handleServerMessage,
            onConnectionStateChange = ::handleConnectionStateChange
        )

        webSocketClient.connect()
        mediaObserver.start()
    }

    fun endSession() {
        Log.d(TAG, "ending session")
        cleanup()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    fun retryConnection() {
        webSocketClient.connect()
    }

    fun retryYtmConnection() {
        mediaObserver.retry()
    }

    private fun cleanup() {
        NfcDataHolder.currentUrl = null
        webSocketClient.disconnect()
        mediaObserver.stop()
        queueManager.clear()
        _serviceState.value = ServiceState()
    }

    private fun handleConnectionStateChange(state: ConnectionState) {
        Log.d(TAG, "connection state: $state")
        _serviceState.value = _serviceState.value.copy(connectionState = state)

        if (state == ConnectionState.CONNECTED) {
            webSocketClient.createRoom(webClientBaseUrl)
        }

        updateNotification()
    }

    private fun handleServerMessage(message: ServerMessage) {
        Log.d(TAG, "received message: $message")

        when (message) {
            is ServerMessage.RoomCreated -> {
                val bitmap = decodeQrCodeDataUrl(message.qrCodeDataUrl)
                
                // Update NFC URL
                NfcDataHolder.currentUrl = message.joinUrl

                _serviceState.value = _serviceState.value.copy(
                    roomCode = message.code,
                    qrCodeBitmap = bitmap,
                    error = null
                )
                updateNotification()
            }

            is ServerMessage.ClientJoined -> {
                _serviceState.value = _serviceState.value.copy(
                    listenerCount = message.clientCount
                )
                updateNotification()
            }

            is ServerMessage.ClientLeft -> {
                _serviceState.value = _serviceState.value.copy(
                    listenerCount = message.clientCount
                )
                updateNotification()
            }

            is ServerMessage.SongAdded -> {
                queueManager.add(message.song)
                _serviceState.value = _serviceState.value.copy(
                    queue = queueManager.getAll()
                )

                sendQueueUpdate()

                // If nothing is playing, start playing
                if (_serviceState.value.nowPlaying == null) {
                    playNextFromQueue()
                }
            }

            is ServerMessage.HeartbeatAck -> {
                // Connection is alive
            }

            is ServerMessage.RoomClosed -> {
                _serviceState.value = _serviceState.value.copy(
                    error = "room closed: ${message.reason}",
                    roomCode = null,
                    qrCodeBitmap = null
                )
                endSession()
            }

            is ServerMessage.Error -> {
                _serviceState.value = _serviceState.value.copy(
                    error = message.message
                )
            }
        }
    }

    private fun playNextFromQueue() {
        val nextSong = queueManager.poll()
        if (nextSong == null) {
            Log.d(TAG, "queue is empty")
            _serviceState.value = _serviceState.value.copy(
                nowPlaying = null,
                queue = queueManager.getAll()
            )
            sendQueueUpdate()
            return
        }

        Log.d(TAG, "playing next song: ${nextSong.title}")
        _serviceState.value = _serviceState.value.copy(
            nowPlaying = nextSong,
            queue = queueManager.getAll()
        )
        sendQueueUpdate()

        mediaObserver.markPlaybackTriggered()
        val result = playbackController.playYouTubeMusicSong(nextSong.videoId)

        when (result) {
            is PlaybackController.PlaybackResult.Success -> {
                updateNotification()
            }
            is PlaybackController.PlaybackResult.YtmNotInstalled -> {
                _serviceState.value = _serviceState.value.copy(
                    error = "youtube music is not installed"
                )
            }
            is PlaybackController.PlaybackResult.Error -> {
                Log.e(TAG, "playback error: ${result.message}")
                // Try next song
                playNextFromQueue()
            }
        }
    }

    private fun sendQueueUpdate() {
        val state = _serviceState.value
        if (state.connectionState == ConnectionState.CONNECTED) {
            webSocketClient.sendQueueUpdate(state.queue, state.nowPlaying)
        }
    }

    private fun decodeQrCodeDataUrl(dataUrl: String): Bitmap? {
        return try {
            val base64 = dataUrl.substringAfter("base64,")
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (e: Exception) {
            Log.e(TAG, "failed to decode qr code", e)
            null
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
        }

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.createNotificationChannel(channel)
    }

    private fun createNotification(): Notification {
        val state = _serviceState.value

        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val endIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, ListeningService::class.java).apply {
                action = ACTION_END_SESSION
            },
            PendingIntent.FLAG_IMMUTABLE
        )

        val title = if (state.roomCode != null) {
            "room: ${state.roomCode}"
        } else {
            "listening-with"
        }

        val text = when {
            state.nowPlaying != null -> "now playing: ${state.nowPlaying.title}"
            state.connectionState == ConnectionState.CONNECTING -> "connecting..."
            state.connectionState == ConnectionState.RECONNECTING -> "reconnecting..."
            state.roomCode != null -> "${state.listenerCount} listener${if (state.listenerCount != 1) "s" else ""}"
            else -> "starting..."
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentIntent)
            .addAction(android.R.drawable.ic_delete, "end", endIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification() {
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, createNotification())
    }
}
