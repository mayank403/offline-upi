package com.offlineupi.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val EmeraldPrimary = Color(0xFF10B981)
val EmeraldDark = Color(0xFF047857)
val CyanAccent = Color(0xFF06B6D4)
val DarkBackground = Color(0xFF090D16)
val DarkSurface = Color(0xFF131B2C)
val TextLight = Color(0xFFF8FAFC)
val TextMuted = Color(0xFF94A3B8)

private val DarkColorScheme = darkColorScheme(
    primary = EmeraldPrimary,
    secondary = CyanAccent,
    background = DarkBackground,
    surface = DarkSurface,
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onBackground = TextLight,
    onSurface = TextLight
)

@Composable
fun OfflineUPITheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
