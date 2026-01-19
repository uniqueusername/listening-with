package com.listeningwith.host.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun IdleScreen(
    onCreateRoom: () -> Unit,
    customUrl: String,
    webClientBaseUrl: String,
    isCustomUrlVisible: Boolean,
    onToggleCustomUrl: () -> Unit,
    onUpdateCustomUrl: (String) -> Unit,
    onUpdateWebClientBaseUrl: (String) -> Unit,
    onInvestigateMediaSession: (() -> String)? = null,
    modifier: Modifier = Modifier
) {
    var debugReport by remember { mutableStateOf<String?>(null) }
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            painter = painterResource(android.R.drawable.ic_menu_share),
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "listening-with",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "create a room for your friends to add songs to your youtube music queue",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(48.dp))

        Button(
            onClick = onCreateRoom,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("create room")
        }

        Spacer(modifier = Modifier.height(24.dp))

        TextButton(onClick = onToggleCustomUrl) {
            Text(if (isCustomUrlVisible) "hide server settings" else "configure server")
        }

        if (isCustomUrlVisible) {
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = customUrl,
                onValueChange = onUpdateCustomUrl,
                label = { Text("server url") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = webClientBaseUrl,
                onValueChange = onUpdateWebClientBaseUrl,
                label = { Text("web client url") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Debug button for MediaSession investigation
            if (onInvestigateMediaSession != null) {
                Spacer(modifier = Modifier.height(16.dp))
                TextButton(
                    onClick = { debugReport = onInvestigateMediaSession() }
                ) {
                    Text("investigate ytm mediasession")
                }
            }
        }

        // Show debug report if available
        if (debugReport != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(8.dp)
            ) {
                Text(
                    text = debugReport!!,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    lineHeight = 12.sp
                )
            }
            TextButton(onClick = { debugReport = null }) {
                Text("close report")
            }
        }
    }
}
