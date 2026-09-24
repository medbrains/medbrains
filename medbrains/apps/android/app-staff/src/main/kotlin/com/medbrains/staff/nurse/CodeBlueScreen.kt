package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.Carbon
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CodeText
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** More than this many simultaneous arrests is a disaster, not a list. */
private const val PAGE_SIZE = 20
private const val POLL_MS = 5_000L

/**
 * The arrests in progress, on the phone the page reaches. One act,
 * **Responding**, deliberately not "Seen": the server records an arrival.
 * Polls every five seconds while on screen; the effect ends with the screen.
 */
@Composable
fun CodeBlueScreen(api: NurseApi) {
    val identity = LocalIdentity.current
    val events = remember { Remote<List<CodeBlueEvent>>() }
    val responders = remember { Remote<List<CodeBlueResponder>>() }
    val scope = rememberCoroutineScope()
    suspend fun loadOnce() {
        events.load { api.listActiveCodeBlues() }
        responders.load { api.listCodeBlueResponders() }
    }
    LaunchedEffect(Unit) {
        events.poll(POLL_MS) {
            val rows = api.listActiveCodeBlues()
            // Responders only matter while something is active; no arrest, no second call.
            if (rows.isEmpty()) responders.load { emptyList() } else responders.load { api.listCodeBlueResponders() }
            rows
        }
    }
    val state by events.state.collectAsState()
    val stale by events.staleSince.collectAsState()
    val active = state.value.orEmpty().take(PAGE_SIZE)
    val byEvent = (responders.state.collectAsState().value.value ?: emptyList()).groupBy { it.code_blue_id }

    Column(Modifier.fillMaxSize().testTag("screen-code-blue")) {
        CarbonPageHeader("Code blue", "Arrests in progress", "Answer the page here. The first answer is the team's arrival time.") {
            if (active.isNotEmpty()) CarbonTag("${active.size} active", CarbonTone.Danger)
        }
        stale?.let {
            CarbonNotification(NotificationKind.Warning, "Not refreshing", "Showing what was known at ${DateTimeFormatter.ofPattern("HH:mm").format(it.atZone(ZoneId.systemDefault()))}. Do not read this as none in progress.", Modifier.padding(horizontal = 16.dp))
        }
        RemoteContent(
            id = "code-blue", state = state,
            unavailableTitle = "Code blue board unavailable",
            unavailableMessage = "Arrests could not be loaded. Do not read this as none in progress — go to the ward or call the switchboard.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No arrest in progress", emptyMessage = "Nothing has been called.",
            retry = { scope.launch { loadOnce() } },
        ) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(active, key = { it.id }) { event ->
                    ArrestRow(api, event, byEvent[event.id].orEmpty(), identity?.userId, identity?.can("nurse.code_blue.respond") == true) { scope.launch { loadOnce() } }
                }
            }
        }
    }
}

@Composable
private fun ArrestRow(api: NurseApi, event: CodeBlueEvent, responders: List<CodeBlueResponder>, me: String?, canRespond: Boolean, onChanged: () -> Unit) {
    val responded = responders.any { it.user_id == me }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val now by produceState(Instant.now()) { while (true) { delay(1000); value = Instant.now() } }
    CarbonTonedTile(CarbonTone.Danger) {
        Row(Modifier.fillMaxWidth()) {
            Text(event.location, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            CarbonTag("ACTIVE", CarbonTone.Danger)
        }
        Text(sinceLabel(event.started_at, now), style = CodeText, color = MaterialTheme.colorScheme.onSurfaceVariant)
        // "Nobody yet" is the most important state this list has. It must be words, never a blank.
        val first = responders.firstOrNull()
        if (first != null) {
            Text("First on scene: ${first.user_name} (+${first.seconds_after_call}s)" + if (responders.size > 1) " · ${responders.size - 1} more responding" else "", style = MaterialTheme.typography.bodyLarge)
        } else {
            Text("Nobody has responded yet.", style = MaterialTheme.typography.bodyLarge, color = Carbon.amber[6], modifier = Modifier.testTag("code-blue-nobody-${event.id}"))
        }
        if (canRespond) {
            CarbonPrimaryButton(
                if (responded) "You are responding" else "Responding",
                onClick = { scope.launch { busy = true; try { api.respondToCodeBlue(event.id); onChanged() } catch (_: Exception) {} finally { busy = false } } },
                enabled = !busy && !responded,
                modifier = Modifier.testTag("code-blue-respond").semantics { contentDescription = if (responded) "You are responding to the code blue at ${event.location}" else "Respond to the code blue at ${event.location}" },
            )
        }
    }
}

fun sinceLabel(startedAt: String, now: Instant): String {
    val started = ServerTime.parse(startedAt) ?: return ""
    val s = maxOf(0L, now.epochSecond - started.epochSecond)
    return "${s / 60}m ${s % 60}s since the call"
}
