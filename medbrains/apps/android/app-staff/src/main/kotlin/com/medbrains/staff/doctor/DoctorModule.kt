package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.staff.nurse.AdmissionRow
import com.medbrains.staff.nurse.NurseApi
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonStatTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import androidx.compose.material3.Text

/** Rows the module has fetched, so a route carries an id and the screen has the row. */
class DoctorSession {
    val tokens = mutableStateMapOf<String, WorklistToken>()
    val admissions = mutableStateMapOf<String, AdmissionRow>()
}

fun tokenTone(status: String): CarbonTone = when (status) {
    "waiting" -> CarbonTone.Warning
    "called", "serving" -> CarbonTone.Info
    "completed" -> CarbonTone.Success
    else -> CarbonTone.Neutral
}

/** The doctor module: a stack of its own screens, mirroring the RN module router. */
@Composable
fun DoctorModule() {
    val nav = rememberNavController()
    val session = remember { DoctorSession() }
    val client = LocalApiClient.current
    val api = DoctorApi(client)
    NavHost(nav, startDestination = "home") {
        composable("home") { DoctorHome(nav, api) }
        composable("queue") { QueueListScreen(nav, api, session) }
        composable("queue/{id}") { QueueDetailScreen(nav, api, session.tokens.getValue(it.arguments!!.getString("id")!!)) }
        composable("consultation/{id}") { ConsultationScreen(api, session.tokens.getValue(it.arguments!!.getString("id")!!)) }
        composable("ipd-rounds") { IpdRoundsScreen(nav, NurseApi(client), session) }
        composable("round/{id}") { IpdRoundDetailScreen(session.admissions.getValue(it.arguments!!.getString("id")!!)) }
        composable("my-clinic") { MyClinicScreen(api) }
    }
}

private data class Action(val id: String, val label: String, val detail: String, val icon: ImageVector, val route: String, val permission: String)

/**
 * The doctor's front door. "Start consultation" goes through the queue on
 * purpose: a consultation is written against a patient, and the queue is
 * where the doctor picks one.
 */
@Composable
fun DoctorHome(nav: NavHostController, api: DoctorApi) {
    val identity = LocalIdentity.current
    val queue = remember { Remote<List<WorklistToken>>() }
    LaunchedEffect(Unit) { queue.load { api.listWorklist() } }
    val q by queue.state.collectAsState()
    val actions = listOf(
        Action("queue", "OPD queue", "Call next, view tokens, mark consult complete.", Icons.Filled.Groups, "queue", "opd.queue.list"),
        Action("visit", "Start consultation", "Pick a patient from the queue and record the SOAP note.", Icons.Filled.EditNote, "queue", "opd.visit.update"),
        Action("ipd-rounds", "IPD rounds", "Ward patients with mini EMR review context.", Icons.Filled.Bed, "ipd-rounds", "ipd.admissions.list"),
        Action("appointments", "Appointments", "View today's schedule and reschedule.", Icons.Filled.CalendarMonth, "my-clinic", "opd.appointment.list"),
    )
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("module-home-doctor")) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            Eyebrow("Module")
            Text("Consultations, prescriptions, clinical notes.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Row(Modifier.padding(horizontal = 16.dp)) {
            CarbonStatTile("Queue", q.value?.count { it.status == "waiting" }, "OPD queue (today)", Modifier.weight(1f))
            Spacer(Modifier.width(1.dp))
            CarbonStatTile("Vitals", null, "Pending review", Modifier.weight(1f))
        }
        CarbonSectionTitle("Actions")
        actions.filter { identity?.can(it.permission) == true }.forEach { act ->
            CarbonActionRow(act.label, act.detail, onClick = { nav.navigate(act.route) }, modifier = Modifier.fillMaxWidth().testTag("module-action-${act.id}")) {
                Icon(act.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
