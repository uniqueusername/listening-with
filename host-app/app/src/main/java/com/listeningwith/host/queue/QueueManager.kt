package com.listeningwith.host.queue

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class QueueManager {
    private val primaryQueue = mutableListOf<QueuedSong>()
    private val auxiliaryQueue = mutableListOf<QueuedSong>()

    private val _primaryQueueState = MutableStateFlow<List<QueuedSong>>(emptyList())
    val primaryQueueState: StateFlow<List<QueuedSong>> = _primaryQueueState.asStateFlow()

    private val _auxiliaryQueueState = MutableStateFlow<List<QueuedSong>>(emptyList())
    val auxiliaryQueueState: StateFlow<List<QueuedSong>> = _auxiliaryQueueState.asStateFlow()

    private val _nowPlaying = MutableStateFlow<QueuedSong?>(null)
    val nowPlaying: StateFlow<QueuedSong?> = _nowPlaying.asStateFlow()

    @Synchronized
    fun addToPrimary(song: QueuedSong) {
        primaryQueue.add(song)
        _primaryQueueState.value = primaryQueue.toList()
    }

    @Synchronized
    fun addToAuxiliary(songs: List<QueuedSong>) {
        auxiliaryQueue.addAll(songs)
        _auxiliaryQueueState.value = auxiliaryQueue.toList()
    }

    @Synchronized
    fun poll(): QueuedSong? {
        // Primary queue takes precedence
        val song = if (primaryQueue.isNotEmpty()) {
            primaryQueue.removeAt(0).also {
                _primaryQueueState.value = primaryQueue.toList()
            }
        } else if (auxiliaryQueue.isNotEmpty()) {
            auxiliaryQueue.removeAt(0).also {
                _auxiliaryQueueState.value = auxiliaryQueue.toList()
            }
        } else {
            null
        }

        _nowPlaying.value = song
        return song
    }

    @Synchronized
    fun peek(): QueuedSong? {
        return primaryQueue.firstOrNull() ?: auxiliaryQueue.firstOrNull()
    }

    fun getPrimaryQueue(): List<QueuedSong> = primaryQueue.toList()

    fun getAuxiliaryQueue(): List<QueuedSong> = auxiliaryQueue.toList()

    fun totalSize(): Int = primaryQueue.size + auxiliaryQueue.size

    fun isEmpty(): Boolean = primaryQueue.isEmpty() && auxiliaryQueue.isEmpty()

    @Synchronized
    fun clear() {
        primaryQueue.clear()
        auxiliaryQueue.clear()
        _primaryQueueState.value = emptyList()
        _auxiliaryQueueState.value = emptyList()
        _nowPlaying.value = null
    }

    fun clearNowPlaying() {
        _nowPlaying.value = null
    }
}
