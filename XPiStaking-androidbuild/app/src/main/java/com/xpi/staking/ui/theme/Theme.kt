package com.xpi.staking.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PiPurple = Color(0xFF7B2CBF)
private val PiPurpleDark = Color(0xFF5A189A)
private val Bg = Color(0xFF121212)
private val Surface = Color(0xFF1E1E1E)

private val Colors = darkColorScheme(
    primary = PiPurple,
    secondary = PiPurpleDark,
    background = Bg,
    surface = Surface,
    onPrimary = Color.White,
    onBackground = Color.White,
    onSurface = Color.White
)

@Composable
fun XPiStakingTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, content = content)
}
