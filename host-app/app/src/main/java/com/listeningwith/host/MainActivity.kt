package com.listeningwith.host

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.listeningwith.host.ui.screens.ConnectingScreen
import com.listeningwith.host.ui.screens.IdleScreen
import com.listeningwith.host.ui.screens.PermissionScreen
import com.listeningwith.host.ui.screens.RoomScreen
import com.listeningwith.host.ui.theme.ListeningWithTheme

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // We don't need runtime notification permission for this to work,
        // but it's good practice on Android 13+
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        viewModel.initialize(this)

        // Request notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        setContent {
            ListeningWithTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val state by viewModel.uiState.collectAsState()

                    when (state.screen) {
                        Screen.Idle -> IdleScreen(
                            onCreateRoom = viewModel::createRoom,
                            customUrl = state.customUrl,
                            isCustomUrlVisible = state.isCustomUrlVisible,
                            onToggleCustomUrl = viewModel::toggleCustomUrl,
                            onUpdateCustomUrl = viewModel::updateCustomUrl
                        )

                        Screen.Connecting -> ConnectingScreen(
                            error = state.error,
                            onRetry = viewModel::retryConnection,
                            onCancel = viewModel::endRoom
                        )

                        Screen.RoomActive -> RoomScreen(
                            roomCode = state.roomCode,
                            listenerCount = state.listenerCount,
                            qrCodeBitmap = state.qrCodeBitmap,
                            nowPlaying = state.nowPlaying,
                            queue = state.queue,
                            onEndRoom = viewModel::endRoom
                        )

                        Screen.PermissionRequired -> {
                            val (title, description) = when (state.missingPermission) {
                                MissingPermission.NOTIFICATION_LISTENER -> "notification access required" to "this app needs notification access to detect when songs end on youtube music."
                                MissingPermission.SYSTEM_ALERT_WINDOW -> "overlay permission required" to "this app needs 'display over other apps' permission to open youtube music from the background."
                                else -> "permission required" to "please grant the required permissions."
                            }

                            PermissionScreen(
                                title = title,
                                description = description,
                                onOpenSettings = viewModel::resolvePermissionError,
                                onCheckAgain = {
                                    viewModel.checkPermissions()
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.checkPermissions()
    }
}
