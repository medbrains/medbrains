package com.medbrains.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

/**
 * Material 3 Expressive over the Carbon tokens. The colour roles, the type
 * scale (IBM Plex) and the shapes (Carbon has no radius) are the brand's;
 * the motion and components are Material's. Screens name a role from
 * [androidx.compose.material3.MaterialTheme], never a hex. Light only, as
 * the web is.
 */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun MedBrainsTheme(content: @Composable () -> Unit) {
    val scheme = lightColorScheme(
        primary = Carbon.blue[5],
        onPrimary = Carbon.ink[0],
        primaryContainer = Carbon.blue[0],
        onPrimaryContainer = Carbon.blue[7],
        secondary = Carbon.ink[7],
        onSecondary = Carbon.ink[0],
        secondaryContainer = Carbon.blue[0],
        onSecondaryContainer = Carbon.blue[6],
        tertiary = Carbon.mint[4],
        error = Carbon.rose[5],
        onError = Carbon.ink[0],
        errorContainer = Carbon.rose[0],
        onErrorContainer = Carbon.rose[6],
        background = Carbon.ink[0],
        onBackground = Carbon.ink[10],
        surface = Carbon.ink[0],
        onSurface = Carbon.ink[10],
        surfaceVariant = Carbon.ink[1],
        onSurfaceVariant = Carbon.ink[7],
        surfaceContainer = Carbon.ink[0],
        surfaceContainerLow = Carbon.ink[1],
        surfaceContainerHigh = Carbon.ink[1],
        surfaceContainerHighest = Carbon.ink[2],
        outline = Carbon.ink[5],
        outlineVariant = Carbon.ink[2],
    )
    val sharp = RoundedCornerShape(0.dp)
    MaterialExpressiveTheme(
        colorScheme = scheme,
        typography = CarbonTypography,
        shapes = Shapes(extraSmall = sharp, small = sharp, medium = sharp, large = sharp, extraLarge = sharp),
        motionScheme = MotionScheme.expressive(),
        content = content,
    )
}

/** Carbon-for-mobile: 48dp is Material's floor and the phone target. */
const val TAP_TARGET_DP = 48
