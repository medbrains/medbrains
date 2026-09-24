package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * UHID, name or phone; the rows carry the identifiers the desk reads back and
 * the flags it must not miss. An outage is named — an empty list would read
 * as "not registered".
 */
@Composable
fun FindPatientScreen(nav: NavHostController, api: ReceptionApi, session: ReceptionSession) {
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var searched by remember { mutableStateOf(false) }
    val results = remember { Remote<List<PatientSummary>>() }
    val state by results.state.collectAsState()
    fun search() { searched = true; scope.launch { results.load { api.searchPatients(query.trim()) } } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-find-patient")) {
        CarbonPageHeader("Reception", "Find a patient", "UHID, name or phone.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonTextField(query, { query = it }, "Search", Modifier.testTag("find-search"), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { search() }))
            CarbonPrimaryButton("Search", enabled = query.isNotBlank(), modifier = Modifier.testTag("find-submit"), onClick = ::search)
        }
        if (searched) {
            RemoteContent("find", state, "Couldn't search", "The hospital server did not answer. Do not read this as \"not registered\".", { it.isEmpty() }, "No patient by that UHID, name or phone", "This searches the whole hospital, not only your own desk, so nothing here matches. Check the number, or register them.", ::search) { rows ->
                Column {
                    rows.forEach { p ->
                        CarbonActionRow(p.fullName, p.identifiers, onClick = { session.patients[p.id] = p; nav.navigate("patient/${p.id}") }, modifier = Modifier.fillMaxWidth().testTag("find-row-${p.id}")) {
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (p.is_medico_legal == true) CarbonTag("MLC", CarbonTone.Danger)
                                if (p.is_vip == true) CarbonTag("VIP", CarbonTone.Info)
                            }
                        }
                    }
                }
            }
        }
    }
}

/** The record as the desk needs it: the two identifiers, the flags, what is owed — and the one thing to do with it here. */
@Composable
fun ReceptionPatientScreen(nav: NavHostController, patient: PatientSummary) {
    val identity = LocalIdentity.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-reception-patient")) {
        CarbonPageHeader("Patient", patient.fullName, patient.identifiers)
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonTile {
                Eyebrow("Identity")
                CarbonRow("UHID", patient.uhid, mono = true)
                CarbonRow("Date of birth", (patient.date_of_birth ?: "Unknown") + if (patient.is_dob_estimated == true) " (estimated)" else "")
                CarbonRow("Phone", patient.phone, mono = true)
                CarbonRow("Gender", patient.gender.replaceFirstChar { it.uppercase() })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (patient.is_medico_legal == true) CarbonTag("MLC ${patient.mlc_number.orEmpty()}", CarbonTone.Danger)
                if (patient.is_vip == true) CarbonTag("VIP", CarbonTone.Info)
                patient.outstanding_balance?.toDoubleOrNull()?.takeIf { it > 0 }?.let { CarbonTag("₹%.2f due".format(it), CarbonTone.Warning) }
            }
            patient.last_visit_date?.let { CarbonRow("Last visit", it) }
            if (identity?.can("opd.visit.create") == true) {
                CarbonPrimaryButton("Start OPD visit", modifier = Modifier.testTag("patient-start-visit"), onClick = { nav.navigate("start-visit/${patient.id}") })
            }
            if (identity?.can("opd.appointment.create") == true) {
                CarbonTertiaryButton("Book appointment", onClick = { nav.navigate("book/${patient.id}") }, modifier = Modifier.fillMaxWidth().testTag("patient-book"))
            }
            if (identity?.can("opd.visit.create") != true) {
                Text("This account cannot start a visit.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
