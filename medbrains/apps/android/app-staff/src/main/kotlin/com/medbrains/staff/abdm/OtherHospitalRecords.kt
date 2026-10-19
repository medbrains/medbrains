package com.medbrains.staff.abdm

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apartment
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.medbrains.kit.AbdmRecords
import com.medbrains.kit.AbdmRecordsApi
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.isNotAvailable
import com.medbrains.staff.shared.tokens.QueueActionState
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import com.medbrains.ui.carbon
import kotlinx.coroutines.launch

/** Where the other-hospital records screens are, on any stack that links to them. */
object AbdmRoutes {
    private const val RECORDS = "abdm-records"
    private const val RECORD = "abdm-record"
    fun records(patientId: String, patientName: String) = "$RECORDS/$patientId?name=${Uri.encode(patientName)}"
    fun record(id: String) = "$RECORD/$id"

    /** Registers the records screens on a module's stack (doctor, nurse). */
    fun NavGraphBuilder.abdmRecordsRoutes(nav: NavHostController) {
        composable("$RECORDS/{patientId}?name={name}", arguments = listOf(navArgument("name") { defaultValue = "" })) {
            OtherHospitalRecordsScreen(nav, it.arguments?.getString("patientId").orEmpty(), it.arguments?.getString("name").orEmpty())
        }
        composable("$RECORD/{id}") { ReceivedRecordScreen(it.arguments?.getString("id").orEmpty()) }
    }
}

/** The patient's row into their records from other hospitals: only with `abdm.consent.view`, only for a known patient. */
@Composable
fun OtherHospitalRecordsLink(nav: NavHostController, patientId: String?, patientName: String) {
    if (patientId == null || LocalIdentity.current?.can(AbdmRecords.Permission.VIEW) != true) return
    CarbonActionRow("Records from other hospitals", "Shared through ABDM with the patient's consent.",
        onClick = { nav.navigate(AbdmRoutes.records(patientId, patientName)) },
        modifier = Modifier.fillMaxWidth().testTag("open-other-hospital-records")) {
        Icon(Icons.Filled.Apartment, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
    }
}

/**
 * Patient → records from other hospitals (ABDM HIU): the consent requests
 * raised for them with what each state means, and the copies other facilities
 * sent, grouped by facility. Requesting needs `abdm.consent.request`; a patient
 * this person may not see reads as "not available", never as "none".
 */
@Composable
fun OtherHospitalRecordsScreen(nav: NavHostController, patientId: String, patientName: String) {
    val identity = LocalIdentity.current
    val api = AbdmRecordsApi(LocalApiClient.current)
    val remote = remember { Remote<AbdmRecords.PatientView>() }
    val action = remember { QueueActionState() }
    var asking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val canView = identity?.can(AbdmRecords.Permission.VIEW) == true
    val canRequest = identity?.can(AbdmRecords.Permission.REQUEST) == true
    // Reads gate the fetch: without the permission nothing is asked.
    suspend fun load() { if (canView) remote.load { api.patientView(patientId) } }
    LaunchedEffect(patientId) { load() }
    val state by remote.state.collectAsState()
    val failedStatus by remote.failedStatus.collectAsState()

    Column(Modifier.fillMaxSize().testTag("screen-abdm-records")) {
        CarbonPageHeader("Other hospitals", patientName, "Records held elsewhere, shared through ABDM with the patient's consent.")
        if (isNotAvailable(failedStatus)) {
            CarbonNotification(NotificationKind.Warning, "Not available", "This patient's records from other hospitals are not available to you. This does not mean there are none.",
                Modifier.padding(16.dp).testTag("abdm-records-not-available"))
            return@Column
        }
        RemoteContent(
            id = "abdm-records", state = state,
            unavailableTitle = "Could not load records from other hospitals", unavailableMessage = "This does not mean there are none — the list failed to load.",
            isEmpty = { false }, emptyTitle = "", emptyMessage = "", retry = { scope.launch { load() } },
        ) { view ->
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
                view.blocked_reason?.let { reason ->
                    item { CarbonNotification(NotificationKind.Warning, "Records cannot be requested", reason, Modifier.padding(16.dp).testTag("abdm-blocked")) }
                }
                if (AbdmRecords.canRaise(view, canRequest)) {
                    item { CarbonPrimaryButton("Request records", onClick = { asking = true }, modifier = Modifier.padding(16.dp).testTag("abdm-request-records")) }
                }
                action.failure?.let { item { CarbonNotification(NotificationKind.Error, "Could not check the status", it, Modifier.padding(horizontal = 16.dp)) } }
                action.toast?.let { item { CarbonNotification(NotificationKind.Info, it, "", Modifier.padding(horizontal = 16.dp).testTag("abdm-toast")) } }
                item { CarbonSectionTitle("Requests") }
                if (view.requests.isEmpty()) item { Note("No request yet. Ask for the patient's records from other hospitals with \"Request records\".", "abdm-requests-empty") }
                items(view.requests, key = { it.id }) { r ->
                    RequestRow(r, canCheck = canRequest && !action.busy) {
                        scope.launch {
                            action.run("Could not reach the hospital server.") { "Status checked with ABDM: ${AbdmRecords.status(api.checkStatus(r.id).status).label}" }
                            // The list reloads either way: the answer may have arrived meanwhile.
                            load()
                        }
                    }
                }
                item { CarbonSectionTitle("Records received") }
                val erased = view.requests.sumOf { AbdmRecords.erased(it) }
                if (erased > 0) item {
                    CarbonNotification(NotificationKind.Info, "$erased record${if (erased == 1) "" else "s"} erased", "A consent was withdrawn or ended, and the copies received under it were erased.",
                        Modifier.padding(horizontal = 16.dp).testTag("abdm-erased"))
                }
                if (view.records.isEmpty()) item { Note("No records held. They appear here once the patient grants a request and the other hospital sends them, and are erased when the consent ends.", "abdm-records-empty") }
                AbdmRecords.byFacility(view.records).forEach { group ->
                    item(key = "hip-${group.id}") { Eyebrow(group.name, Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp)) }
                    items(group.records, key = { it.id }) { record ->
                        CarbonActionRow(record.title ?: record.care_context_reference, "${ServerTime.dateOf(record.record_date ?: record.received_at)} · held until ${ServerTime.dateOf(record.erase_at)}",
                            onClick = { nav.navigate(AbdmRoutes.record(record.id)) }, modifier = Modifier.fillMaxWidth().testTag("abdm-record-${record.id}")) {
                            CarbonTag(AbdmRecords.hiTypeLabel(record.hi_type))
                        }
                    }
                }
            }
        }
    }
    if (asking) ConsentRequestSheet(api, patientId, onClose = { asking = false }, onSent = { scope.launch { load() } })
}

