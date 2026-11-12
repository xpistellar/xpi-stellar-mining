package com.xpi.staking.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Deep professional dark theme — navy / gold / soft purple (XPi mining identity). */
private val Gold = Color(0xFFE8B923)
private val GoldDim = Color(0xFFC9A227)
private val Navy = Color(0xFF0B1220)
private val NavySurface = Color(0xFF141C2E)
private val NavyCard = Color(0xFF1A2438)
private val AccentPurple = Color(0xFF8B5CF6)
private val AccentTeal = Color(0xFF2DD4BF)
private val TextPrimary = Color(0xFFF1F5F9)
private val TextSecondary = Color(0xFF94A3B8)
private val ErrorRed = Color(0xFFF87171)

private val Colors = darkColorScheme(
    primary = Gold,
    onPrimary = Color(0xFF1A1200),
    primaryContainer = Color(0xFF3D2E0A),
    onPrimaryContainer = Gold,
    secondary = AccentPurple,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFF2E1A5C),
    onSecondaryContainer = Color(0xFFE9D5FF),
    tertiary = AccentTeal,
    onTertiary = Color(0xFF003730),
    background = Navy,
    onBackground = TextPrimary,
    surface = NavySurface,
    onSurface = TextPrimary,
    surfaceVariant = NavyCard,
    onSurfaceVariant = TextSecondary,
    outline = Color(0xFF334155),
    error = ErrorRed,
    onError = Color.White
)

private val AppTypography = Typography(
    titleLarge = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        letterSpacing = 0.2.sp
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    labelLarge = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        letterSpacing = 0.4.sp
    ),
    labelSmall = TextStyle(
        fontSize = 11.sp,
        color = TextSecondary
    )
)

@Composable
fun XPiStakingTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Colors,
        typography = AppTypography,
        content = content
    )
}
