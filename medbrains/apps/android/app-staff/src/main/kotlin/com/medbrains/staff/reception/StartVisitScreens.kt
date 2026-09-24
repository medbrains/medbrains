package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import kotlinx.coroutines.launch

/** One call: the visit, the queue entry and the token come back together. Department and consultant are prefilled from the desk. */
@Composable
fun StartVisitScreen(nav: NavHostController, api: ReceptionApi, session: ReceptionSession, patient: PatientSummary) {
    val scope = rememberCoroutineScope()
    var departmentId by remember { mutableStateOf(session.departmentId) }
    var doctorId by remember { mutableStateOf(session.consultantId) }
    var complaint by remember { mutableStateOf("") }
    var failure by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-start-visit")) {
        CarbonPageHeader("Start visit", patient.fullName, patient.identifiers)
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonPicker("Department", session.departments.map { PickerOption(it.id, it.name) }, departmentId, { departmentId = it }, placeholder = "Choose a department", allowNone = false, tag = "picker-department")
            CarbonPicker("Consultant", session.doctors.map { PickerOption(it.id, it.full_name) }, doctorId, { doctorId = it }, placeholder = "Any consultant", tag = "picker-consultant")
            CarbonTextField(complaint, { complaint = it }, "Chief complaint (optional)", Modifier.testTag("field-chief_complaint"), singleLine = false)
            failure?.let { CarbonNotification(NotificationKind.Error, "No token issued", it) }
            CarbonPrimaryButton("Start visit and issue token", enabled = !busy && departmentId != null, modifier = Modifier.testTag("start-visit-submit"), onClick = {
                val dept = departmentId ?: return@CarbonPrimaryButton
                scope.launch {
                    busy = true; failure = null
                    session.departmentId = dept; session.consultantId = doctorId
                    try {
                        val started = api.startVisit(StartVisitBody(patient.id, dept, doctorId, complaint.ifBlank { null }, "walk_in"))
                        session.visits[patient.id] = started
                        nav.navigate("token/${patient.id}")
                    } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. No visit was started." } finally { busy = false }
                }
            })
        }
    }
}

/** The token in display type, and the sentence the desk says. Announced, not only shown. */
@Composable
fun TokenIssuedScreen(nav: NavHostController, patient: PatientSummary, visit: VisitStarted, session: ReceptionSession) {
    val department = session.departmentName(session.departmentId) ?: "the clinic"
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-token-issued")) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonTonedTile(CarbonTone.Info) {
                Eyebrow("Token")
                // A live region: TalkBack reads the token the moment it lands.
                Text("${visit.queue.token_number}", style = MaterialTheme.typography.displaySmall, modifier = Modifier.testTag("token-number").semantics { liveRegion = LiveRegionMode.Assertive; contentDescription = "Token ${visit.queue.token_number} issued for ${patient.fullName}. They are now waiting." })
                Text("Tell them token ${visit.queue.token_number} for $department.", style = MaterialTheme.typography.bodyLarge)
            }
            CarbonRow(patient.fullName, patient.identifiers)
            CarbonRow("Status", visit.queue.status)
            CarbonPrimaryButton("Queue board", modifier = Modifier.testTag("token-board"), onClick = { nav.navigate("board") })
            CarbonTertiaryButton("Done", onClick = { nav.popBackStack("home", inclusive = false) }, modifier = Modifier.fillMaxWidth().testTag("token-done"))
        }
    }
}
