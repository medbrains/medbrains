package com.medbrains.staff.abdm

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.medbrains.kit.Abha
import com.medbrains.kit.AbhaApi
import com.medbrains.kit.AbhaField
import com.medbrains.kit.AbhaVerificationStep
import com.medbrains.kit.AbdmProfileShare
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.OurDetails
import com.medbrains.kit.Remote
import com.medbrains.kit.ScanShare
import com.medbrains.kit.ScanShareApi
import com.medbrains.kit.ShareCandidate
import com.medbrains.staff.reception.MatchQuery
import com.medbrains.staff.reception.PatientSummary
import com.medbrains.staff.reception.ReceptionApi
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * A share whose ABHA is on no patient here, for a person who may already be
 * registered (before ABHA): the likely matches by mobile, name and date of
 * birth, and a search. Picking one goes on to compare and link; registering
 * stays possible, after the warning. Mirrors `ScanShareFindDrawer`.
 */
@Composable
fun ScanShareFindScreen(desk: ScanShareDesk, api: ReceptionApi, share: AbdmProfileShare, registering: Boolean) {
    val scope = rememberCoroutineScope()
    val identity = LocalIdentity.current
    val matches = remember { Remote<List<ShareCandidate>>() }
    val results = remember { Remote<List<PatientSummary>>() }
    var query by remember { mutableStateOf(ScanShare.name(share.profile)) }
    var searched by remember { mutableStateOf(false) }
    suspend fun loadMatches() = matches.load {
        val q = ScanShare.matchQuery(share.profile)
        ScanShare.rank(share.profile, api.matchPatients(MatchQuery(q.firstName, q.lastName, q.dateOfBirth, q.phone)).map { it.asMatch() })
    }
    fun search() { searched = true; scope.launch { results.load { api.searchPatients(query.trim()) } } }
    fun pick(patientId: String) { scope.launch { desk.use(share, ScanShare.Intent.COMPARE, picked = patientId) } }
    LaunchedEffect(share.id) { if (identity.canMatchPatients) loadMatches() }
    val matchState by matches.state.collectAsState()
    val searchState by results.state.collectAsState()
    val p = share.profile

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-share-find")) {
        CarbonPageHeader("Scan & Share", "Find existing patient", listOfNotNull("Shared by ${ScanShare.name(p)}", p.mobile, p.date_of_birth?.let { "born $it" }).joinToString(" · "))
        desk.failure?.let { CarbonNotification(NotificationKind.Error, "Not done", it, Modifier.padding(horizontal = 16.dp)) }
        if (identity.canMatchPatients) {
            RemoteContent("share-candidates", matchState, "Could not check for existing patients", "Nobody has been compared — search below before registering.", { it.isEmpty() }, "No likely match", "No patient here shares this name, mobile or date of birth.", { scope.launch { loadMatches() } }) { ranked ->
                Column {
                    if (registering && ranked.any { it.isLikely }) {
                        CarbonNotification(NotificationKind.Warning, "This may be an existing patient", "Registering again would give the same person a second UHID. Link instead if one of these is them.", Modifier.padding(16.dp).testTag("share-likely-warning"))
                    }
                    ranked.take(ScanShare.CANDIDATE_LIMIT).forEach { c ->
                        CarbonActionRow("${c.match.firstName} ${c.match.lastName}", listOfNotNull(c.match.uhid, c.match.dateOfBirth, c.match.phone).joinToString(" · "), onClick = { pick(c.match.id) }, modifier = Modifier.testTag("share-candidate-${c.match.uhid}")) {
                            Column {
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { c.reasons.forEach { CarbonTag(it, CarbonTone.Info) } }
                                Text(if (c.isLikely) "Link instead" else "Compare and link", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
        }
        if (identity?.can(AbdmPermission.FIND_PATIENT) == true) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonTextField(query, { query = it }, "Search by name, phone or UHID", Modifier.testTag("share-search"), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { search() }))
                CarbonTertiaryButton("Search", enabled = query.isNotBlank(), onClick = ::search, modifier = Modifier.fillMaxWidth().testTag("share-search-submit"))
            }
            if (searched) {
                RemoteContent("share-search", searchState, "Couldn't search", "The hospital server did not answer. Do not read this as \"not registered\".", { it.isEmpty() }, "No patient by that name, phone or UHID", "Check the spelling, or register them.", ::search) { rows ->
                    Column { rows.forEach { r -> CarbonActionRow(r.fullName, r.identifiers, onClick = { pick(r.id) }, modifier = Modifier.testTag("share-search-row-${r.id}")) } }
                }
            }
        }
        if (registering) {
            CarbonDangerButton("Register new anyway", enabled = !desk.busy, onClick = { scope.launch { desk.use(share, ScanShare.Intent.REGISTER) } }, modifier = Modifier.padding(16.dp).testTag("share-register-anyway"))
        }
    }
}

/**
 * A shared ABHA profile beside the patient's record: where they differ the
 * desk chooses which to keep (ours until it says otherwise), then the ABHA
 * is linked through the verified path and the share marked dealt with.
 */
@Composable
fun ScanShareCompareScreen(desk: ScanShareDesk, api: ReceptionApi, shareId: String, step: AbhaVerificationStep, patientId: String, onDone: (PatientSummary) -> Unit) {
    val scope = rememberCoroutineScope()
    val client = LocalApiClient.current
    val patient = remember { Remote<PatientSummary>() }
    var apply by remember { mutableStateOf<Set<AbhaField>>(emptySet()) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(patientId) { patient.load { api.patient(patientId) } }
    val state by patient.state.collectAsState()

    fun link(p: PatientSummary) = scope.launch {
        busy = true; failure = null
        try {
            AbhaApi(client).link(step.id, p.id, apply)
            ScanShareApi(client).complete(shareId, p.id)
            desk.reload()
            onDone(p)
        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was linked." } finally { busy = false }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-share-compare")) {
        CarbonPageHeader("Scan & Share", "Compare and link")
        desk.notice?.let { CarbonNotification(NotificationKind.Info, "Note", it, Modifier.padding(horizontal = 16.dp)) }
        RemoteContent("share-compare", state, "Could not load the patient", "The record failed to load; nothing was changed.", { false }, "", "", { scope.launch { patient.load { api.patient(patientId) } } }) { p ->
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("${p.uhid} · ${p.fullName}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.testTag("share-compare-patient"))
                step.profile?.let { profile ->
                    val ours = OurDetails(p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.gender)
                    if (Abha.defaultApply(profile, ours).isEmpty()) Text("The shared profile matches this record.", style = MaterialTheme.typography.bodyMedium)
                    AbhaCompare(profile, ours, apply, { apply = it }, oursLabel = "On the record")
                }
                failure?.let { CarbonNotification(NotificationKind.Error, "Could not link the ABHA", it) }
                CarbonPrimaryButton("Link to this patient", enabled = !busy && step.profile != null, modifier = Modifier.testTag("share-link"), onClick = { link(p) })
            }
        }
    }
}
