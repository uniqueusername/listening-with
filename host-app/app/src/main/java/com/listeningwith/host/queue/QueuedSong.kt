package com.listeningwith.host.queue

data class SongSource(
    val type: String,  // "search", "playlist", "album"
    val id: String? = null,
    val name: String? = null
)

data class QueuedSong(
    val videoId: String,
    val title: String,
    val artist: String,
    val submittedBy: String?,
    val addedAt: Long = System.currentTimeMillis(),
    val source: SongSource? = null
)
