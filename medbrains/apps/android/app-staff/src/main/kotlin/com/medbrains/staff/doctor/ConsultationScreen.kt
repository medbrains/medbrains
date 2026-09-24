package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.RemoteState
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch
import uniffi.edge_rn.consultationProblem

/**
 * The clinical record behind the token: four SOAP fields. Every field is
 * prose, so the return key stays a newline. Save is disabled only while a
 * write is in flight, never on validity — pressing it runs the check and the
 * field says what is missing. A failed read is never an empty form.
 */
@Composable
fun ConsultationScreen(api: DoctorApi, token: WorklistToken) {
    val identity = LocalIdentity.current
    val existing = remember { Remote<Consultation?>() }
    val encounterId = token.encounter_id
    val scope = rememberCoroutineScope()
    LaunchedEffect(encounterId) { if (encounterId != null) existing.load { api.getConsultation(encounterId) } }
    val state by existing.state.collectAsState()

    Column(Modifier.fillMaxSize().imePadding().testTag("screen-consultation")) {
        CarbonPageHeader("Consultation", token.displayName, "UHID ${token.uhid ?: "—"} · Token ${token.number}")
        if (encounterId == null) {
            // A token issued before its encounter existed. Saying so beats a form that cannot save.
            CarbonNotification(NotificationKind.Warning, "No visit to record against", "This token has no OPD visit yet. Start the visit from reception, then the consultation can be written.", Modifier.padding(16.dp))
            return
        }
        when (val s = state) {
            RemoteState.Loading -> Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            is RemoteState.Failed -> CarbonNotification(NotificationKind.Error, "Couldn't load the consultation", s.message, Modifier.padding(16.dp)) {
                TextButton(onClick = { scope.launch { existing.load { api.getConsultation(encounterId) } } }) { Text("Try again") }
            }
            is RemoteState.Loaded -> ConsultationForm(api, token, encounterId, s.value, identity?.can("opd.visit.update") == true)
        }
    }
}

@Composable
private fun ConsultationForm(api: DoctorApi, token: WorklistToken, encounterId: String, existing: Consultation?, canRecord: Boolean) {
    var saved by remember { mutableStateOf(existing) }
    var chief by remember { mutableStateOf(existing?.chief_complaint ?: "") }
    var exam by remember { mutableStateOf(existing?.examination ?: "") }
    var assessment by remember { mutableStateOf(existing?.notes ?: "") }
    var plan by remember { mutableStateOf(existing?.plan ?: "") }
    var busy by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val prose = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp).testTag("consultation-form"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CarbonTonedTile(if (saved != null) CarbonTone.Success else CarbonTone.Warning) {
            Eyebrow("Visit")
            Text(if (saved != null) "Recorded" else "New consultation", style = MaterialTheme.typography.titleMedium)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonTag("token ${token.number}", mono = true)
                // The record's state is what a test anchors on; the toast dismisses itself.
                CarbonTag(if (saved != null) "saved" else "not saved", if (saved != null) CarbonTone.Success else CarbonTone.Warning,
                    modifier = Modifier.testTag(if (saved != null) "consultation-saved" else "consultation-unsaved"))
            }
        }
        CarbonSectionTitle("Clinical note")
        CarbonTextField(chief, { chief = it }, "Chief complaint", Modifier.testTag("field-chief_complaint"), error = problem, keyboardOptions = prose, singleLine = false)
        CarbonTextField(exam, { exam = it }, "Examination", Modifier.testTag("field-examination"), keyboardOptions = prose, singleLine = false)
        CarbonTextField(assessment, { assessment = it }, "Assessment", Modifier.testTag("field-assessment"), keyboardOptions = prose, singleLine = false)
        CarbonTextField(plan, { plan = it }, "Plan", Modifier.testTag("field-plan"), keyboardOptions = prose, singleLine = false)
        error?.let { CarbonNotification(NotificationKind.Error, "Could not save the consultation", it) }
        toast?.let { CarbonNotification(NotificationKind.Success, it, "", Modifier.testTag("consultation-toast")) }
        if (canRecord) {
            CarbonPrimaryButton(if (saved != null) "Save changes" else "Save consultation", enabled = !busy, modifier = Modifier.testTag("consultation-save").semantics { contentDescription = "Save this consultation" }, onClick = {
                problem = consultationProblem(chief, exam, assessment, plan)
                if (problem != null) return@CarbonPrimaryButton
                scope.launch {
                    busy = true; error = null; toast = null
                    try {
                        val notes = ConsultationNotes(chief.trim(), exam.trim(), assessment.trim(), plan.trim())
                        val current = saved
                        saved = if (current != null) api.updateConsultation(encounterId, current.id, notes) else api.createConsultation(encounterId, notes)
                        toast = "Consultation saved"
                    } catch (e: Exception) { error = (e as? ApiError)?.message ?: "Could not reach the hospital server." } finally { busy = false }
                }
            })
        } else {
            Text("You can read this consultation but not change it.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
