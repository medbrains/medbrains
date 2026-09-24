package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import kotlinx.coroutines.launch
import uniffi.edge_rn.RegistrationDraft
import uniffi.edge_rn.RegistrationProblem
import uniffi.edge_rn.estimatedDateOfBirth
import uniffi.edge_rn.registrationAction
import uniffi.edge_rn.registrationCarriesOver
import uniffi.edge_rn.registrationProblem
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * One screen, no sections to scroll through: the person, the safety flags,
 * and the desk. "Check and register" runs the duplicate check first and never
 * creates silently — a match is confirmed, a check that could not run is said
 * out loud, and what happened is written into the record.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterPatientScreen(nav: NavHostController, api: ReceptionApi, session: ReceptionSession) {
    val scope = rememberCoroutineScope()
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("female") }
    var phone by remember { mutableStateOf("") }
    var dateOfBirth by remember { mutableStateOf<LocalDate?>(null) }
    var age by remember { mutableStateOf("") }
    var abha by remember { mutableStateOf("") }
    var isMedicoLegal by remember { mutableStateOf(false) }
    var mlcNumber by remember { mutableStateOf("") }
    var isVip by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<RegistrationProblem?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var candidates by remember { mutableStateOf<List<MatchCandidate>?>(null) }
    var checkUnavailable by remember { mutableStateOf(false) }
    var registered by remember { mutableStateOf<PatientSummary?>(null) }
    var pickingDate by remember { mutableStateOf(false) }

    fun err(field: String) = problem?.takeIf { it.field == field }?.message
    fun draft() = RegistrationDraft(firstName, lastName, phone, dateOfBirth?.toString() ?: "", age.trim().toUIntOrNull(), isMedicoLegal, mlcNumber, abha)

    suspend fun create(duplicateCheck: String, matchedUhid: String?) {
        busy = true
        try {
            val years = age.trim().toUIntOrNull() ?: 0u
            val dob = dateOfBirth?.toString() ?: estimatedDateOfBirth(years, LocalDate.now().year)
            val body = CreatePatientBody(
                first_name = firstName.trim(), last_name = lastName.trim(), gender = gender, phone = phone.trim(),
                date_of_birth = dob, is_dob_estimated = dateOfBirth == null,
                registration_type = "new", registration_source = session.source,
                referred_by_name = session.referredByName.takeIf { session.source == "referral" && it.isNotBlank() },
                department_id = session.departmentId, consultant_id = session.consultantId,
                abha_number = abha.filter { it.isDigit() }.ifEmpty { null },
                is_medico_legal = isMedicoLegal, mlc_number = if (isMedicoLegal) mlcNumber else null, is_vip = isVip,
                attributes = RegistrationAttributes(MobileRegistration(session.source, duplicateCheck, matchedUhid)),
            )
            registered = api.createPatient(body).also { session.patients[it.id] = it }
        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was registered." } finally { busy = false }
    }

    /** The core rule stops the tap; then the match; then the sheet, the warning, or the create. */
    suspend fun checkAndRegister() {
        problem = registrationProblem(draft())
        if (problem != null) return
        failure = null
        if (checkUnavailable) { create("unverified", null); return }
        busy = true
        val found = runCatching { api.matchPatients(MatchQuery(firstName.trim(), lastName.trim(), dateOfBirth?.toString(), phone.trim())) }.getOrNull()
        busy = false
        when (registrationAction(found == null, (found?.size ?: 0).toUInt())) {
            "confirm" -> candidates = found
            "proceed_unverified" -> checkUnavailable = true
            else -> create("none", null)
        }
    }

    /** The person is cleared; the desk stays. Which is which is the core's call. */
    fun nextWalkIn() {
        registered = null; checkUnavailable = false; problem = null
        listOf("first_name", "last_name", "phone", "date_of_birth", "age_years", "abha_number", "is_medico_legal", "mlc_number", "is_vip").filterNot { registrationCarriesOver(it) }.forEach {
            when (it) {
                "first_name" -> firstName = ""; "last_name" -> lastName = ""; "phone" -> phone = ""
                "date_of_birth" -> dateOfBirth = null; "age_years" -> age = ""; "abha_number" -> abha = ""
                "is_medico_legal" -> isMedicoLegal = false; "mlc_number" -> mlcNumber = ""; "is_vip" -> isVip = false
            }
        }
        gender = "female"
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-register-patient")) {
        CarbonPageHeader("Reception", "Register a patient", "Two identifiers, a phone, and where they are going.")
        val done = registered
        if (done != null) {
            RegisteredCard(nav, done, ::nextWalkIn)
        } else {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CarbonSectionTitle("Person")
                CarbonTextField(firstName, { firstName = it }, "First name", Modifier.testTag("field-first_name"), error = err("first_name"))
                CarbonTextField(lastName, { lastName = it }, "Last name", Modifier.testTag("field-last_name"), error = err("last_name"))
                Column {
                    Text("Gender", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("field-gender")) {
                        listOf("female" to "Female", "male" to "Male", "other" to "Other", "unknown" to "Unknown").forEachIndexed { i, (v, label) ->
                            SegmentedButton(selected = gender == v, onClick = { gender = v }, shape = SegmentedButtonDefaults.itemShape(i, 4), modifier = Modifier.testTag("gender-$v")) { Text(label) }
                        }
                    }
                }
                CarbonTextField(phone, { phone = it }, "Phone", Modifier.testTag("field-phone"), error = err("phone"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                Column {
                    Text("Date of birth", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    CarbonTertiaryButton(dateOfBirth?.toString() ?: "Pick a date", onClick = { pickingDate = true }, modifier = Modifier.fillMaxWidth().testTag("field-date_of_birth"))
                    err("date_of_birth")?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                }
                CarbonTextField(age, { age = it }, "Or age in years, if they do not know the date", Modifier.testTag("field-age"), error = err("age_years"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                CarbonTextField(abha, { abha = it }, "ABHA number (optional)", Modifier.testTag("field-abha_number"), error = err("abha_number"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))

                CarbonSectionTitle("Safety")
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Medico-legal case", style = MaterialTheme.typography.bodyLarge)
                    Switch(checked = isMedicoLegal, onCheckedChange = { isMedicoLegal = it }, modifier = Modifier.testTag("switch-mlc").semantics { contentDescription = "Medico-legal case" })
                }
                if (isMedicoLegal) CarbonTextField(mlcNumber, { mlcNumber = it }, "MLC number", Modifier.testTag("field-mlc_number"), error = err("mlc_number"))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("VIP", style = MaterialTheme.typography.bodyLarge)
                    Switch(checked = isVip, onCheckedChange = { isVip = it }, modifier = Modifier.testTag("switch-vip").semantics { contentDescription = "VIP" })
                }

                CarbonSectionTitle("Desk — kept for the next walk-in")
                CarbonPicker("Department", session.departments.map { PickerOption(it.id, it.name) }, session.departmentId, { session.departmentId = it }, placeholder = "No department yet", tag = "picker-department")
                CarbonPicker("Consultant", session.doctors.map { PickerOption(it.id, it.full_name) }, session.consultantId, { session.consultantId = it }, placeholder = "Any consultant", tag = "picker-consultant")
                Column {
                    Text("Coming from", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("field-source")) {
                        listOf("walk_in" to "Walk-in", "referral" to "Referral").forEachIndexed { i, (v, label) ->
                            SegmentedButton(selected = session.source == v, onClick = { session.source = v }, shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(label) }
                        }
                    }
                }
                if (session.source == "referral") CarbonTextField(session.referredByName, { session.referredByName = it }, "Referred by", Modifier.testTag("field-referred_by_name"))

                if (checkUnavailable) CarbonNotification(NotificationKind.Warning, "Duplicate check unavailable", "Nobody was compared. Registering now may give this person a second UHID; the record will say the check did not run.")
                failure?.let { CarbonNotification(NotificationKind.Error, "Not registered", it) }
                CarbonPrimaryButton(if (checkUnavailable) "Register unverified" else "Check and register", enabled = !busy, modifier = Modifier.testTag("register-submit"), onClick = { scope.launch { checkAndRegister() } })
            }
        }
    }

    if (pickingDate) {
        val state = rememberDatePickerState(initialSelectedDateMillis = dateOfBirth?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { pickingDate = false },
            confirmButton = { TextButton(onClick = { dateOfBirth = state.selectedDateMillis?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }; pickingDate = false }, modifier = Modifier.testTag("date-ok")) { Text("Use this date") } },
            dismissButton = { TextButton(onClick = { pickingDate = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }

    candidates?.let { found ->
        ModalBottomSheet(onDismissRequest = { candidates = null }, modifier = Modifier.testTag("duplicate-sheet")) {
            Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CarbonPageHeader("Possible duplicate", "${found.size} existing record${if (found.size == 1) "" else "s"} match", "A second UHID splits allergies, history and results across two records. Use the existing record if it is the same person.")
                found.forEach { c ->
                    Column(Modifier.fillMaxWidth().testTag("duplicate-use-${c.uhid}")) {
                        CarbonRow("${c.first_name} ${c.last_name}", "${c.uhid} · ${c.date_of_birth ?: "DOB unknown"} · ${c.phone}")
                        CarbonTertiaryButton("Use this record", onClick = {
                            val p = c.asSummary(); session.patients[p.id] = p; candidates = null; nav.navigate("patient/${p.id}")
                        }, modifier = Modifier.fillMaxWidth())
                    }
                }
                CarbonDangerButton("Register as new anyway", onClick = { candidates = null; scope.launch { create("overridden", found.firstOrNull()?.uhid) } }, modifier = Modifier.fillMaxWidth().testTag("duplicate-register-anyway"))
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

/** The UHID in display type, then the identifiers the desk reads back. */
@Composable
private fun RegisteredCard(nav: NavHostController, patient: PatientSummary, onNext: () -> Unit) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CarbonTonedTile(CarbonTone.Success) {
            Eyebrow("Registered")
            // A live region: TalkBack reads the UHID the moment it lands.
            Text(patient.uhid, style = MaterialTheme.typography.displaySmall, modifier = Modifier.testTag("registered-uhid").semantics { liveRegion = LiveRegionMode.Polite; contentDescription = "Registered. UHID ${patient.uhid}" })
            Text(patient.fullName, style = MaterialTheme.typography.headlineSmall)
            Text("${patient.date_of_birth ?: "DOB unknown"}${if (patient.is_dob_estimated == true) " (estimated)" else ""} · ${patient.phone}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (patient.is_medico_legal == true) CarbonTag("MLC ${patient.mlc_number.orEmpty()}", CarbonTone.Danger)
                if (patient.is_vip == true) CarbonTag("VIP", CarbonTone.Info)
            }
        }
        CarbonPrimaryButton("Start visit", modifier = Modifier.testTag("register-start-visit"), onClick = { nav.navigate("start-visit/${patient.id}") })
        CarbonTertiaryButton("Next walk-in", onClick = onNext, modifier = Modifier.fillMaxWidth().testTag("register-next"))
    }
}
