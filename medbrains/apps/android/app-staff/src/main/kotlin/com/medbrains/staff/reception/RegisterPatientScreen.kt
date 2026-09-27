package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.staff.shared.forms.OptionSource
import com.medbrains.staff.shared.forms.CatalogueLookups
import com.medbrains.staff.shared.forms.CatalogueField
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.LocalApiClient
import com.medbrains.staff.shared.forms.CatalogueFieldView
import com.medbrains.staff.shared.forms.CatalogueOption
import com.medbrains.staff.shared.forms.OptionLists
import com.medbrains.staff.shared.forms.RegistrationCatalogue
import com.medbrains.staff.shared.forms.RegistrationDraftValues
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import uniffi.edge_rn.RegistrationProblem
import uniffi.edge_rn.registrationAction
import java.time.LocalDate

/**
 * Registration, step by step, as the shared core defines it: the catalogue
 * says which fields each step has and which are on screen, the core's rules
 * say what is wrong, and the core builds the request. This screen only draws
 * and sends. "Check and register" runs the duplicate check first and never
 * creates silently — a match is confirmed, a check that could not run is
 * said out loud, and what happened is written into the record.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterPatientScreen(
    nav: NavHostController,
    api: ReceptionApi,
    session: ReceptionSession,
    // Registering at a camp: the form starts as the camp's, and the patient
    // is put on the camp's route (a camp number) once registered.
    camp: CampSummary? = null,
) {
    val scope = rememberCoroutineScope()
    val catalogue = RegistrationCatalogue.shared
    val draft = remember { RegistrationDraftValues() }
    // 0…3 are the catalogue's steps; the last is Review.
    var stepIndex by remember { mutableIntStateOf(0) }
    var shown by remember { mutableStateOf<List<RegistrationProblem>>(emptyList()) }
    var failure by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var candidates by remember { mutableStateOf<List<MatchCandidate>?>(null) }
    var checkUnavailable by remember { mutableStateOf(false) }
    var registered by remember { mutableStateOf<PatientSummary?>(null) }
    var campNumber by remember { mutableStateOf<String?>(null) }
    val identity = LocalIdentity.current
    val client = LocalApiClient.current
    val lookupsApi = remember { CatalogueLookups(client) }

    /** The search a field may run, gated on its own lookup code; null where the role may not (the field then takes typed text). */
    fun lookups(field: CatalogueField): CatalogueLookups? = when (field.options.source) {
        OptionSource.ICD11 -> lookupsApi.takeIf { identity?.can("terminology.search") == true }
        OptionSource.DRUG_CATALOGUE -> lookupsApi.takeIf { identity?.canAny(listOf("pharmacy.catalog.lookup", "patients.create")) == true }
        else -> null
    }
    val stepCount = catalogue.steps.size + 1
    val onReview = stepIndex == catalogue.steps.size
    val lists = OptionLists(
        departments = session.departments.map { CatalogueOption(it.id, it.name) },
        doctors = session.doctors.map { CatalogueOption(it.id, it.full_name) },
        camps = session.camps.map { CatalogueOption(it.id, it.name) },
    )

    /** The desk's department and consultant, kept between walk-ins — and at a camp, the camp itself, as the web's camp mode starts. */
    fun takeDeskContext() {
        if (camp != null && draft["camp_id"].isEmpty()) {
            draft["registration_type"] = "camp"; draft["registration_source"] = "camp"
            draft["camp_id"] = camp.id; draft["camp_name"] = camp.name
            camp.organizing_department_id?.let { draft["department_id"] = it }
            draft["referred_by_facility"] = camp.venue_name ?: camp.name
        }
        if (draft["department_id"].isEmpty()) session.departmentId?.let { draft["department_id"] = it }
        if (draft["consultant_id"].isEmpty()) session.consultantId?.let { draft["consultant_id"] = it }
    }
    LaunchedEffect(Unit) { takeDeskContext() }

    /** The problems on screen in [step] (null: every step). */
    fun problems(step: String?): List<RegistrationProblem> {
        val visible = draft.visible()
        val ids = catalogue.fields.filter { step == null || it.step == step }.map { it.id }.toSet()
        return draft.problems().filter { it.field in ids && it.field in visible }
    }

    fun next() {
        shown = problems(catalogue.steps[stepIndex].step)
        if (shown.isEmpty()) stepIndex += 1
    }

    /**
     * At a camp, the record — just registered, or one that already existed —
     * goes on the camp's route: no second UHID, and a camp number. The record
     * is shown either way; a failed link says it is not on the route yet and
     * offers the link again.
     */
    suspend fun putOnCampRoute(patient: PatientSummary) {
        val c = camp ?: return
        registered = patient; failure = null; busy = true
        try {
            campNumber = api.linkToCamp(CampRegistrationLink(
                c.id, patient.fullName, draft["gender"].ifEmpty { null }, patient.phone, patient.id,
                draft["department_id"].ifEmpty { null }, draft["consultant_id"].ifEmpty { null }, draft["initial_diagnosis_text"].ifEmpty { null }, true,
            )).token_number
        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server." } finally { busy = false }
    }

    suspend fun create(duplicateCheck: String, matchedUhid: String?) {
        busy = true
        try {
            val request = Json.parseToJsonElement(draft.request(LocalDate.now().year)).jsonObject
            // How this registration was checked, so a second UHID is never silent.
            val audit = JsonObject(mapOf(
                "source" to JsonPrimitive("mobile_staff"), "duplicate_check" to JsonPrimitive(duplicateCheck),
                "matched_uhid" to (matchedUhid?.let { JsonPrimitive(it) } ?: JsonNull),
            ))
            val attributes = JsonObject((request["attributes"]?.jsonObject ?: JsonObject(emptyMap())) + ("mobile_registration" to audit))
            val patient = api.createPatient(JsonObject(request + ("attributes" to attributes)).toString())
            session.patients[patient.id] = patient
            registered = patient
            draft["department_id"].ifEmpty { null }?.let { session.departmentId = it }
            session.consultantId = draft["consultant_id"].ifEmpty { null }
            if (camp != null) {
                // The camp's route queues them; no separate OPD visit.
                putOnCampRoute(patient)
            } else if (draft.isOn("create_opd_visit") && draft["department_id"].isNotEmpty()) {
                val visit = api.startVisit(StartVisitBody(patient.id, draft["department_id"], draft["consultant_id"].ifEmpty { null }, draft["initial_diagnosis_text"].ifEmpty { null }, "walk_in"))
                session.visits[patient.id] = visit
                nav.navigate("token/${patient.id}")
            }
        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was registered." } finally { busy = false }
    }

    /** Every step's rules first; then the match; then the sheet, the warning, or the create. */
    suspend fun checkAndRegister() {
        val all = problems(null)
        all.firstOrNull()?.let { first ->
            shown = all
            catalogue.steps.indexOfFirst { it.step == catalogue.field(first.field)?.step }.takeIf { it >= 0 }?.let { stepIndex = it }
            return
        }
        failure = null
        if (checkUnavailable) { create("unverified", null); return }
        busy = true
        val found = if (draft.isOn("is_unknown_patient")) emptyList() else runCatching {
            api.matchPatients(MatchQuery(draft["first_name"], draft["last_name"], draft["date_of_birth"].ifEmpty { null }, draft["phone"]))
        }.getOrNull()
        busy = false
        when (registrationAction(found == null, (found?.size ?: 0).toUInt())) {
            "confirm" -> candidates = found
            "proceed_unverified" -> checkUnavailable = true
            else -> create("none", null)
        }
    }

    /** The person is cleared; the desk stays. */
    fun nextWalkIn() {
        registered = null; campNumber = null; checkUnavailable = false; shown = emptyList(); failure = null
        draft.clearPerson()
        stepIndex = 0
        takeDeskContext()
    }

    Column(Modifier.fillMaxSize().imePadding().testTag("screen-register-patient")) {
        val scroll = rememberScrollState()
        // Where each field sits in the scrolling column, to bring a refused one into view.
        val fieldTops = remember { mutableStateMapOf<String, Int>() }
        // A new step opens at its top, never where the last one was scrolled to.
        LaunchedEffect(stepIndex) { scroll.scrollTo(0) }
        // A refused step shows the first field to fix, not wherever the desk was.
        LaunchedEffect(shown) { shown.firstOrNull()?.let { p -> fieldTops[p.field]?.let { scroll.animateScrollTo(it) } } }
        Column(Modifier.weight(1f).verticalScroll(scroll).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val title = if (onReview) "Review" else catalogue.steps[stepIndex].title
            Column(Modifier.testTag("register-step-title")) { CarbonPageHeader(camp?.name ?: "Reception", "Register a patient", "Step ${stepIndex + 1} of $stepCount · $title") }
            LinearProgressIndicator(progress = { (stepIndex + 1).toFloat() / stepCount }, modifier = Modifier.fillMaxWidth())
            val done = registered
            if (done != null) {
                RegisteredCard(nav, done, camp != null, campNumber, ::nextWalkIn)
                if (camp != null && campNumber == null) failure?.let {
                    CarbonNotification(NotificationKind.Error, "Not on the camp's route yet", "The record is saved. $it")
                    CarbonTertiaryButton("Try again", onClick = { scope.launch { putOnCampRoute(done) } }, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("camp-link-retry"))
                }
            } else {
                val visible = draft.visible()
                if (onReview) {
                    RegistrationReview(draft, lists, visible, onEdit = { stepIndex = it })
                } else {
                    catalogue.fieldsIn(catalogue.steps[stepIndex].step).filter { it.id in visible }.forEach { field ->
                        Box(Modifier.onGloballyPositioned { fieldTops[field.id] = it.positionInParent().y.toInt() }) {
                            CatalogueFieldView(field, draft, lists, shown.firstOrNull { it.field == field.id }?.message, lookups(field))
                        }
                    }
                }
                if (checkUnavailable) CarbonNotification(NotificationKind.Warning, "Duplicate check unavailable", "Nobody was compared. Registering now may give this person a second UHID; the record will say the check did not run.")
                failure?.let { CarbonNotification(NotificationKind.Error, "Not registered", it) }
            }
        }
        if (registered == null) {
            Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (stepIndex > 0) CarbonTertiaryButton("Back", onClick = { shown = emptyList(); stepIndex -= 1 }, modifier = Modifier.weight(1f).testTag("register-step-back"))
                if (onReview) {
                    CarbonPrimaryButton(if (checkUnavailable) "Register unverified" else "Check and register", enabled = !busy, modifier = Modifier.weight(2f).testTag("register-submit"), onClick = { scope.launch { checkAndRegister() } })
                } else {
                    CarbonPrimaryButton("Next", modifier = Modifier.weight(2f).testTag("register-step-next"), onClick = { next() })
                }
            }
        }
    }

    candidates?.let { found ->
        ModalBottomSheet(onDismissRequest = { candidates = null }, modifier = Modifier.testTag("duplicate-sheet")) {
            Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CarbonPageHeader("Possible duplicate", "${found.size} existing record${if (found.size == 1) "" else "s"} match", "A second UHID splits allergies, history and results across two records. Use the existing record if it is the same person.")
                found.forEach { c ->
                    Column(Modifier.fillMaxWidth().testTag("duplicate-use-${c.uhid}")) {
                        CarbonRow("${c.first_name} ${c.last_name}", "${c.uhid} · ${c.date_of_birth ?: "DOB unknown"} · ${c.phone}")
                        CarbonTertiaryButton("Use this record", onClick = {
                            val p = c.asSummary(); session.patients[p.id] = p; candidates = null
                            // At a camp the record goes on the camp's route here; at the desk, to its page.
                            if (camp != null) scope.launch { putOnCampRoute(p) } else nav.navigate("patient/${p.id}")
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
private fun RegisteredCard(nav: NavHostController, patient: PatientSummary, atCamp: Boolean, campNumber: String?, onNext: () -> Unit) {
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
        if (campNumber != null) {
            // At a camp: the number they are called by at every station.
            CarbonTonedTile(CarbonTone.Info) {
                Eyebrow("Camp number")
                Text(campNumber, style = MaterialTheme.typography.displaySmall, modifier = Modifier.testTag("registered-camp-number"))
            }
        } else if (!atCamp) {
            // At a camp the route is the visit: no OPD start, nor its route in the camp's navigation.
            CarbonPrimaryButton("Start visit", modifier = Modifier.testTag("register-start-visit"), onClick = { nav.navigate("start-visit/${patient.id}") })
        }
        CarbonTertiaryButton("Next walk-in", onClick = onNext, modifier = Modifier.fillMaxWidth().testTag("register-next"))
    }
}