@Composable
private fun Note(text: String, tag: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp).testTag(tag))
}

@Composable
private fun RequestRow(r: AbdmRecords.ConsentRequest, canCheck: Boolean, onCheck: () -> Unit) {
    val status = AbdmRecords.status(r.status)
    val secondary = MaterialTheme.colorScheme.onSurfaceVariant
    Column(Modifier.fillMaxWidth().padding(16.dp).testTag("abdm-request-${r.id}"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(AbdmRecords.purposeLabel(r.purpose_code), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            CarbonTag(status.label, status.tone.carbon)
        }
        Text(r.hi_types.joinToString(", ") { AbdmRecords.hiTypeLabel(it) }, style = MaterialTheme.typography.bodyMedium, color = secondary)
        Text("${ServerTime.dateOf(r.date_from)} – ${ServerTime.dateOf(r.date_to)} · erase by ${ServerTime.dateOf(r.data_erase_at)}", style = MaterialTheme.typography.bodyMedium, color = secondary)
        Text(r.error ?: status.hint, style = MaterialTheme.typography.bodyMedium)
        Text("Requested ${ServerTime.short(r.requested_at)} by ${r.requester_name}", style = MaterialTheme.typography.bodyMedium, color = secondary)
        if (r.records_received > 0) Text("${r.records_held} of ${r.records_received} records held", style = MaterialTheme.typography.bodyMedium, color = secondary)
        if (AbdmRecords.isCheckable(r)) {
            Text(r.status_checked_at?.let { "Last checked ${ServerTime.short(it)}" } ?: "Not checked with ABDM yet", style = MaterialTheme.typography.bodyMedium, color = secondary)
            if (canCheck) CarbonTertiaryButton("Check status", onClick = onCheck, modifier = Modifier.testTag("abdm-check-${r.id}"))
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
