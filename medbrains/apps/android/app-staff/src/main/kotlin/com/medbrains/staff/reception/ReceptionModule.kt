package com.medbrains.staff.reception

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
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.medbrains.staff.doctor.DoctorApi
import com.medbrains.staff.doctor.WorklistToken
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonStatTile
import com.medbrains.ui.Eyebrow

/**
 * What survives between two walk-ins at the same desk: the department, the
 * consultant, where people are coming from. Never the person — the rule lives
 * in `medbrains-clinical-core` (`registrationCarriesOver`). Also the pickers'
 * rows, loaded once per session, and the records opened this session so a
 * route can name them by id.
 */
class ReceptionSession {
    var departmentId by mutableStateOf<String?>(null)
    var consultantId by mutableStateOf<String?>(null)
    var source by mutableStateOf("walk_in")
    var referredByName by mutableStateOf("")
    val departments = mutableStateListOf<DepartmentRow>()
    val doctors = mutableStateListOf<DoctorRow>()
    val patients = mutableStateMapOf<String, PatientSummary>()
    val visits = mutableStateMapOf<String, VisitStarted>()

    fun departmentName(id: String?): String? = departments.firstOrNull { it.id == id }?.name
}

@Composable
fun ReceptionModule() {
    val nav = rememberNavController()
    val session = remember { ReceptionSession() }
    val client = LocalApiClient.current
    val api = remember { ReceptionApi(client) }
    LaunchedEffect(Unit) {
        runCatching { api.departments() }.getOrNull()?.let { session.departments.clear(); session.departments.addAll(it) }
        runCatching { api.doctors() }.getOrNull()?.let { session.doctors.clear(); session.doctors.addAll(it) }
    }
    NavHost(nav, startDestination = "home") {
        composable("home") { ReceptionHome(nav, DoctorApi(client)) }
        composable("register") { RegisterPatientScreen(nav, api, session) }
        composable("find") { FindPatientScreen(nav, api, session) }
        composable("patient/{id}") { ReceptionPatientScreen(nav, session.patients.getValue(it.arguments!!.getString("id")!!)) }
        composable("start-visit/{id}") { StartVisitScreen(nav, api, session, session.patients.getValue(it.arguments!!.getString("id")!!)) }
        composable("token/{id}") {
            val id = it.arguments!!.getString("id")!!
            TokenIssuedScreen(nav, session.patients.getValue(id), session.visits.getValue(id), session)
        }
        composable("board") { ReceptionQueueBoardScreen(DoctorApi(client)) }
        composable("appointments") { AppointmentsTodayScreen(AppointmentsApi(client)) }
        composable("book/{id}") { BookAppointmentScreen(nav, AppointmentsApi(client), session, session.patients.getValue(it.arguments!!.getString("id")!!)) }
        composable("visitors") { VisitorDeskScreen(nav, FrontOfficeApi(client)) }
        composable("register-visitor") { RegisterVisitorScreen(nav, FrontOfficeApi(client)) }
        composable("enquiries") { EnquiryDeskScreen(nav, FrontOfficeApi(client)) }
        composable("log-enquiry") { LogEnquiryScreen(nav, FrontOfficeApi(client)) }
    }
}

private data class Action(val id: String, val label: String, val detail: String, val icon: ImageVector, val route: String, val permission: String)

/**
 * The desk's front door: how many are waiting, then the three things a desk
 * does, in the order it does them. Each action is gated on its own permission
 * and absent without it — a front_office_staff sees the board and nothing to
 * register with, which is that role's grant, not a blank.
 */
@Composable
fun ReceptionHome(nav: NavHostController, queueApi: DoctorApi) {
    val identity = LocalIdentity.current
    val queue = remember { Remote<List<WorklistToken>>() }
    LaunchedEffect(Unit) { if (identity?.can("opd.queue.list") == true) queue.load { queueApi.listWorklist() } }
    val q by queue.state.collectAsState()
    val actions = listOf(
        Action("register", "Register a patient", "New walk-in: identity, safety flags, the desk's clinic.", Icons.Filled.PersonAdd, "register", "patients.create"),
        Action("find", "Find a patient", "By UHID, name or phone, anywhere in the hospital.", Icons.Filled.Search, "find", "patients.find"),
        Action("appointments", "Appointments today", "Check in the booked, mark the missing.", Icons.Filled.CalendarMonth, "appointments", "opd.appointment.list"),
        Action("queue", "Queue board", "Who is waiting, and one Call next for the floor.", Icons.Filled.Groups, "board", "opd.queue.list"),
        Action("visitors", "Visitor desk", "Passes, who is inside, and who is overdue.", Icons.Filled.Badge, "visitors", "front_office.passes.list"),
        Action("enquiries", "Enquiry desk", "What was asked at the door, and the answer given.", Icons.Filled.QuestionAnswer, "enquiries", "front_office.enquiry.list"),
    )
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("module-home-reception")) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            Eyebrow("Module")
            Text("Register, find, send to a clinic, call the floor.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Row(Modifier.padding(horizontal = 16.dp)) {
            CarbonStatTile("Waiting", q.value?.count { it.status == "waiting" }, "OPD tokens waiting now", Modifier.weight(1f))
            Spacer(Modifier.width(1.dp))
            CarbonStatTile("Called", q.value?.count { it.status == "called" }, "Called, not yet in", Modifier.weight(1f))
        }
        CarbonSectionTitle("Actions")
        val allowed = actions.filter { identity?.can(it.permission) == true }
        if (allowed.isEmpty()) {
            Text("Your role holds the reception module but none of its desk actions yet. Ask an administrator for one of its codes: patients, OPD queue, appointments, passes or enquiries.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp).testTag("reception-no-actions"))
        }
        allowed.forEach { act ->
            CarbonActionRow(act.label, act.detail, onClick = { nav.navigate(act.route) }, modifier = Modifier.fillMaxWidth().testTag("module-action-${act.id}")) {
                Icon(act.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
