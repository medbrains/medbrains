package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.RemoteState
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.BarcodeScanner
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch
import uniffi.edge_rn.WitnessCandidate
import uniffi.edge_rn.bcmaCanRecordGiven
import uniffi.edge_rn.bcmaEligibleWitnesses
import uniffi.edge_rn.bcmaScanRightsSummary
import java.time.Instant

private sealed interface Step {
    data object Wristband : Step
    data class Drug(val patientBarcode: String) : Step
    data object Verified : Step
    data class Refused(val result: BarcodeVerifyResult) : Step
}

/**
 * Give one dose at the bedside, with the 5 rights actually checked. Two
 * scans, wristband then drug; both strings go to the server, which answers.
 * A refusal is a full stop — there is deliberately no "give anyway".
 */
@Composable
fun AdministerDoseScreen(nav: NavHostController, api: NurseApi, admission: AdmissionRow, dose: MarRow) {
    var step by remember { mutableStateOf<Step>(Step.Wristband) }
    var scanRound by remember { mutableStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun handleScan(value: String) {
        val scanned = value.trim()
        failure = null
        when (val s = step) {
            Step.Wristband -> { step = Step.Drug(scanned); scanRound++ }
            is Step.Drug -> scope.launch {
                busy = true
                try {
                    val result = api.verifyMarBarcode(dose.id, s.patientBarcode, scanned)
                    step = if (result.verified) Step.Verified else Step.Refused(result)
                } catch (e: Exception) {
                    // A failed check and a failed request are not the same event.
                    failure = (e as? ApiError)?.message ?: "Could not reach the hospital server."
                    step = Step.Wristband
                } finally {
                    busy = false
                    scanRound++
                }
            }
            else -> Unit
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-administer-dose")) {
        CarbonPageHeader("Administer", dose.drug_name, "${dose.dose} · ${dose.route} · ${admission.patient_name} · UHID ${admission.uhid}") {
            if (dose.is_high_alert) CarbonTag("high alert", CarbonTone.HighAlert)
        }
        failure?.let { CarbonNotification(NotificationKind.Error, "The check could not be completed", it, Modifier.padding(horizontal = 16.dp)) }
        when (val s = step) {
            Step.Wristband -> BarcodeScanner("Scan the wristband", "The band on the patient's arm, not the chart or the bed label.", scanRound, ::handleScan)
            is Step.Drug -> BarcodeScanner("Scan the drug", "The barcode on the pack you are about to give.", scanRound, ::handleScan)
            is Step.Refused -> ScanRefused(s.result) { failure = null; step = Step.Wristband; scanRound++ }
            Step.Verified -> RecordAdministration(api, admission, dose) { nav.popBackStack() }
        }
        if (busy) Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        RecordNotGiven(api, admission, dose, Modifier.padding(16.dp)) { nav.popBackStack() }
    }
}

@Composable
private fun ScanRefused(result: BarcodeVerifyResult, onRescan: () -> Unit) {
    CarbonTonedTile(CarbonTone.Danger, Modifier.padding(16.dp)) {
        Text("Do not give this dose", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("bcma-refused"))
        Text(result.reason ?: "The scan did not match this order.", style = MaterialTheme.typography.bodyLarge)
        Text(bcmaScanRightsSummary(result.right_patient, result.right_drug), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CarbonTertiaryButton("Scan again", onClick = onRescan, modifier = Modifier.padding(top = 8.dp).semantics { contentDescription = "Scan the wristband and drug again" })
    }
}

/** The give step, reachable only once the server has stamped the verification. */
@Composable
private fun RecordAdministration(api: NurseApi, admission: AdmissionRow, dose: MarRow, onDone: () -> Unit) {
    val me = LocalIdentity.current?.userId ?: ""
    val onDuty = remember { Remote<List<WardOnDutyRow>>() }
    LaunchedEffect(admission.ward_id) { admission.ward_id?.let { w -> onDuty.load { api.wardOnDuty(w) } } }
    val duty by onDuty.state.collectAsState()
    val witnesses = bcmaEligibleWitnesses(duty.value.orEmpty().map { WitnessCandidate(it.nurse_user_id, it.nurse_name, it.is_charge) }, me)
    var witnessId by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Right patient, right drug", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.tertiary)
        if (dose.is_high_alert) {
            Text("A high-alert drug takes a second nurse. Pick who checked it with you.", style = MaterialTheme.typography.bodyLarge)
            // Unknown must not look like "nobody is on duty".
            when {
                duty is RemoteState.Failed -> CarbonNotification(NotificationKind.Error, "On-duty list unavailable", "A witness cannot be picked here. Record this dose at the station.")
                duty is RemoteState.Loaded && witnesses.isEmpty() -> Text("No other nurse is recorded on duty for this ward today.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                else -> witnesses.forEach { n ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = witnessId == n.nurseUserId, onClick = { witnessId = n.nurseUserId })
                        Text(if (n.isCharge) "${n.nurseName} (charge)" else n.nurseName, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
        failure?.let { CarbonNotification(NotificationKind.Error, "The dose could not be recorded", it) }
        CarbonPrimaryButton("Give now", enabled = !busy && bcmaCanRecordGiven(dose.is_high_alert, witnessId), modifier = Modifier.testTag("bcma-give-now").semantics { contentDescription = "Record ${dose.drug_name} as given" }, onClick = {
            scope.launch {
                busy = true; failure = null
                try {
                    api.updateMar(admission.id, dose.id, UpdateMarPayload(status = "given", administered_at = ServerTime.format(Instant.now()), witnessed_by = if (dose.is_high_alert) witnessId else null))
                    onDone()
                } catch (e: Exception) { failure = (e as? ApiError)?.message ?: "Could not reach the hospital server." } finally { busy = false }
            }
        })
    }
}

/** Held and refused, with a reason the nurse actually typed. */
@Composable
private fun RecordNotGiven(api: NurseApi, admission: AdmissionRow, dose: MarRow, modifier: Modifier = Modifier, onDone: () -> Unit) {
    var mode by remember { mutableStateOf<String?>(null) }
    var reason by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val m = mode
        if (m == null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonTertiaryButton("Hold", onClick = { mode = "held" }, modifier = Modifier.testTag("dose-hold").semantics { contentDescription = "Hold ${dose.drug_name} and give a reason" })
                CarbonTertiaryButton("Refused", onClick = { mode = "refused" }, modifier = Modifier.testTag("dose-refused").semantics { contentDescription = "Record that the patient refused ${dose.drug_name}" })
            }
        } else {
            CarbonTextField(reason, { reason = it }, if (m == "held") "Why was it held?" else "What did the patient say?", modifier = Modifier.testTag("dose-reason"))
            failure?.let { CarbonNotification(NotificationKind.Error, "Not recorded", it) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonPrimaryButton("Save", enabled = !busy && reason.isNotBlank(), modifier = Modifier.weight(1f).testTag("dose-save"), onClick = {
                    scope.launch {
                        busy = true; failure = null
                        try {
                            api.updateMar(admission.id, dose.id, UpdateMarPayload(status = m, hold_reason = if (m == "held") reason.trim() else null, refused_reason = if (m == "refused") reason.trim() else null))
                            onDone()
                        } catch (e: Exception) { failure = (e as? ApiError)?.message ?: "Could not reach the hospital server." } finally { busy = false }
                    }
                })
                TextButton(onClick = { mode = null; reason = "" }) { Text("Cancel") }
            }
        }
    }
}
