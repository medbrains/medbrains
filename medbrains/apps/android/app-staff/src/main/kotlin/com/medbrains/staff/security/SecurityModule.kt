package com.medbrains.staff.security

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.medbrains.kit.ApiClient
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.staff.reception.FrontOfficeApi
import com.medbrains.ui.BarcodeScanner
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import uniffi.edge_rn.passState
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

enum class SecurityDesk(val label: String) { GATE("Gate scan"), INSIDE("Inside now"), INCIDENTS("Incidents") }

/**
 * What outlives a push and a pop: the desk the guard was on, and the
 * incidents the list already fetched so the detail opens by id. Bounded by
 * one page of the register.
 */
class SecuritySession {
    var desk by mutableStateOf<SecurityDesk?>(null)
    val incidents = mutableStateMapOf<String, SecurityIncidentRow>()
}

/**
 * The gate guard's phone: check a pass, see who is inside, report what
 * happened on the round, answer a Code Pink. Each desk is present only when
 * the role may read it, so a desk it cannot read never fetches.
 */
@Composable
fun SecurityModule() {
    val nav = rememberNavController()
    val session = remember { SecuritySession() }
    val client = LocalApiClient.current
    val api = SecurityApi(client)
    NavHost(nav, startDestination = "home") {
        composable("home") { SecurityHome(nav, api, client, session) }
        composable("report") { ReportIncidentScreen(nav, api) }
        composable("incident/{id}") { IncidentDetailScreen(api, session.incidents.getValue(it.arguments!!.getString("id")!!)) }
        composable("tag-alerts") { TagAlertsScreen(nav, api) }
        composable("band-match") { BandMatchScreen(api) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SecurityHome(nav: NavHostController, api: SecurityApi, client: ApiClient, session: SecuritySession) {
    val me = LocalIdentity.current
    val desks = SecurityDesk.entries.filter {
        when (it) {
            SecurityDesk.GATE -> me?.can(SecurityPermission.VERIFY_PASS) == true
            SecurityDesk.INSIDE -> me?.let { m -> m.can(SecurityPermission.LIST_VISITORS) && m.can(SecurityPermission.LIST_PASSES) } == true
            SecurityDesk.INCIDENTS -> me?.can(SecurityPermission.LIST_INCIDENTS) == true
        }
    }
    val shown = session.desk?.takeIf { it in desks } ?: desks.firstOrNull()
    Column(Modifier.fillMaxSize().testTag("screen-security")) {
        CarbonPageHeader("Security", "Gate and rounds", "The server checks every pass. Never let anyone in on a guess.")
        CodePinkEntry(nav, api)
        if (desks.size > 1) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("security-desk")) {
                desks.forEachIndexed { i, desk ->
                    SegmentedButton(
                        selected = desk == shown,
                        onClick = { session.desk = desk },
                        shape = SegmentedButtonDefaults.itemShape(i, desks.size),
                        modifier = Modifier.testTag("security-desk-${desk.name.lowercase()}"),
                    ) { Text(desk.label) }
                }
            }
        }
        when (shown) {
            SecurityDesk.GATE -> GateScanDesk(api, client)
            SecurityDesk.INSIDE -> InsideNowDesk(api, client)
            SecurityDesk.INCIDENTS -> IncidentsDesk(nav, api, session)
            null -> Unit
        }
    }
}

/** S1: camera on the pass, the verdict in a sheet, then the next visitor. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GateScanDesk(api: SecurityApi, client: ApiClient) {
    var resumeKey by remember { mutableStateOf(0) }
    var scanned by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        BarcodeScanner("Scan the visitor's pass", "Hold the QR on the pass to the camera. Or type the pass number.", resumeKey, { scanned = it })
    }
    scanned?.let { code ->
        val close = { scanned = null; resumeKey += 1 }
        ModalBottomSheet(onDismissRequest = close) { PassVerdictSheet(code, api, FrontOfficeApi(client), close) }
    }
}

/** One visitor inside: the open log joined to its pass and the visitor's name. */
data class InsideRow(val passId: String, val passNumber: String?, val name: String, val detail: String, val isOverdue: Boolean)

/** Three lists joined by id in memory: one round trip each, never one per row. */
private suspend fun fetchInside(api: SecurityApi, desk: FrontOfficeApi): List<InsideRow> = coroutineScope {
    val logs = async { api.openVisits() }
    val passes = async { api.activePasses() }
    val visitors = async { desk.visitors() }
    val byPass = passes.await().associateBy { it.id }
    val names = visitors.await().associate { it.id to it.visitor_name }
    val now = ServerTime.format(Instant.now())
    logs.await().map { log ->
        val pass = byPass[log.pass_id]
        if (pass == null) {
            InsideRow(log.pass_id, null, "A pass no longer active", "In since ${ServerTime.short(log.check_in_at)}", true)
        } else {
            val bed = pass.bed_number?.let { " · bed $it" }.orEmpty()
            InsideRow(pass.id, pass.pass_number, names[pass.registration_id] ?: "Visitor", "${pass.pass_number}$bed · in since ${ServerTime.short(log.check_in_at)}", passState(pass.status, pass.valid_until, now) == "overdue")
        }
    }.sortedByDescending { it.isOverdue }
}

/** S2: everyone checked in on a pass and not yet out, overdue first. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InsideNowDesk(api: SecurityApi, client: ApiClient) {
    val desk = remember(client) { FrontOfficeApi(client) }
    val remote = remember { Remote<List<InsideRow>>() }
    val scope = rememberCoroutineScope()
    var opened by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { remote.poll(SecurityRefresh.QUEUE_MS) { fetchInside(api, desk) } }
    val state by remote.state.collectAsState()
    val stale by remote.staleSince.collectAsState()
    Column(Modifier.fillMaxSize()) {
        StaleBanner(stale, "who is inside")
        RemoteContent(
            id = "security-inside", state = state,
            unavailableTitle = "Couldn't load who is inside", unavailableMessage = "This is not an empty building. Try again in a moment.",
            isEmpty = { it.isEmpty() }, emptyTitle = "Nobody is checked in on a pass",
            emptyMessage = "Visitors appear here when the gate records their entry.",
            retry = { scope.launch { remote.load { fetchInside(api, desk) } } },
        ) { rows ->
            LazyColumn(Modifier.fillMaxSize().testTag("security-inside-rows")) {
                items(rows, key = { it.passId }) { row ->
                    CarbonActionRow(row.name, row.detail, onClick = { opened = row.passNumber }, modifier = Modifier.testTag("security-inside-${row.passId}")) {
                        if (row.isOverdue) CarbonTag("Overdue", CarbonTone.Warning)
                    }
                }
            }
        }
    }
    opened?.let { code ->
        val close = { opened = null; scope.launch { remote.load { fetchInside(api, desk) } }; Unit }
        ModalBottomSheet(onDismissRequest = close) { PassVerdictSheet(code, api, desk, close) }
    }
}

/** A refresh failed: the list still shows, and says how old it is. */
@Composable
fun StaleBanner(since: Instant?, what: String) {
    since?.let {
        CarbonNotification(
            NotificationKind.Warning, "Couldn't refresh",
            "Showing $what as of ${DateTimeFormatter.ofPattern("HH:mm").format(it.atZone(ZoneId.systemDefault()))}.",
            Modifier.padding(horizontal = 16.dp).testTag("security-stale"),
        )
    }
}
