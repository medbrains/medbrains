package com.medbrains.staff.nurse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.LocalIdentity
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow

private data class WorkspaceAction(val id: String, val label: String, val detail: String, val permissions: List<String>, val tone: CarbonTone, val route: String)

/** One selected admission becomes the working patient context; nursing tasks branch from here. */
@Composable
fun PatientWorkspaceScreen(nav: NavHostController, admission: AdmissionRow) {
    val identity = LocalIdentity.current
    val actions = listOf(
        WorkspaceAction("mar", "MAR", "Administer, hold, or refuse scheduled medication.", listOf("ipd.mar.list", "nurse.mar.view"), CarbonTone.HighAlert, "mar/${admission.id}"),
        WorkspaceAction("transfusions", "Transfusion", "Hang a unit, chart the fifteen-minute check, close it out.", listOf("nurse.transfusion.view"), CarbonTone.Danger, "transfusions/${admission.id}"),
        WorkspaceAction("handover", "SBAR handover", "Hand this patient to the next shift, or accept one addressed to you.", listOf("nurse.handoff.record"), CarbonTone.Warning, "handover/${admission.id}"),
        WorkspaceAction("vitals", "Vitals", "BP, pulse, SpO2, temperature, respiration, weight.", listOf("nurse.vitals.record"), CarbonTone.Info, "bedside/${admission.id}/vitals"),
        WorkspaceAction("io", "Intake / output", "Record fluid balance for the current shift.", listOf("nurse.intake_output.record"), CarbonTone.Success, "bedside/${admission.id}/io"),
        WorkspaceAction("pain", "Pain score", "Numeric pain score with intervention and recheck notes.", listOf("nurse.pain.record"), CarbonTone.Warning, "bedside/${admission.id}/pain"),
        WorkspaceAction("fall-risk", "Fall risk", "Morse-style score with risk level and interventions.", listOf("nurse.fall_risk.record"), CarbonTone.Info, "bedside/${admission.id}/fall-risk"),
    )
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-patient-workspace")) {
        CarbonPageHeader("Bed", admission.patient_name, admission.bedLine) { CarbonTag(admission.status, CarbonTone.Success) }
        CarbonTonedTile(CarbonTone.Info, Modifier.padding(16.dp)) {
            Eyebrow("Patient context")
            Text("Work in one selected admission context. MAR, vitals, I/O and risk screens write against this encounter for auditability.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.padding(top = 8.dp)) {
                CarbonTag("encounter ${admission.encounter_id.take(8)}", mono = true)
                if (identity?.can("ipd.admissions.view") == true) CarbonTag("IPD visible", CarbonTone.Info, modifier = Modifier.padding(start = 8.dp))
            }
        }
        actions.filter { identity?.canAny(it.permissions) == true }.forEach { act ->
            CarbonActionRow(act.label, act.detail, onClick = { nav.navigate(act.route) }, modifier = Modifier.fillMaxWidth().testTag("workspace-${act.id}")) {
                Box(Modifier.width(3.dp).height(24.dp).background(act.tone.bar))
            }
        }
    }
}
