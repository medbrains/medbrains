package com.medbrains.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Carbon's tag tones. The word is always there — colour never carries the meaning alone. */
enum class CarbonTone(val fill: Color, val ink: Color, val bar: Color) {
    Neutral(Carbon.ink[2], Carbon.ink[8], Carbon.ink[5]),
    Info(Carbon.blue[1], Carbon.blue[7], Carbon.blue[5]),
    Success(Carbon.mint[1], Carbon.mint[7], Carbon.mint[4]),
    Warning(Carbon.amber[0], Carbon.amber[7], Carbon.amber[2]),
    Danger(Carbon.rose[1], Carbon.rose[7], Carbon.rose[5]),
    HighAlert(Carbon.ochre[1], Carbon.ochre[8], Carbon.ochre[5]),
}

@Composable
fun CarbonTag(text: String, tone: CarbonTone = CarbonTone.Neutral, mono: Boolean = false, modifier: Modifier = Modifier) {
    Text(
        text,
        style = if (mono) CodeText.copy(fontSize = MaterialTheme.typography.labelMedium.fontSize) else MaterialTheme.typography.labelMedium,
        color = tone.ink,
        maxLines = 1,
        modifier = modifier.background(tone.fill).padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

enum class NotificationKind(val tone: CarbonTone) { Info(CarbonTone.Info), Success(CarbonTone.Success), Warning(CarbonTone.Warning), Error(CarbonTone.Danger) }

/** Carbon's inline notification: Layer-01 tile, 3dp bar, icon, title, message, optional actions. */
@Composable
fun CarbonNotification(kind: NotificationKind, title: String, message: String, modifier: Modifier = Modifier, actions: (@Composable () -> Unit)? = null) {
    val icon = when (kind) {
        NotificationKind.Info -> Icons.Filled.Info
        NotificationKind.Success -> Icons.Filled.CheckCircle
        NotificationKind.Warning -> Icons.Filled.Warning
        NotificationKind.Error -> Icons.Filled.Error
    }
    Row(modifier.fillMaxWidth().height(IntrinsicSize.Min).background(Carbon.ink[1]).semantics(mergeDescendants = true) { contentDescription = "$title. $message" }) {
        Box(Modifier.width(3.dp).fillMaxHeight().background(kind.tone.bar))
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Icon(icon, contentDescription = null, tint = kind.tone.bar)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(message, style = MaterialTheme.typography.bodyMedium)
                actions?.invoke()
            }
        }
    }
}

/** Carbon tile with a tone bar, for cards and rows that carry a state. */
@Composable
fun CarbonTonedTile(tone: CarbonTone, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Row(modifier.fillMaxWidth().height(IntrinsicSize.Min).background(Carbon.ink[1])) {
        Box(Modifier.width(3.dp).fillMaxHeight().background(tone.bar))
        Column(Modifier.padding(16.dp).fillMaxWidth()) { content() }
    }
}

/** Carbon's tertiary button: outlined, Blue 60, label left. */
@Composable
fun CarbonTertiaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = MaterialTheme.shapes.small,
        modifier = modifier.height(TAP_TARGET_DP.dp),
    ) { Text(text, style = MaterialTheme.typography.bodyLarge) }
}

/** Carbon's danger button: Red 60 fill, for the act that cannot be undone. */
@Composable
fun CarbonDangerButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = MaterialTheme.shapes.small,
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
        modifier = modifier.fillMaxWidth().height(TAP_TARGET_DP.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(text, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.weight(1f))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
        }
    }
}

/** The page header every module screen opens with. */
@Composable
fun CarbonPageHeader(eyebrow: String, title: String, subtitle: String? = null, trailing: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f)) {
            Eyebrow(eyebrow)
            Text(title, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onSurface)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        trailing?.invoke()
    }
}

/** A Carbon stat tile: eyebrow, a large number (or an em dash), a caption. */
@Composable
fun CarbonStatTile(eyebrow: String, count: Int?, title: String, modifier: Modifier = Modifier) {
    Column(modifier.background(Carbon.ink[1]).padding(16.dp)) {
        Eyebrow(eyebrow)
        Text(count?.toString() ?: "—", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.semantics { contentDescription = count?.toString() ?: "not available" })
        Text(title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** A tappable structured-list row with a trailing slot. */
@Composable
fun CarbonActionRow(title: String, detail: String?, onClick: () -> Unit, modifier: Modifier = Modifier, trailing: (@Composable () -> Unit)? = null) {
    Row(
        modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
            if (detail != null) Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        trailing?.invoke()
    }
    androidx.compose.material3.HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
