package com.medbrains.staff.nurse

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
import androidx.compose.material.icons.automirrored.filled.CompareArrows
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Opacity
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.Bolt
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
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonStatTile
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Rows the module has already fetched, so a route can carry an id and the
 * screen behind it still has the admission or dose without a second trip.
 * Bounded by what a nurse can see on a shift; cleared with the module.
 */
class NurseSession {
    val admissions = mutableStateMapOf<String, AdmissionRow>()
    val doses = mutableStateMapOf<String, MarRow>()
}

/** The nurse module: a stack of its own screens, mirroring the RN module router. */
@Composable
fun NurseModule() {
    val nav = rememberNavController()
    val session = remember { NurseSession() }
    val api = NurseApi(LocalApiClient.current)
    NavHost(nav, startDestination = "home") {
        composable("home") { NurseHome(nav, api) }
        composable("admissions") { AdmissionsListScreen(nav, api, session) }
        composable("calls") { NurseCallBoardScreen(api) }
        composable("code-blue") { CodeBlueScreen(api) }
        composable("workspace/{id}") { PatientWorkspaceScreen(nav, session.admissions.getValue(it.arguments!!.getString("id")!!)) }
        composable("mar/{id}") { MarScheduleScreen(nav, api, session, session.admissions.getValue(it.arguments!!.getString("id")!!)) }
        composable("administer/{id}/{marId}") {
            val a = session.admissions.getValue(it.arguments!!.getString("id")!!)
            AdministerDoseScreen(nav, api, a, session.doses.getValue(it.arguments!!.getString("marId")!!))
        }
        composable("handover/{id}") { ShiftHandoverScreen(api, session.admissions.getValue(it.arguments!!.getString("id")!!)) }
        composable("transfusions/{id}") { TransfusionMonitorScreen(api, session.admissions.getValue(it.arguments!!.getString("id")!!)) }
        composable("bedside/{id}/{mode}") { BedsideActionScreen(api, session.admissions.getValue(it.arguments!!.getString("id")!!), it.arguments!!.getString("mode")!!) }
    }
}

/**
 * The nurse's front door: two numbers that are the reason to open the
 * module, then the actions the role holds. A tile shows an em dash where a
 * number belongs when the count could not be fetched.
 */
@Composable
fun NurseHome(nav: NavHostController, api: NurseApi) {
    val identity = LocalIdentity.current
    val admissions = remember { Remote<List<AdmissionRow>>() }
    val calls = remember { Remote<NurseCallBoard>() }
    LaunchedEffect(Unit) {
        coroutineScope {
            async { admissions.load { api.listActiveAdmissions() } }
            async { calls.load { api.listNurseCalls() } }
        }
    }
    val a by admissions.state.collectAsState()
    val c by calls.state.collectAsState()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("module-home-nurse")) {
        CarbonPageHeader("Module", "Nurse", "MAR, vitals, handoff, intake/output.")
        Row(Modifier.padding(horizontal = 16.dp)) {
            CarbonStatTile("Due", a.value?.size, "Active admissions", Modifier.weight(1f))
            Spacer(Modifier.width(1.dp))
            CarbonStatTile("Calls", c.value?.calls?.size, "Beds waiting on a call", Modifier.weight(1f))
        }
        CarbonSectionTitle("Actions")
        val actions = listOf(
            Action("mar", "My shift", "Assigned beds with bedside MAR, vitals, I/O and risk actions.", Icons.Filled.Bed, "admissions", "nurse.dashboard.view"),
            Action("vitals", "Record vitals", "Select a patient, then capture BP, HR, SpO2 and temperature.", Icons.Filled.MonitorHeart, "admissions", "nurse.vitals.record"),
            Action("code-blue", "Code blue", "Arrests in progress. Answer the page here.", Icons.Filled.Bolt, "code-blue", "nurse.code_blue.view"),
            Action("calls", "Open calls", "Every bed still waiting on a call, oldest first.", Icons.Filled.NotificationsActive, "calls", "bedside.calls.board"),
            Action("handoff", "SBAR handoff", "Structured handoff for shift change.", Icons.AutoMirrored.Filled.CompareArrows, "admissions", "nurse.handoff.record"),
            Action("io", "Intake / output", "Fluid balance and drain output capture.", Icons.Filled.Opacity, "admissions", "nurse.intake_output.record"),
            Action("fall-risk", "Fall risk assessment", "Morse scale + interventions.", Icons.Filled.PersonOff, "admissions", "nurse.fall_risk.record"),
        )
        actions.filter { identity?.can(it.permission) == true }.forEach { act ->
            CarbonActionRow(act.label, act.detail, onClick = { nav.navigate(act.route) }, modifier = Modifier.fillMaxWidth().testTag("module-action-${act.id}")) {
                Icon(act.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

private data class Action(val id: String, val label: String, val detail: String, val icon: ImageVector, val route: String, val permission: String)
