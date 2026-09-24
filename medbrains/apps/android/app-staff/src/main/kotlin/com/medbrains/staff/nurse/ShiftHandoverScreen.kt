package com.medbrains.staff.nurse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
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
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CodeText
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** Newest handovers only — the ward's history is unbounded, the screen is not. */
private const val PAGE_SIZE = 50

/**
 * SBAR shift handover for one encounter. Handovers addressed to the
 * signed-in nurse and not yet accepted come first — an unaccepted handover
 * is work nobody has taken responsibility for.
 */
@Composable
fun ShiftHandoverScreen(api: NurseApi, admission: AdmissionRow) {
    val identity = LocalIdentity.current
    val me = identity?.userId ?: ""
    val remote = remember { Remote<List<ShiftHandoff>>() }
    val scope = rememberCoroutineScope()
    suspend fun load() = remote.load { api.listHandoffs(admission.encounter_id) }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()
    val handoffs = state.value.orEmpty().take(PAGE_SIZE)
    val pending = handoffs.filter { it.incoming_nurse_id == me && it.incoming_signed_at == null }
    val carried = handoffs.filter { it.completed_at == null }.flatMap { it.alerts.orEmpty() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-handover")) {
        CarbonPageHeader("SBAR handover", admission.patient_name, "UHID ${admission.uhid}") {
            if (pending.isNotEmpty()) CarbonTag("${pending.size} to accept", CarbonTone.Danger)
        }
        if (carried.isNotEmpty()) {
            val critical = carried.filter { it.kind == "critical" }
            CarbonNotification(
                if (critical.isEmpty()) NotificationKind.Info else NotificationKind.Warning,
                if (critical.isEmpty()) "Carried over" else "Critical — carried over",
                (critical + carried.filter { it.kind == "task" }).joinToString("\n") { (if (it.kind == "critical") "! " else "• ") + it.note },
                Modifier.padding(horizontal = 16.dp),
            )
        }
        RemoteContent(
            id = "handover", state = state,
            unavailableTitle = "Handover unavailable", unavailableMessage = "The shift handover could not be loaded. Nothing has been signed.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No handover recorded", emptyMessage = "Nothing has been handed over for this encounter yet.",
            retry = { scope.launch { load() } },
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                handoffs.forEach { h -> HandoffRow(api, h, awaitingMe = h.incoming_nurse_id == me && h.incoming_signed_at == null) { scope.launch { load() } } }
            }
        }
        if (identity?.can("nurse.handoff.record") == true) ComposeHandover(api, admission.encounter_id, Modifier.padding(16.dp)) { scope.launch { load() } }
    }
}

@Composable
private fun HandoffRow(api: NurseApi, handoff: ShiftHandoff, awaitingMe: Boolean, onAccepted: () -> Unit) {
    var busy by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val tone = if (handoff.completed_at != null) CarbonTone.Success else if (awaitingMe) CarbonTone.Danger else CarbonTone.Info
    CarbonTonedTile(tone) {
        Row(Modifier.fillMaxWidth()) {
            Text(ServerTime.short(handoff.created_at), style = CodeText, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
            CarbonTag(if (handoff.completed_at != null) "Accepted" else if (awaitingMe) "Awaiting you" else "Awaiting nurse", tone)
        }
        Text(handoff.situation ?: "No situation recorded", style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(handoff.recommendation ?: "No recommendation recorded", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        // Accepting is a signature. A failure must read as "not signed", never as a silent success.
        if (failed) Text("Not accepted — try again.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        if (awaitingMe) {
            CarbonPrimaryButton("Accept handover", enabled = !busy, modifier = Modifier.padding(top = 8.dp), onClick = {
                scope.launch { busy = true; failed = false; try { api.acceptHandoff(handoff.id); onAccepted() } catch (_: Exception) { failed = true } finally { busy = false } }
            })
        }
    }
}

@Composable
private fun ComposeHandover(api: NurseApi, encounterId: String, modifier: Modifier = Modifier, onRecorded: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    var incoming by remember { mutableStateOf("") }
    var s by remember { mutableStateOf("") }
    var b by remember { mutableStateOf("") }
    var a by remember { mutableStateOf("") }
    var r by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    fun opt(v: String) = v.trim().ifEmpty { null }
    if (!open) {
        CarbonPrimaryButton("Record handover", onClick = { open = true }, modifier = modifier)
        return
    }
    Column(modifier.fillMaxWidth().background(Carbon.ink[1]).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CarbonTextField(incoming, { incoming = it }, "Incoming nurse (user id)")
        CarbonTextField(s, { s = it }, "Situation")
        CarbonTextField(b, { b = it }, "Background")
        CarbonTextField(a, { a = it }, "Assessment")
        CarbonTextField(r, { r = it }, "Recommendation")
        if (failed) CarbonNotification(NotificationKind.Error, "Handover not recorded", "Nothing was signed. Try again.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CarbonTertiaryButton("Cancel", onClick = { open = false }, enabled = !busy)
            CarbonPrimaryButton("Sign handover", enabled = !busy && incoming.isNotBlank(), modifier = Modifier.weight(1f), onClick = {
                scope.launch {
                    busy = true; failed = false
                    try {
                        api.createHandoff(CreateHandoffPayload(encounterId, incoming.trim(), opt(s), opt(b), opt(a), opt(r)))
                        open = false; s = ""; b = ""; a = ""; r = ""
                        onRecorded()
                    } catch (_: Exception) { failed = true } finally { busy = false }
                }
            })
        }
    }
}
