package com.medbrains.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The MedBrains mark, drawn — the same five shapes as the web's medbrains-mark.svg. */
@Composable
fun BrandMark(size: Dp = 40.dp, modifier: Modifier = Modifier) {
    val blue = Carbon.blue[5]
    val green = Carbon.mint[3]
    Canvas(modifier.size(size)) {
        val s = this.size.width / 44f
        drawRoundRect(blue, cornerRadius = CornerRadius(3 * s))
        drawArc(Color.White.copy(alpha = 0.3f), 180f, 180f, false, topLeft = Offset(9 * s, 16 * s), size = Size(26 * s, 26 * s), style = Stroke(1.25f * s, cap = StrokeCap.Round))
        val trace = Path().apply {
            moveTo(7 * s, 29 * s)
            listOf(14f to 29f, 16.5f to 24f, 18.5f to 33f, 21f to 16f, 23.5f to 29f, 29f to 29f).forEach { (x, y) -> lineTo(x * s, y * s) }
        }
        drawPath(trace, Color.White, style = Stroke(2 * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawLine(green, Offset(29 * s, 29 * s), Offset(35 * s, 29 * s), strokeWidth = 2 * s, cap = StrokeCap.Round)
        drawCircle(green, radius = 2 * s, center = Offset(29 * s, 29 * s))
    }
}

/** Mark plus the name, in the brand face. The login screens open with it. */
@Composable
fun BrandWordmark(height: Dp = 32.dp, modifier: Modifier = Modifier) {
    Row(modifier.semantics(mergeDescendants = true) { contentDescription = "MedBrains" }, verticalAlignment = Alignment.CenterVertically) {
        BrandMark(height)
        Spacer(Modifier.width(height * 0.3f))
        Text("MedBrains", fontFamily = PlexSans, fontWeight = FontWeight.SemiBold, fontSize = (height.value * 0.62f).sp, letterSpacing = (-0.5).sp, color = MaterialTheme.colorScheme.onBackground)
    }
}
