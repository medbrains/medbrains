package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiClient
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import uniffi.edge_rn.appointmentActions
import uniffi.edge_rn.slotIsBookable
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** A booking as the desk sees it. The list answer flattens the appointment with the patient's and doctor's names. */
@Serializable
data class AppointmentSummary(
    val id: String,
    val patient_id: String,
    val doctor_id: String,
    val department_id: String,
    val appointment_date: String,
    val slot_start: String,
    val slot_end: String,
    val status: String,
    val token_number: Int? = null,
    val reason: String? = null,
    val encounter_id: String? = null,
    val patient_name: String? = null,
    val doctor_name: String? = null,
    /** The server's own answer: check-in and no-show hop to the patient and refuse without access. */
    val can_manage: Boolean = true,
) { val time: String get() = slot_start.take(5) }

/** What `check-in`, `no-show` and `book` answer: the appointment itself, without the list's names and permission. */
@Serializable
data class AppointmentRecord(
    val id: String,
    val doctor_id: String,
    val appointment_date: String,
    val slot_start: String,
    val status: String,
    val token_number: Int? = null,
    val encounter_id: String? = null,
) { val time: String get() = slot_start.take(5) }

@Serializable
data class AvailableSlot(val start_time: String, val end_time: String, val booked_count: Int, val max_patients: Int, val is_available: Boolean) { val time: String get() = start_time.take(5) }

@Serializable
data class BookBody(val patient_id: String, val doctor_id: String, val department_id: String, val appointment_date: String, val slot_start: String, val slot_end: String, val appointment_type: String)

class AppointmentsApi(private val client: ApiClient) {
    suspend fun appointments(date: String): List<AppointmentSummary> = client.get("/api/opd/appointments?date=$date")
    suspend fun checkIn(id: String): AppointmentRecord = client.put("/api/opd/appointments/$id/check-in")
    suspend fun noShow(id: String): AppointmentRecord = client.put("/api/opd/appointments/$id/no-show")
    suspend fun slots(doctorId: String, date: String): List<AvailableSlot> = client.get("/api/opd/doctors/$doctorId/slots?date=$date")
    suspend fun book(body: BookBody): AppointmentRecord = client.post("/api/opd/appointments", body)
}

private fun tone(status: String) = when (status) {
    "checked_in", "in_consultation" -> CarbonTone.Info
    "completed" -> CarbonTone.Success
    "no_show", "cancelled" -> CarbonTone.Danger
    else -> CarbonTone.Warning
}

