package com.medbrains.staff.reception

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiClient
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonStatTile
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import uniffi.edge_rn.passActions
import uniffi.edge_rn.passIsInside
import uniffi.edge_rn.passState
import java.time.Instant

@Serializable
data class VisitorRow(
    val id: String,
    val visitor_name: String,
    val phone: String? = null,
    val relationship: String? = null,
    val category: String,
    val patient_id: String? = null,
    val purpose: String? = null,
)

@Serializable
data class PassRow(
    val id: String,
    val registration_id: String,
    val pass_number: String,
    val bed_number: String? = null,
    val valid_from: String,
    val valid_until: String,
    val status: String,
    val revoked_reason: String? = null,
)

@Serializable data class VisitorLogRow(val id: String, val pass_id: String, val check_in_at: String, val check_out_at: String? = null)
@Serializable data class NewVisitorBody(val visitor_name: String, val phone: String?, val relationship: String?, val purpose: String?, val patient_id: String?, val category: String)
@Serializable data class NewPassBody(val registration_id: String, val bed_number: String?, val valid_hours: Int)
@Serializable data class RevokeBody(val reason: String)
@Serializable data class EnquiryRow(val id: String, val caller_name: String? = null, val caller_phone: String? = null, val enquiry_type: String, val response_text: String? = null, val resolved: Boolean, val created_at: String)
@Serializable data class NewEnquiryBody(val caller_name: String?, val caller_phone: String?, val enquiry_type: String, val response_text: String?)

class FrontOfficeApi(private val client: ApiClient) {
    suspend fun visitors(): List<VisitorRow> = client.get("/api/front-office/visitors")
    suspend fun registerVisitor(body: NewVisitorBody): VisitorRow = client.post("/api/front-office/visitors", body)
    suspend fun passes(): List<PassRow> = client.get("/api/front-office/passes")
    suspend fun issuePass(body: NewPassBody): PassRow = client.post("/api/front-office/passes", body)
    suspend fun revokePass(id: String, reason: String): PassRow = client.put("/api/front-office/passes/$id/revoke", RevokeBody(reason))
    suspend fun visitorLogs(): List<VisitorLogRow> = client.get("/api/front-office/visitor-logs")
    suspend fun checkIn(passId: String): VisitorLogRow = client.post("/api/front-office/visitor-logs/$passId/check-in")
    suspend fun checkOut(passId: String): VisitorLogRow = client.put("/api/front-office/visitor-logs/$passId/check-out")
    suspend fun enquiries(): List<EnquiryRow> = client.get("/api/front-office/enquiries")
    suspend fun logEnquiry(body: NewEnquiryBody): EnquiryRow = client.post("/api/front-office/enquiries", body)
    suspend fun resolveEnquiry(id: String): EnquiryRow = client.put("/api/front-office/enquiries/$id/resolve")
}

