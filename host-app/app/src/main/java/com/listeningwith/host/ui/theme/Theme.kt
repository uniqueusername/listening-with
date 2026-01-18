package com.listeningwith.host.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val Purple = Color(0xFF6750A4)
private val PurpleLight = Color(0xFFD0BCFF)
private val Teal = Color(0xFF03DAC6)

private val DarkColorScheme = darkColorScheme(
    primary = PurpleLight,
    secondary = Teal,
    surface = Color(0xFF1C1B1F),
    background = Color(0xFF1C1B1F)
)

private val LightColorScheme = lightColorScheme(
    primary = Purple,
    secondary = Teal,
    surface = Color.White,
    background = Color(0xFFFFFBFE)
)

@Composable
fun ListeningWithTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
