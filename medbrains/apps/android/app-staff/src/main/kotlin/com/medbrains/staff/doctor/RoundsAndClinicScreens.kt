package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.staff.nurse.AdmissionRow
import com.medbrains.staff.nurse.NurseApi
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import uniffi.edge_rn.clinicIsStillToCome
import uniffi.edge_rn.clinicNextPatient
import uniffi.edge_rn.clinicOrder
import uniffi.edge_rn.clinicRemainingCount
import java.time.LocalDate

/** The doctor's ward round worklist. */
@Composable
fun IpdRoundsScreen(nav: NavHostController, api: NurseApi, session: DoctorSession) {
    val remote = remember { Remote<List<AdmissionRow>>() }
    val scope = rememberCoroutineScope()
    suspend fun load() = remote.load { api.listActiveAdmissions().also { rows -> rows.forEach { session.admissions[it.id] = it } } }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()
    Column(Modifier.fillMaxSize().testTag("screen-ipd-rounds")) {
        CarbonPageHeader("Doctor", "IPD rounds", "Active admitted patients for ward review.")
        RemoteContent(
            id = "ipd-rounds", state = state,
            unavailableTitle = "Couldn't load IPD rounds", unavailableMessage = "The ward list could not be loaded. Do not read this as an empty ward.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No active admissions", emptyMessage = "No patients are currently on rounds.",
            retry = { scope.launch { load() } },
        ) { rows ->
            LazyColumn(Modifier.fillMaxSize()) {
                items(rows, key = { it.id }) { row ->
                    CarbonActionRow(row.patient_name, row.bedLine, onClick = { nav.navigate("round/${row.id}") }, modifier = Modifier.fillMaxWidth().testTag("round-${row.id}")) { CarbonTag("round", CarbonTone.Info) }
                }
            }
        }
    }
}

/** The mobile round landing point for one admission; the clinical tiles land in later phases and say so. */
@Composable
fun IpdRoundDetailScreen(admission: AdmissionRow) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-ipd-round-detail"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CarbonPageHeader("Round", admission.patient_name, admission.bedLine) { CarbonTag(admission.status, CarbonTone.Success) }
        CarbonTonedTile(CarbonTone.Info, Modifier.padding(horizontal = 16.dp)) {
            Eyebrow("Mini EMR")
            Text("Ward review context", style = MaterialTheme.typography.titleMedium)
            Text("Progress notes, diagnosis, prescription review, investigations and discharge planning stay under this patient context.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonTag("encounter ${admission.encounter_id.take(8)}", mono = true)
                CarbonTag("IPD", CarbonTone.Info)
            }
        }
        listOf(
            Triple("Progress note", "SOAP note, senior co-sign requirement and discharge readiness.", CarbonTone.Info),
            Triple("Diagnosis", "ICD/SNOMED review for the current admission.", CarbonTone.Success),
            Triple("Prescription review", "Medication reconciliation, MAR visibility and pharmacy status.", CarbonTone.HighAlert),
            Triple("Lab / radiology", "Critical values, pending reports and DICOM review links.", CarbonTone.Warning),
        ).forEach { (title, detail, tone) ->
            CarbonTonedTile(tone, Modifier.padding(horizontal = 16.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/** A doctor's own clinic for today, leading with the next patient. Ordering comes from the clinical core. */
@Composable
fun MyClinicScreen(api: DoctorApi) {
    val me = LocalIdentity.current?.userId ?: ""
    val remote = remember { Remote<List<AppointmentRow>>() }
    val scope = rememberCoroutineScope()
    suspend fun load() = remote.load { api.listMyAppointments(me, LocalDate.now().toString()) }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()
    val raw = state.value.orEmpty().take(100)
    val times = raw.map { it.start_time }
    val statuses = raw.map { it.status }
    val order = clinicOrder(times).map { raw[it.toInt()] }
    val next = clinicNextPatient(times, statuses)?.let { raw[it.toInt()] }
    val remaining = clinicRemainingCount(statuses)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-my-clinic")) {
        CarbonPageHeader("Clinic", "Today", "Your appointments, earliest first.") { if (remaining > 0u) CarbonTag("$remaining left", CarbonTone.Info) }
        RemoteContent(
            id = "my-clinic", state = state,
            unavailableTitle = "Couldn't load your clinic", unavailableMessage = "Today's list could not be loaded. Do not read this as a free day.",
            isEmpty = { it.isEmpty() }, emptyTitle = "Nothing booked today", emptyMessage = "No appointments on your list.",
            retry = { scope.launch { load() } },
        ) {
            Column {
                Column(Modifier.padding(16.dp)) {
                    Eyebrow(if (next != null) "Next" else "Clinic finished")
                    Text(next?.let { "${it.start_time ?: "No time"} · ${it.patient_name ?: "Patient"}" } ?: "Everyone has been seen", style = MaterialTheme.typography.headlineSmall)
                }
                order.forEach { a ->
                    CarbonRow(a.patient_name ?: "Patient", (a.start_time ?: "No time set") + (a.reason?.let { " · $it" } ?: ""))
                }
            }
        }
    }
}
