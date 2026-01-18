package com.listeningwith.host.queue

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class QueueManager {
    private val queue = mutableListOf<QueuedSong>()

    private val _queueState = MutableStateFlow<List<QueuedSong>>(emptyList())
    val queueState: StateFlow<List<QueuedSong>> = _queueState.asStateFlow()

    private val _nowPlaying = MutableStateFlow<QueuedSong?>(null)
    val nowPlaying: StateFlow<QueuedSong?> = _nowPlaying.asStateFlow()

    @Synchronized
    fun add(song: QueuedSong) {
        queue.add(song)
        _queueState.value = queue.toList()
    }

    @Synchronized
    fun poll(): QueuedSong? {
        if (queue.isEmpty()) return null
        val song = queue.removeAt(0)
        _nowPlaying.value = song
        _queueState.value = queue.toList()
        return song
    }

    @Synchronized
    fun peek(): QueuedSong? {
        return queue.firstOrNull()
    }

    fun getAll(): List<QueuedSong> = queue.toList()

    fun size(): Int = queue.size

    fun isEmpty(): Boolean = queue.isEmpty()

    @Synchronized
    fun clear() {
        queue.clear()
        _queueState.value = emptyList()
        _nowPlaying.value = null
    }

    fun clearNowPlaying() {
        _nowPlaying.value = null
    }
}
