package com.listeningwith.host.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.listeningwith.host.queue.QueuedSong

@Composable
fun QueueList(
    primaryQueue: List<QueuedSong>,
    auxiliaryQueue: List<QueuedSong>,
    modifier: Modifier = Modifier
) {
    val totalSize = primaryQueue.size + auxiliaryQueue.size

    Column(modifier = modifier) {
        if (totalSize == 0) {
            Text(
                text = "up next (0)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "no songs in queue",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            LazyColumn {
                // Primary Queue Section
                if (primaryQueue.isNotEmpty()) {
                    item {
                        Text(
                            text = "up next (${primaryQueue.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    itemsIndexed(primaryQueue) { index, song ->
                        QueueItem(
                            position = index + 1,
                            song = song,
                            isAuxiliary = false,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                }

                // Auxiliary Queue Section
                if (auxiliaryQueue.isNotEmpty()) {
                    item {
                        val sourceName = auxiliaryQueue.firstOrNull()?.source?.name ?: "playlist"
                        val sourceType = auxiliaryQueue.firstOrNull()?.source?.type ?: "playlist"
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "from $sourceType ($sourceName)",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF9333EA), // Purple color
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    itemsIndexed(auxiliaryQueue) { index, song ->
                        QueueItem(
                            position = primaryQueue.size + index + 1,
                            song = song,
                            isAuxiliary = true,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QueueItem(
    position: Int,
    song: QueuedSong,
    isAuxiliary: Boolean,
    modifier: Modifier = Modifier
) {
    val containerColor = if (isAuxiliary) {
        Color(0xFFF3E8FF) // Light purple
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }

    val accentColor = if (isAuxiliary) {
        Color(0xFF9333EA) // Purple
    } else {
        MaterialTheme.colorScheme.primary
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = containerColor
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$position.",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                color = accentColor
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${song.title} - ${song.artist}",
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = song.submittedBy ?: "anonymous",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isAuxiliary) Color(0xFF9333EA) else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
