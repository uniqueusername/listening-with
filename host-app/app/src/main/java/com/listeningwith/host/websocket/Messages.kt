package com.listeningwith.host.websocket

import com.google.gson.Gson
import com.google.gson.JsonParser
import com.listeningwith.host.queue.QueuedSong

// Outgoing messages (host -> server)

sealed class ClientMessage {
    abstract fun toJson(): String

    data class CreateRoom(val baseUrl: String? = null) : ClientMessage() {
        override fun toJson(): String {
            return if (baseUrl != null) {
                """{"type":"create_room","baseUrl":"$baseUrl"}"""
            } else {
                """{"type":"create_room"}"""
            }
        }
    }

    object Heartbeat : ClientMessage() {
        override fun toJson(): String = """{"type":"heartbeat"}"""
    }

    data class UpdateQueue(
        val queue: List<QueuedSong>,
        val nowPlaying: QueuedSong?
    ) : ClientMessage() {
        override fun toJson(): String {
            val gson = Gson()
            return gson.toJson(mapOf(
                "type" to "update_queue",
                "queue" to queue,
                "nowPlaying" to nowPlaying
            ))
        }
    }
}

// Incoming messages (server -> host)

sealed class ServerMessage {
    companion object {
        private val gson = Gson()

        fun parse(json: String): ServerMessage? {
            return try {
                val jsonObject = JsonParser.parseString(json).asJsonObject
                val type = jsonObject.get("type")?.asString

                when (type) {
                    "room_created" -> RoomCreated(
                        code = jsonObject.get("code").asString,
                        qrCodeDataUrl = jsonObject.get("qrCodeDataUrl").asString,
                        joinUrl = jsonObject.get("joinUrl").asString
                    )
                    "client_joined" -> ClientJoined(
                        clientId = jsonObject.get("clientId").asString,
                        displayName = jsonObject.get("displayName")?.asString,
                        clientCount = jsonObject.get("clientCount").asInt
                    )
                    "client_left" -> ClientLeft(
                        clientId = jsonObject.get("clientId").asString,
                        clientCount = jsonObject.get("clientCount").asInt
                    )
                    "song_added" -> {
                        val songObj = jsonObject.getAsJsonObject("song")
                        SongAdded(
                            song = QueuedSong(
                                videoId = songObj.get("videoId").asString,
                                title = songObj.get("title").asString,
                                artist = songObj.get("artist").asString,
                                submittedBy = songObj.get("submittedBy")?.asString
                            ),
                            queueLength = jsonObject.get("queueLength").asInt
                        )
                    }
                    "heartbeat_ack" -> HeartbeatAck
                    "room_closed" -> RoomClosed(
                        reason = jsonObject.get("reason")?.asString ?: "unknown"
                    )
                    "error" -> Error(
                        message = jsonObject.get("message")?.asString ?: "unknown error"
                    )
                    else -> null
                }
            } catch (e: Exception) {
                null
            }
        }
    }

    data class RoomCreated(
        val code: String,
        val qrCodeDataUrl: String,
        val joinUrl: String
    ) : ServerMessage()

    data class ClientJoined(
        val clientId: String,
        val displayName: String?,
        val clientCount: Int
    ) : ServerMessage()

    data class ClientLeft(
        val clientId: String,
        val clientCount: Int
    ) : ServerMessage()

    data class SongAdded(
        val song: QueuedSong,
        val queueLength: Int
    ) : ServerMessage()

    object HeartbeatAck : ServerMessage()

    data class RoomClosed(
        val reason: String
    ) : ServerMessage()

    data class Error(
        val message: String
    ) : ServerMessage()
}
