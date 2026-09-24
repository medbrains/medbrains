package com.medbrains.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

/**
 * Carbon's text input: label above, a Field-01 (Gray 10) box with a 1px
 * bottom border that becomes 2px Blue 60 on focus, error below in Red 60.
 * Material's filled TextField already has that anatomy; this only names the
 * Carbon colours and removes the radius.
 */
@Composable
fun CarbonTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    singleLine: Boolean = true,
) {
    // The caller's modifier (test tag, focus requester) belongs to the field, not the label.
    Column(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        TextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            minLines = if (singleLine) 1 else 3,
            isError = error != null,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            textStyle = MaterialTheme.typography.bodyLarge,
            shape = MaterialTheme.shapes.small,
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Carbon.ink[1],
                unfocusedContainerColor = Carbon.ink[1],
                errorContainerColor = Carbon.ink[1],
                focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                unfocusedIndicatorColor = MaterialTheme.colorScheme.outline,
                errorIndicatorColor = MaterialTheme.colorScheme.error,
            ),
            modifier = modifier.fillMaxWidth().heightIn(min = TAP_TARGET_DP.dp),
        )
        if (error != null) {
            Spacer(Modifier.height(4.dp))
            Text(error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
    }
}

/** Carbon's primary button: full width, 48dp, label left, glyph right, Blue 60, no radius. */
@Composable
fun CarbonPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = MaterialTheme.shapes.small,
        contentPadding = ButtonDefaults.ContentPadding,
        colors = ButtonDefaults.buttonColors(disabledContainerColor = Carbon.ink[1], disabledContentColor = Carbon.ink[3]),
        modifier = modifier.fillMaxWidth().height(TAP_TARGET_DP.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(text, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.weight(1f))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
        }
    }
}

/** Carbon eyebrow: Plex Mono, uppercase, tracked. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) {
    Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier)
}

/** Carbon structured-list row: text left, hairline below. */
@Composable
fun CarbonRow(title: String, detail: String? = null, mono: Boolean = false) {
    Column(Modifier.fillMaxWidth().heightIn(min = TAP_TARGET_DP.dp).padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(title, style = if (mono) CodeText else MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
        if (detail != null) Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

/** Carbon section heading with the grid's 16dp inset. */
@Composable
fun CarbonSectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 8.dp))
}

/** A Carbon notification tile: Layer-01 box with a 3dp interactive bar on the left. */
@Composable
fun CarbonTile(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Row(modifier.fillMaxWidth().height(IntrinsicSize.Min).background(Carbon.ink[1])) {
        Box(Modifier.width(3.dp).fillMaxHeight().background(MaterialTheme.colorScheme.primary))
        Column(Modifier.padding(16.dp)) { content() }
    }
}
