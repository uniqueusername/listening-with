package com.listeningwith.host.queue

data class QueuedSong(
    val videoId: String,
    val title: String,
    val artist: String,
    val submittedBy: String?,
    val addedAt: Long = System.currentTimeMillis()
)