/**
 * Who is in the building, and who should not be any more. Overdue first,
 * because a pass whose hours ran out is the one the desk has to act on.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitorDeskScreen(nav: NavHostController, api: FrontOfficeApi) {
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    val passes = remember { Remote<List<PassRow>>() }
    val visitors = remember { mutableStateListOf<VisitorRow>() }
    val logs = remember { mutableStateListOf<VisitorLogRow>() }
    var busyId by remember { mutableStateOf<String?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    var revoking by remember { mutableStateOf<PassRow?>(null) }

    suspend fun load() {
        runCatching { api.visitors() }.getOrNull()?.let { visitors.clear(); visitors.addAll(it) }
        runCatching { api.visitorLogs() }.getOrNull()?.let { logs.clear(); logs.addAll(it) }
        passes.load { api.passes() }
    }
    LaunchedEffect(Unit) { load() }
    val state by passes.state.collectAsState()
    val now = ServerTime.format(Instant.now())

    fun stateOf(p: PassRow) = passState(p.status, p.valid_until, now)
    fun insideOf(p: PassRow) = passIsInside(stateOf(p), logs.none { it.pass_id == p.id && it.check_out_at == null })
    val rows = state.value.orEmpty()
    val inside = rows.count { insideOf(it) }
    val overdue = rows.count { stateOf(it) == "overdue" && insideOf(it) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-visitor-desk")) {
        CarbonPageHeader("Reception", "Visitor desk", "Passes, and who is still inside.")
        Row(Modifier.padding(horizontal = 16.dp)) {
            CarbonStatTile("Inside", inside, "Visitors in the building", Modifier.weight(1f))
            Spacer(Modifier.width(1.dp))
            CarbonStatTile("Overdue", overdue, "Past their hours, not signed out", Modifier.weight(1f))
        }
        if (identity?.can("front_office.visitors.create") == true) {
            Column(Modifier.padding(16.dp)) {
                CarbonPrimaryButton("Register a visitor", modifier = Modifier.testTag("visitor-register"), onClick = { nav.navigate("register-visitor") })
            }
        }
        failure?.let { CarbonNotification(NotificationKind.Error, "Not recorded", it, Modifier.padding(horizontal = 16.dp)) }
        RemoteContent("passes", state, "Couldn't load the passes", "The hospital server did not answer. Do not read this as an empty building.", { it.isEmpty() }, "No passes today", "Nobody has been issued a visitor pass yet.", { scope.launch { load() } }) { list ->
            Column {
                // Overdue first: they are the ones somebody has to chase.
                list.sortedBy { when (stateOf(it)) { "overdue" -> 0; "active" -> 1; else -> 2 } }.forEach { pass ->
                    val s = stateOf(pass)
                    val isIn = insideOf(pass)
                    val actions = if (identity?.can("front_office.passes.manage") == true) passActions(s, isIn) else emptyList()
                    Column(Modifier.fillMaxWidth()) {
                        CarbonActionRow(
                            visitors.firstOrNull { it.id == pass.registration_id }?.visitor_name ?: "Visitor",
                            listOfNotNull(pass.pass_number, pass.bed_number?.let { "bed $it" }, "until ${ServerTime.short(pass.valid_until)}").joinToString(" · "),
                            onClick = {}, modifier = Modifier.fillMaxWidth().testTag("pass-row-${pass.id}"),
                        ) { CarbonTag(s, when (s) { "overdue" -> CarbonTone.Danger; "active" -> CarbonTone.Success; else -> CarbonTone.Neutral }) }
                        if (s == "overdue" && isIn) {
                            Text("Past their hours and not signed out — still counted as inside.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp).testTag("pass-overdue-${pass.id}"))
                        }
                        if (s == "revoked" && pass.revoked_reason != null) {
                            Text("Revoked: ${pass.revoked_reason}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp).testTag("pass-revoked-${pass.id}"))
                        }
                        if (actions.isNotEmpty()) {
                            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if ("check_in" in actions) CarbonPrimaryButton("Check in", enabled = busyId == null, modifier = Modifier.weight(1f).testTag("pass-check-in-${pass.id}"), onClick = {
                                    scope.launch { busyId = pass.id; failure = null; try { api.checkIn(pass.id); load() } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was recorded." } finally { busyId = null } }
                                })
                                if ("check_out" in actions) CarbonPrimaryButton("Check out", enabled = busyId == null, modifier = Modifier.weight(1f).testTag("pass-check-out-${pass.id}"), onClick = {
                                    scope.launch { busyId = pass.id; failure = null; try { api.checkOut(pass.id); load() } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was recorded." } finally { busyId = null } }
                                })
                                if ("revoke" in actions) CarbonTertiaryButton("Revoke", onClick = { revoking = pass }, modifier = Modifier.weight(1f).testTag("pass-revoke-${pass.id}"))
                            }
                        }
                    }
                }
            }
        }
    }

    revoking?.let { pass ->
        var reason by remember(pass.id) { mutableStateOf("") }
        ModalBottomSheet(onDismissRequest = { revoking = null }, modifier = Modifier.testTag("revoke-sheet")) {
            Column(Modifier.padding(16.dp).imePadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CarbonPageHeader("Revoke", pass.pass_number, "The pass stops working as soon as this is saved.")
                CarbonTextField(reason, { reason = it }, "Why is it being revoked?", Modifier.testTag("revoke-reason"), singleLine = false)
                CarbonDangerButton("Revoke the pass", enabled = reason.isNotBlank(), modifier = Modifier.fillMaxWidth().testTag("revoke-submit"), onClick = {
                    val p = pass
                    revoking = null
                    scope.launch { failure = null; try { api.revokePass(p.id, reason.trim()); load() } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. The pass still stands." } }
                })
                Spacer(Modifier.padding(bottom = 24.dp))
            }
        }
    }
}

/**
 * Registering and issuing are one act: a visitor without a pass is a person
 * standing at the desk with nothing to show the guard.
 */
@Composable
fun RegisterVisitorScreen(nav: NavHostController, api: FrontOfficeApi) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var relationship by remember { mutableStateOf("") }
    var purpose by remember { mutableStateOf("") }
    var bed by remember { mutableStateOf("") }
    var issued by remember { mutableStateOf<PassRow?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-register-visitor")) {
        CarbonPageHeader("Visitor desk", "Register a visitor", "Who they are, who they are here for, and the pass they carry.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val done = issued
            if (done != null) {
                CarbonTonedTile(CarbonTone.Success) {
                    Eyebrow("Pass issued")
                    Text(done.pass_number, style = MaterialTheme.typography.displaySmall, modifier = Modifier.testTag("issued-pass").semantics { liveRegion = LiveRegionMode.Polite })
                    Text("Valid until ${ServerTime.short(done.valid_until)}", style = MaterialTheme.typography.bodyLarge)
                    Text(name, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                CarbonPrimaryButton("Done", modifier = Modifier.testTag("issued-done"), onClick = { nav.popBackStack() })
            } else {
                CarbonTextField(name, { name = it }, "Visitor's name", Modifier.testTag("field-visitor-name"))
                CarbonTextField(phone, { phone = it }, "Phone", Modifier.testTag("field-visitor-phone"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                CarbonTextField(relationship, { relationship = it }, "Relationship to the patient", Modifier.testTag("field-visitor-relationship"))
                CarbonTextField(purpose, { purpose = it }, "Purpose", Modifier.testTag("field-visitor-purpose"))
                CarbonTextField(bed, { bed = it }, "Bed (optional)", Modifier.testTag("field-visitor-bed"))
                failure?.let { CarbonNotification(NotificationKind.Error, "Not registered", it) }
                CarbonPrimaryButton("Register and issue a pass", enabled = !busy && name.isNotBlank(), modifier = Modifier.testTag("visitor-submit"), onClick = {
                    scope.launch {
                        busy = true; failure = null
                        try {
                            val visitor = api.registerVisitor(NewVisitorBody(name.trim(), phone.ifBlank { null }, relationship.ifBlank { null }, purpose.ifBlank { null }, null, "general"))
                            issued = api.issuePass(NewPassBody(visitor.id, bed.ifBlank { null }, 4))
                        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was registered." } finally { busy = false }
                    }
                })
            }
        }
    }
}
