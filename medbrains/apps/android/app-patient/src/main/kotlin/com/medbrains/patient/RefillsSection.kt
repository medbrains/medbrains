package com.medbrains.patient

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.unit.dp
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** How many prescriptions the section lists; the server sends at most this. */
private const val REFILL_LIMIT = 20

/** What each request status reads as, and its tone. */
private val REQUEST_STATUS = mapOf(
    "with_doctor" to ("With your doctor" to CarbonTone.Info),
    "sent_to_pharmacy" to ("Sent to the pharmacy" to CarbonTone.Success),
    "declined" to ("Declined" to CarbonTone.Warning),
)

private data class Outcome(val kind: NotificationKind, val title: String, val message: String)

/**
 * Refills, at the top of Medicines: each recent prescription says what asking
 * would do — straight to the pharmacy, or to the doctor first — or why it
 * can't be asked for now, and how the last request went. The server decides
 * all of it; the screen only shows it.
 */
@Composable
fun RefillsSection(portal: PortalApi) {
    val remote = remember { Remote<List<PortalRefill>>() }
    val scope = rememberCoroutineScope()
    var asking by remember { mutableStateOf<String?>(null) }
    var outcome by remember { mutableStateOf<Outcome?>(null) }
    LaunchedEffect(Unit) { remote.load { portal.refills() } }
    val state by remote.state.collectAsState()

    fun ask(row: PortalRefill) {
        if (asking != null) return
        asking = row.prescription_id
        scope.launch {
            outcome = runCatching { portal.requestRefill(row.prescription_id) }.fold(
                onSuccess = {
                    Outcome(
                        NotificationKind.Success,
                        "Refill requested",
                        if (it.status == "with_doctor") "Your doctor will look at it. Their answer shows here." else "The pharmacy will have it ready.",
                    )
                },
                onFailure = { Outcome(NotificationKind.Error, "Refill not requested", it.message ?: "Try again in a moment.") },
            )
            asking = null
            remote.load { portal.refills() }
        }
    }

    Column {
        CarbonSectionTitle("Refills")
        outcome?.let {
            CarbonNotification(it.kind, it.title, it.message, Modifier.padding(horizontal = 16.dp).testTag("refill-outcome"))
        }
        RemoteContent("refills", state, "Couldn't load your refills", "Try again in a moment.", { it.isEmpty() }, "Nothing to refill", "Recent prescriptions appear here.", { scope.launch { remote.load { portal.refills() } } }) { rows ->
            Column {
                rows.take(REFILL_LIMIT).forEach { row -> RefillRow(row, asking == row.prescription_id) { ask(row) } }
            }
        }
    }
}

@Composable
private fun RefillRow(row: PortalRefill, asking: Boolean, onAsk: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(16.dp).testTag("refill-${row.prescription_id}"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(row.drugs.joinToString(", "), style = MaterialTheme.typography.titleSmall)
        Text(details(row), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        row.latest_request?.let { last ->
            REQUEST_STATUS[last.status]?.let { (label, tone) -> CarbonTag(label, tone) }
            last.decision_note?.let { Text("Doctor's note: $it", style = MaterialTheme.typography.bodyMedium) }
        }
        Text(row.message, style = MaterialTheme.typography.bodyMedium)
        if (row.goes_to != null) {
            CarbonPrimaryButton(
                if (asking) "Requesting…" else "Request refill",
                onAsk,
                Modifier.testTag("request-refill-${row.prescription_id}"),
                enabled = !asking,
            )
        }
    }
}

private fun details(row: PortalRefill): String = buildList {
    add("Prescribed ${ServerTime.short(row.prescribed_at)}")
    row.doctor_name?.let { add("Dr. $it") }
    row.valid_until?.let { add("valid until ${ServerTime.day(it)}") }
    if (row.refills_left > 0) add("${row.refills_left} refill(s) left")
}.joinToString(" · ")
