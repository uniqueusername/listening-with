package com.listeningwith.host

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.graphics.Bitmap
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.listeningwith.host.media.MediaSessionDebug
import com.listeningwith.host.queue.QueuedSong
import com.listeningwith.host.service.ListeningService
import com.listeningwith.host.websocket.ConnectionState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class Screen {
    object Idle : Screen()
    object Connecting : Screen()
    object RoomActive : Screen()
    object PermissionRequired : Screen()
}

enum class MissingPermission {
    NONE,
    NOTIFICATION_LISTENER,
    SYSTEM_ALERT_WINDOW
}

data class UiState(
    val screen: Screen = Screen.Idle,
    val roomCode: String? = null,
    val listenerCount: Int = 0,
    val qrCodeBitmap: Bitmap? = null,
    val nowPlaying: QueuedSong? = null,
    val primaryQueue: List<QueuedSong> = emptyList(),
    val auxiliaryQueue: List<QueuedSong> = emptyList(),
    val error: String? = null,
    val isConnecting: Boolean = false,
    val missingPermission: MissingPermission = MissingPermission.NONE,
    val customUrl: String = BuildConfig.WS_URL,
    val webClientBaseUrl: String = "https://lw.hyperbeam.sh",
    val isCustomUrlVisible: Boolean = false
)

class MainViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var service: ListeningService? = null
    private var isBound = false
    private var applicationContext: Context? = null
    
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val localBinder = binder as ListeningService.LocalBinder
            service = localBinder.getService()
            isBound = true

            // Observe service state
            viewModelScope.launch {
                service?.serviceState?.collect { serviceState ->
                    updateUiState(serviceState)
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            isBound = false
        }
    }

    fun initialize(context: Context) {
        applicationContext = context.applicationContext
        checkPermissions()
    }

    fun checkPermissions() {
        val context = applicationContext ?: return
        val hasNotification = hasNotificationAccess(context)
        val hasOverlay = Settings.canDrawOverlays(context)

        val missing = when {
            !hasNotification -> MissingPermission.NOTIFICATION_LISTENER
            !hasOverlay -> MissingPermission.SYSTEM_ALERT_WINDOW
            else -> MissingPermission.NONE
        }

        _uiState.value = _uiState.value.copy(
            missingPermission = missing,
            screen = if (missing != MissingPermission.NONE && _uiState.value.screen == Screen.Idle) {
                Screen.PermissionRequired
            } else if (missing == MissingPermission.NONE && _uiState.value.screen == Screen.PermissionRequired) {
                Screen.Idle
            } else {
                _uiState.value.screen
            }
        )
    }

    fun toggleCustomUrl() {
        _uiState.value = _uiState.value.copy(isCustomUrlVisible = !_uiState.value.isCustomUrlVisible)
    }

    fun updateCustomUrl(url: String) {
        _uiState.value = _uiState.value.copy(customUrl = url)
    }

    fun updateWebClientBaseUrl(url: String) {
        _uiState.value = _uiState.value.copy(webClientBaseUrl = url)
    }

    fun createRoom() {
        val context = applicationContext ?: return

        checkPermissions()
        if (_uiState.value.missingPermission != MissingPermission.NONE) {
            _uiState.value = _uiState.value.copy(screen = Screen.PermissionRequired)
            return
        }

        _uiState.value = _uiState.value.copy(
            screen = Screen.Connecting,
            isConnecting = true,
            error = null
        )

        // Start and bind to service
        val intent = Intent(context, ListeningService::class.java).apply {
            putExtra("WS_URL", _uiState.value.customUrl)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

        // The service will be started in onServiceConnected
        viewModelScope.launch {
            // Give the service time to bind
            kotlinx.coroutines.delay(100)
            service?.startSession(_uiState.value.customUrl, _uiState.value.webClientBaseUrl)
        }
    }

    fun endRoom() {
        service?.endSession()
        unbindService()
        // Re-check permissions to reset state properly
        checkPermissions()
    }

    fun retryConnection() {
        service?.retryConnection()
    }

    fun resolvePermissionError() {
        val context = applicationContext ?: return
        val intent = when (_uiState.value.missingPermission) {
            MissingPermission.NOTIFICATION_LISTENER -> Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            MissingPermission.SYSTEM_ALERT_WINDOW -> Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${context.packageName}")
            )
            else -> return
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun openNotificationSettings() {
        // Deprecated, use resolvePermissionError
        resolvePermissionError()
    }

    fun dismissError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun goToIdleScreen() {
        checkPermissions()
    }

    fun investigateMediaSession(): String {
        val context = applicationContext ?: return "No application context"
        return MediaSessionDebug.investigateYouTubeMusic(context)
    }

    private fun updateUiState(serviceState: com.listeningwith.host.service.ServiceState) {
        val screen = when {
            serviceState.roomCode != null -> Screen.RoomActive
            serviceState.connectionState == ConnectionState.CONNECTING ||
            serviceState.connectionState == ConnectionState.RECONNECTING -> Screen.Connecting
            else -> Screen.Idle
        }

        _uiState.value = _uiState.value.copy(
            screen = screen,
            roomCode = serviceState.roomCode,
            listenerCount = serviceState.listenerCount,
            qrCodeBitmap = serviceState.qrCodeBitmap,
            nowPlaying = serviceState.nowPlaying,
            primaryQueue = serviceState.primaryQueue,
            auxiliaryQueue = serviceState.auxiliaryQueue,
            error = serviceState.error,
            isConnecting = serviceState.connectionState == ConnectionState.CONNECTING ||
                          serviceState.connectionState == ConnectionState.RECONNECTING
        )
    }

    private fun unbindService() {
        if (isBound) {
            applicationContext?.unbindService(serviceConnection)
            isBound = false
            service = null
        }
    }

    private fun hasNotificationAccess(context: Context): Boolean {
        val enabledListeners = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
        )
        return enabledListeners?.contains(context.packageName) == true
    }

    override fun onCleared() {
        super.onCleared()
        unbindService()
    }
}
