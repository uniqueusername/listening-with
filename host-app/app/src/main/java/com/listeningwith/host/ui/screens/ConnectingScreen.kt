package com.listeningwith.host.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ConnectingScreen(
    error: String?,
    onRetry: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (error != null) {
            Text(
                text = error,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error
            )

            Spacer(modifier = Modifier.height(24.dp))

            TextButton(onClick = onRetry) {
                Text("retry")
            }

            TextButton(onClick = onCancel) {
                Text("cancel")
            }
        } else {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "connecting...",
                style = MaterialTheme.typography.bodyLarge
            )

            Spacer(modifier = Modifier.height(16.dp))

            TextButton(onClick = onCancel) {
                Text("cancel")
            }
        }
    }
}
