package com.listeningwith.host.media

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log

class PlaybackController(private val context: Context) {
    companion object {
        private const val TAG = "PlaybackController"
        private const val YTM_PACKAGE = "com.google.android.apps.youtube.music"
    }

    sealed class PlaybackResult {
        object Success : PlaybackResult()
        object YtmNotInstalled : PlaybackResult()
        data class Error(val message: String) : PlaybackResult()
    }

    fun playYouTubeMusicSong(videoId: String): PlaybackResult {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("https://music.youtube.com/watch?v=$videoId")
                setPackage(YTM_PACKAGE)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            Log.d(TAG, "triggered playback for video: $videoId")
            PlaybackResult.Success
        } catch (e: ActivityNotFoundException) {
            Log.e(TAG, "youtube music not installed", e)
            PlaybackResult.YtmNotInstalled
        } catch (e: Exception) {
            Log.e(TAG, "error playing song", e)
            PlaybackResult.Error(e.message ?: "unknown error")
        }
    }

    fun isYouTubeMusicInstalled(): Boolean {
        return try {
            context.packageManager.getPackageInfo(YTM_PACKAGE, 0)
            true
        } catch (e: Exception) {
            false
        }
    }
}
