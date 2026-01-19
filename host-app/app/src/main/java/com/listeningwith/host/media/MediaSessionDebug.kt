package com.listeningwith.host.media

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.util.Log
import com.listeningwith.host.service.NotificationListener

/**
 * Debug utility to investigate what YouTube Music exposes via MediaSession.
 * Run this to see what queue/metadata info is available.
 */
object MediaSessionDebug {
    private const val TAG = "MediaSessionDebug"
    private const val YTM_PACKAGE = "com.google.android.apps.youtube.music"

    fun investigateYouTubeMusic(context: Context): String {
        val report = StringBuilder()
        report.appendLine("=== YouTube Music MediaSession Investigation ===\n")

        try {
            val mediaSessionManager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
            val componentName = ComponentName(context, NotificationListener::class.java)
            val controllers = mediaSessionManager.getActiveSessions(componentName)

            val ytmController = controllers.find { it.packageName == YTM_PACKAGE }

            if (ytmController == null) {
                report.appendLine("YouTube Music session NOT FOUND")
                report.appendLine("Active sessions: ${controllers.map { it.packageName }}")
                return report.toString()
            }

            report.appendLine("YouTube Music session FOUND\n")

            // Check metadata
            report.appendLine("--- METADATA ---")
            val metadata = ytmController.metadata
            if (metadata != null) {
                report.appendLine("Title: ${metadata.getString(MediaMetadata.METADATA_KEY_TITLE)}")
                report.appendLine("Artist: ${metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)}")
                report.appendLine("Album: ${metadata.getString(MediaMetadata.METADATA_KEY_ALBUM)}")
                report.appendLine("Media ID: ${metadata.getString(MediaMetadata.METADATA_KEY_MEDIA_ID)}")
                report.appendLine("Duration: ${metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)}ms")
                report.appendLine("Track Number: ${metadata.getLong(MediaMetadata.METADATA_KEY_TRACK_NUMBER)}")
                report.appendLine("Num Tracks: ${metadata.getLong(MediaMetadata.METADATA_KEY_NUM_TRACKS)}")
                report.appendLine("Display Title: ${metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)}")
                report.appendLine("Display Subtitle: ${metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)}")
                report.appendLine("Display Description: ${metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION)}")

                // Log all available keys
                report.appendLine("\nAll metadata keys:")
                metadata.keySet().forEach { key ->
                    val value = try {
                        metadata.getString(key) ?: metadata.getLong(key).toString()
                    } catch (e: Exception) {
                        "[binary/bitmap]"
                    }
                    report.appendLine("  $key = $value")
                }
            } else {
                report.appendLine("Metadata is NULL")
            }

            // Check playback state
            report.appendLine("\n--- PLAYBACK STATE ---")
            val playbackState = ytmController.playbackState
            if (playbackState != null) {
                report.appendLine("State: ${getStateName(playbackState.state)}")
                report.appendLine("Position: ${playbackState.position}ms")
                report.appendLine("Playback Speed: ${playbackState.playbackSpeed}")
                report.appendLine("Active Queue Item ID: ${playbackState.activeQueueItemId}")

                report.appendLine("\nCustom Actions:")
                playbackState.customActions.forEach { action ->
                    report.appendLine("  ${action.name}: ${action.action}")
                }
            } else {
                report.appendLine("PlaybackState is NULL")
            }

            // Check queue - THIS IS WHAT WE'RE MOST INTERESTED IN
            report.appendLine("\n--- QUEUE ---")
            val queue = ytmController.queue
            val queueTitle = ytmController.queueTitle

            report.appendLine("Queue Title: $queueTitle")

            if (queue != null && queue.isNotEmpty()) {
                report.appendLine("Queue Size: ${queue.size}")
                report.appendLine("\nQueue Items:")
                queue.forEachIndexed { index, item ->
                    val desc = item.description
                    report.appendLine("  [$index] ID=${item.queueId}")
                    report.appendLine("       Title: ${desc.title}")
                    report.appendLine("       Subtitle: ${desc.subtitle}")
                    report.appendLine("       Description: ${desc.description}")
                    report.appendLine("       MediaId: ${desc.mediaId}")
                    report.appendLine("       MediaUri: ${desc.mediaUri}")
                    report.appendLine("       IconUri: ${desc.iconUri}")
                }
            } else {
                report.appendLine("Queue is NULL or EMPTY")
            }

            // Check extras
            report.appendLine("\n--- EXTRAS ---")
            val extras = ytmController.extras
            if (extras != null && !extras.isEmpty) {
                report.appendLine("Extras keys: ${extras.keySet()}")
                extras.keySet().forEach { key ->
                    report.appendLine("  $key = ${extras.get(key)}")
                }
            } else {
                report.appendLine("Extras is NULL or EMPTY")
            }

            // Check transport controls / supported actions
            report.appendLine("\n--- SUPPORTED ACTIONS ---")
            val actions = playbackState?.actions ?: 0
            report.appendLine("Skip to Next: ${(actions and android.media.session.PlaybackState.ACTION_SKIP_TO_NEXT) != 0L}")
            report.appendLine("Skip to Previous: ${(actions and android.media.session.PlaybackState.ACTION_SKIP_TO_PREVIOUS) != 0L}")
            report.appendLine("Skip to Queue Item: ${(actions and android.media.session.PlaybackState.ACTION_SKIP_TO_QUEUE_ITEM) != 0L}")
            report.appendLine("Play from MediaId: ${(actions and android.media.session.PlaybackState.ACTION_PLAY_FROM_MEDIA_ID) != 0L}")
            report.appendLine("Play from Search: ${(actions and android.media.session.PlaybackState.ACTION_PLAY_FROM_SEARCH) != 0L}")

        } catch (e: Exception) {
            report.appendLine("ERROR: ${e.message}")
            Log.e(TAG, "Investigation failed", e)
        }

        val result = report.toString()
        Log.d(TAG, result)
        return result
    }

    private fun getStateName(state: Int): String {
        return when (state) {
            android.media.session.PlaybackState.STATE_PLAYING -> "PLAYING"
            android.media.session.PlaybackState.STATE_PAUSED -> "PAUSED"
            android.media.session.PlaybackState.STATE_STOPPED -> "STOPPED"
            android.media.session.PlaybackState.STATE_BUFFERING -> "BUFFERING"
            android.media.session.PlaybackState.STATE_NONE -> "NONE"
            android.media.session.PlaybackState.STATE_ERROR -> "ERROR"
            else -> "UNKNOWN($state)"
        }
    }
}
