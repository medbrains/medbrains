package com.medbrains.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.RemoteState

/**
 * Renders a `RemoteState` the way every device screen must: a loader, a
 * named outage with a retry (never a blank, never an empty list), the empty
 * state in words, or the content. `id` seeds the test tags the journeys look
 * for: `<id>-list` and `<id>-empty`.
 */
@Composable
fun <T> RemoteContent(
    id: String,
    state: RemoteState<T>,
    unavailableTitle: String,
    unavailableMessage: String,
    isEmpty: (T) -> Boolean,
    emptyTitle: String,
    emptyMessage: String,
    retry: () -> Unit,
    content: @Composable (T) -> Unit,
) {
    when (state) {
        RemoteState.Loading -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        is RemoteState.Failed -> CarbonNotification(
            kind = NotificationKind.Error,
            title = unavailableTitle,
            message = "$unavailableMessage (${state.message})",
            modifier = Modifier.padding(16.dp).testTag("$id-unavailable"),
        ) { TextButton(onClick = retry) { Text("Try again") } }
        is RemoteState.Loaded -> if (isEmpty(state.value)) {
            Column(Modifier.fillMaxWidth().padding(16.dp).testTag("$id-empty")) {
                Text(emptyTitle, style = MaterialTheme.typography.titleMedium)
                Text(emptyMessage, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            Box(Modifier.testTag("$id-list")) { content(state.value) }
        }
    }
}
