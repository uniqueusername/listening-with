package com.listeningwith.host.websocket

import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RECONNECTING
}

class WebSocketClient(
    private val serverUrl: String,
    private val onMessage: (ServerMessage) -> Unit,
    private val onConnectionStateChange: (ConnectionState) -> Unit
) {
    companion object {
        private const val TAG = "WebSocketClient"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
        private const val INITIAL_RECONNECT_DELAY_MS = 1_000L
        private const val MAX_RECONNECT_DELAY_MS = 30_000L
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // infinite for long-lived connection
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var isConnecting = false
    private var shouldReconnect = true
    private var reconnectDelay = INITIAL_RECONNECT_DELAY_MS

    private val handler = Handler(Looper.getMainLooper())
    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            sendHeartbeat()
            handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    fun connect() {
        if (isConnecting || webSocket != null) {
            Log.d(TAG, "already connected or connecting")
            return
        }

        shouldReconnect = true
        isConnecting = true
        _connectionState.value = ConnectionState.CONNECTING
        onConnectionStateChange(ConnectionState.CONNECTING)

        val request = Request.Builder()
            .url(serverUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "websocket connected")
                isConnecting = false
                reconnectDelay = INITIAL_RECONNECT_DELAY_MS
                _connectionState.value = ConnectionState.CONNECTED
                onConnectionStateChange(ConnectionState.CONNECTED)
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "received: $text")
                val message = ServerMessage.parse(text)
                if (message != null) {
                    handler.post { onMessage(message) }
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "websocket closing: $code $reason")
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "websocket closed: $code $reason")
                handleDisconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "websocket error", t)
                handleDisconnect()
            }
        })
    }

    fun disconnect() {
        shouldReconnect = false
        stopHeartbeat()
        webSocket?.close(1000, "user disconnected")
        webSocket = null
        isConnecting = false
        _connectionState.value = ConnectionState.DISCONNECTED
        onConnectionStateChange(ConnectionState.DISCONNECTED)
    }

    fun send(message: ClientMessage) {
        val json = message.toJson()
        Log.d(TAG, "sending: $json")
        webSocket?.send(json)
    }

    fun createRoom(baseUrl: String? = null) {
        send(ClientMessage.CreateRoom(baseUrl))
    }

    fun sendQueueUpdate(
        primaryQueue: List<com.listeningwith.host.queue.QueuedSong>,
        auxiliaryQueue: List<com.listeningwith.host.queue.QueuedSong>,
        nowPlaying: com.listeningwith.host.queue.QueuedSong?
    ) {
        send(ClientMessage.UpdateQueue(primaryQueue, auxiliaryQueue, nowPlaying))
    }

    private fun sendHeartbeat() {
        send(ClientMessage.Heartbeat)
    }

    private fun startHeartbeat() {
        handler.removeCallbacks(heartbeatRunnable)
        handler.postDelayed(heartbeatRunnable, HEARTBEAT_INTERVAL_MS)
    }

    private fun stopHeartbeat() {
        handler.removeCallbacks(heartbeatRunnable)
    }

    private fun handleDisconnect() {
        isConnecting = false
        webSocket = null
        stopHeartbeat()

        if (shouldReconnect) {
            _connectionState.value = ConnectionState.RECONNECTING
            onConnectionStateChange(ConnectionState.RECONNECTING)
            scheduleReconnect()
        } else {
            _connectionState.value = ConnectionState.DISCONNECTED
            onConnectionStateChange(ConnectionState.DISCONNECTED)
        }
    }

    private fun scheduleReconnect() {
        Log.d(TAG, "scheduling reconnect in ${reconnectDelay}ms")
        handler.postDelayed({
            if (shouldReconnect && webSocket == null) {
                reconnectDelay = (reconnectDelay * 2).coerceAtMost(MAX_RECONNECT_DELAY_MS)
                connect()
            }
        }, reconnectDelay)
    }
}
