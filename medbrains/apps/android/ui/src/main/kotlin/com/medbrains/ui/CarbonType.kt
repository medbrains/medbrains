package com.medbrains.ui

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** IBM Plex, the Carbon face, bundled as res/font (SIL OFL 1.1). */
val PlexSans = FontFamily(
    Font(R.font.ibm_plex_sans_light, FontWeight.Light),
    Font(R.font.ibm_plex_sans_regular, FontWeight.Normal),
    Font(R.font.ibm_plex_sans_medium, FontWeight.Medium),
    Font(R.font.ibm_plex_sans_semibold, FontWeight.SemiBold),
)
val PlexMono = FontFamily(Font(R.font.ibm_plex_mono_regular, FontWeight.Normal))

/**
 * Carbon's productive type scale on Material's roles: display/headline are
 * the light headings, body is 16/14, label the 12px helper. sp throughout,
 * so font scaling still applies.
 */
val CarbonTypography = Typography(
    displaySmall = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Light, fontSize = 42.sp, lineHeight = 50.sp),
    headlineLarge = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Light, fontSize = 32.sp, lineHeight = 40.sp),
    headlineMedium = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 28.sp, lineHeight = 36.sp),
    headlineSmall = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 20.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 20.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp),
    bodyLarge = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    labelMedium = TextStyle(fontFamily = PlexSans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.32.sp),
    labelSmall = TextStyle(fontFamily = PlexMono, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 1.6.sp),
)

/** Carbon code / metadata text (UHIDs, permission codes, timestamps). */
val CodeText = TextStyle(fontFamily = PlexMono, fontSize = 14.sp, lineHeight = 20.sp)