/** Today's bookings in time order. A row offers only what the core says the server will accept; check-in issues the token, which the row then shows. */
@Composable
fun AppointmentsTodayScreen(api: AppointmentsApi) {
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    val today = LocalDate.now().toString()
    val remote = remember { Remote<List<AppointmentSummary>>() }
    var busyId by remember { mutableStateOf<String?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { remote.load { api.appointments(today) } }
    val state by remote.state.collectAsState()
    val canAct = identity?.can("opd.appointment.update") == true

    fun act(a: AppointmentSummary, checkIn: Boolean) {
        scope.launch {
            busyId = a.id; failure = null
            try { if (checkIn) api.checkIn(a.id) else api.noShow(a.id); remote.load { api.appointments(today) } }
            catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was recorded." } finally { busyId = null }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-appointments")) {
        CarbonPageHeader("Reception", "Appointments today", today)
        failure?.let { CarbonNotification(NotificationKind.Error, "Not recorded", it, Modifier.padding(16.dp)) }
        RemoteContent("appointments", state, "Couldn't load today's bookings", "The hospital server did not answer. Do not read this as a free day.", { it.isEmpty() }, "No appointments today", "Nothing booked for today. Walk-ins go through Register.", { scope.launch { remote.load { api.appointments(today) } } }) { rows ->
            Column {
                rows.sortedBy { it.slot_start }.forEach { a ->
                    val actions = if (canAct && a.can_manage) appointmentActions(a.status, a.appointment_date == today) else emptyList()
                    Column(Modifier.fillMaxWidth().testTag("appt-row-${a.id}")) {
                        CarbonActionRow("${a.time} · ${a.patient_name ?: "Unnamed patient"}", a.doctor_name, onClick = {}) { CarbonTag(a.status.replace('_', ' '), tone(a.status)) }
                        if (a.status == "checked_in" && a.token_number != null) {
                            Text("Token ${a.token_number}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp).testTag("appt-token-${a.id}").semantics { liveRegion = LiveRegionMode.Polite })
                        }
                        if (canAct && !a.can_manage) {
                            Text("Booked at another desk — this account cannot check them in.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).testTag("appt-not-yours-${a.id}"))
                        }
                        if (actions.isNotEmpty()) {
                            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if ("check_in" in actions) CarbonPrimaryButton("Check in", enabled = busyId == null, modifier = Modifier.weight(1f).testTag("appt-check-in-${a.id}"), onClick = { act(a, true) })
                                if ("no_show" in actions) CarbonTertiaryButton("No-show", onClick = { act(a, false) }, modifier = Modifier.weight(1f).testTag("appt-no-show-${a.id}"))
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Doctor, date, then the day's slots the core says may be offered; one tap picks, one confirms. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookAppointmentScreen(nav: NavHostController, api: AppointmentsApi, session: ReceptionSession, patient: PatientSummary) {
    val scope = rememberCoroutineScope()
    var doctorId by remember { mutableStateOf(session.consultantId) }
    var departmentId by remember { mutableStateOf(session.departmentId) }
    var date by remember { mutableStateOf(LocalDate.now().plusDays(1)) }
    var pickingDate by remember { mutableStateOf(false) }
    val slots = remember { Remote<List<AvailableSlot>>() }
    var chosen by remember { mutableStateOf<AvailableSlot?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    var booked by remember { mutableStateOf<AppointmentRecord?>(null) }
    LaunchedEffect(doctorId, date) { chosen = null; doctorId?.let { d -> slots.load { api.slots(d, date.toString()) } } }
    val state by slots.state.collectAsState()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-book-appointment")) {
        CarbonPageHeader("Book appointment", patient.fullName, patient.identifiers)
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val done = booked
            if (done != null) {
                CarbonTonedTile(CarbonTone.Success) {
                    Eyebrow("Booked")
                    Text("${done.appointment_date} at ${done.time}", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.testTag("booked-card").semantics { liveRegion = LiveRegionMode.Polite })
                    Text(session.doctors.firstOrNull { it.id == done.doctor_id }?.full_name ?: "Consultant", style = MaterialTheme.typography.bodyLarge)
                    Text(patient.identifiers, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                CarbonPrimaryButton("Done", modifier = Modifier.testTag("booked-done"), onClick = { nav.popBackStack() })
            } else {
                CarbonPicker("Doctor", session.doctors.map { PickerOption(it.id, it.full_name) }, doctorId, { doctorId = it }, placeholder = "Choose a doctor", allowNone = false, tag = "picker-doctor")
                CarbonPicker("Department", session.departments.map { PickerOption(it.id, it.name) }, departmentId, { departmentId = it }, placeholder = "Choose a department", allowNone = false, tag = "picker-department")
                Column {
                    Text("Date", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    CarbonTertiaryButton(date.toString(), onClick = { pickingDate = true }, modifier = Modifier.fillMaxWidth().testTag("field-date"))
                }
                if (doctorId != null) {
                    RemoteContent("slots", state, "Couldn't load the slots", "The hospital server did not answer.", { it.isEmpty() }, "No slots that day", "Nothing left to offer on that date. Try another day.", { scope.launch { doctorId?.let { d -> slots.load { api.slots(d, date.toString()) } } } }) { rows ->
                        val today = LocalDate.now().toString(); val now = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"))
                        val offered = rows.filter { slotIsBookable(date.toString(), it.start_time, today, now, it.is_available) }
                        Column {
                            if (offered.isEmpty()) Text("Every slot that day has passed or is full.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp).testTag("slots-none-offered"))
                            offered.forEach { s ->
                                CarbonActionRow("${s.time} – ${s.end_time.take(5)}", "${s.booked_count} of ${s.max_patients} booked", onClick = { chosen = s }, modifier = Modifier.fillMaxWidth().testTag("slot-${s.start_time}")) {
                                    if (chosen?.start_time == s.start_time) CarbonTag("chosen", CarbonTone.Info)
                                }
                            }
                        }
                    }
                }
                failure?.let { CarbonNotification(NotificationKind.Error, "Not booked", it) }
                CarbonPrimaryButton(chosen?.let { "Book ${it.time}" } ?: "Choose a slot", enabled = !busy && chosen != null && doctorId != null && departmentId != null, modifier = Modifier.testTag("book-submit"), onClick = {
                    val d = doctorId ?: return@CarbonPrimaryButton; val dept = departmentId ?: return@CarbonPrimaryButton; val s = chosen ?: return@CarbonPrimaryButton
                    scope.launch {
                        busy = true; failure = null
                        try { booked = api.book(BookBody(patient.id, d, dept, date.toString(), s.start_time, s.end_time, "new_visit")) }
                        catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was booked." } finally { busy = false }
                    }
                })
            }
        }
    }
    if (pickingDate) {
        val stateP = rememberDatePickerState(initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(onDismissRequest = { pickingDate = false },
            confirmButton = { TextButton(onClick = { stateP.selectedDateMillis?.let { date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }; pickingDate = false }, modifier = Modifier.testTag("date-ok")) { Text("Use this date") } },
            dismissButton = { TextButton(onClick = { pickingDate = false }) { Text("Cancel") } }) { DatePicker(state = stateP) }
    }
}
