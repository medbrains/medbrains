package com.medbrains.staff.abdm

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.medbrains.kit.AbdmProfileShare
import com.medbrains.kit.AbhaVerificationStep
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ScanShare
import com.medbrains.kit.ScanShareApi
import com.medbrains.kit.TenantIdentity
import com.medbrains.staff.reception.MatchQuery
import com.medbrains.staff.reception.ReceptionApi
import com.medbrains.staff.reception.ReceptionSession
import com.medbrains.staff.reception.RegisterPatientScreen
import com.medbrains.staff.reception.load
import com.medbrains.staff.reception.receptionRoutes
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import java.time.LocalDate

/** A share the registration screen starts from: the verification the server recorded from it. */
data class ShareStart(val shareId: String, val step: AbhaVerificationStep)

/**
 * The Scan & Share desk for the module's life: the queue, the counter the
 * desk is watching, the shares and verifications routes name by id, and
 * what the last action said. Kept here, not per screen, so going into a
 * record and coming Back finds the queue as it was.
 */
class ScanShareDesk(private val scanApi: ScanShareApi, private val receptionApi: ReceptionApi, private val session: ReceptionSession, private val go: (String) -> Unit) {
    val queue = Remote<List<AbdmProfileShare>>()
    var counter by mutableStateOf<String?>(null)
    var busy by mutableStateOf(false)
    var notice by mutableStateOf<String?>(null)
    var failure by mutableStateOf<String?>(null)
    val shares = mutableStateMapOf<String, AbdmProfileShare>()
    val steps = mutableStateMapOf<String, AbhaVerificationStep>()
    val uhids = mutableStateMapOf<String, String?>()

    suspend fun reload() = queue.load { scanApi.queue() }

    /** Re-asks every [ScanShare.REFRESH_MS] for as long as the calling coroutine lives. */
    suspend fun poll() = queue.poll(ScanShare.REFRESH_MS) { scanApi.queue() }

    /** Runs one desk action, naming what went wrong instead of failing quietly. */
    private suspend fun act(op: suspend () -> Unit) {
        busy = true; notice = null; failure = null
        try { op() } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server." } finally { busy = false }
    }

    suspend fun open(share: AbdmProfileShare) {
        val patientId = share.patient_id ?: return
        act {
            scanApi.complete(share.id, patientId)
            val p = receptionApi.patient(patientId, share.patient_uhid)
            session.patients[p.id] = p
            go("patient/${p.id}")
        }
        reload()
    }

    /** The share as a verified ABHA, then wherever it leads: its own patient's comparison, or a registration filled from it. */
    suspend fun use(share: AbdmProfileShare, intent: ScanShare.Intent, picked: String? = null, pickedUhid: String? = null) = act {
        val step = scanApi.verification(share.id)
        shares[share.id] = share; steps[share.id] = step
        when (val next = ScanShare.next(intent, share.patient_id, step.already_linked, picked)) {
            is ScanShare.Next.Compare -> {
                notice = next.notice
                // The UHID the desk's lookup finds the record by, from whichever source named it.
                uhids[next.patientId] = when (next.patientId) {
                    share.patient_id -> share.patient_uhid
                    step.already_linked?.patient_id -> step.already_linked?.uhid
                    else -> pickedUhid
                }
                go("share-compare/${share.id}/${next.patientId}")
            }
            ScanShare.Next.Register -> go("share-register/${share.id}")
            null -> Unit
        }
    }

    /** Register checks first — a returning patient registered again gets a second UHID; a check that could not run opens the search too. */
    suspend fun registerOrWarn(share: AbdmProfileShare, canMatch: Boolean) {
        if (canMatch) {
            val q = ScanShare.matchQuery(share.profile)
            val found = runCatching { receptionApi.matchPatients(MatchQuery(q.firstName, q.lastName, q.dateOfBirth, q.phone)) }.getOrNull()
            if (found == null || ScanShare.likelyDuplicates(share.profile, found.map { it.asMatch() }).isNotEmpty()) {
                find(share, registering = true)
                return
            }
        }
        use(share, ScanShare.Intent.REGISTER)
    }

    fun find(share: AbdmProfileShare, registering: Boolean) {
        shares[share.id] = share
        go("share-find/${share.id}/$registering")
    }

    suspend fun dismiss(share: AbdmProfileShare) {
        act { scanApi.dismiss(share.id) }
        reload()
    }
}

@Composable
fun ScanShareModule() {
    val nav = rememberNavController()
    val client = LocalApiClient.current
    val identity = LocalIdentity.current
    val api = remember { ReceptionApi(client) }
    val session = remember { ReceptionSession() }
    val desk = remember { ScanShareDesk(ScanShareApi(client), api, session) { route -> nav.navigate(route) } }
    LaunchedEffect(Unit) { if (identity.canRegisterWithAbha) session.load(api) { identity?.can(it) == true } }
    NavHost(nav, startDestination = "queue") {
        composable("queue") { ScanShareQueueScreen(desk) }
        composable("share-find/{id}/{registering}") {
            val share = desk.shares.getValue(it.arguments!!.getString("id")!!)
            ScanShareFindScreen(desk, api, share, it.arguments!!.getString("registering") == "true")
        }
        composable("share-compare/{id}/{patient}") {
            val id = it.arguments!!.getString("id")!!
            val patientId = it.arguments!!.getString("patient")!!
            ScanShareCompareScreen(desk, api, id, desk.steps.getValue(id), patientId, desk.uhids[patientId]) { p ->
                session.patients[p.id] = p
                desk.notice = "The ABHA is linked to ${p.uhid}."
                nav.navigate("patient/${p.id}") { popUpTo("queue") }
            }
        }
        composable("share-register/{id}") {
            val id = it.arguments!!.getString("id")!!
            RegisterPatientScreen(nav, api, session, share = ShareStart(id, desk.steps.getValue(id)))
        }
        receptionRoutes(nav, client, api, session)
    }
}

/**
 * Scan & Share: patients who scanned a counter's QR with their ABHA app
 * today, with the token they were given. Polls while on screen and the app
 * is in front (the lifecycle stops it otherwise). Mirrors the web's
 * `front-office/scan-share-tab.tsx`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScanShareQueueScreen(desk: ScanShareDesk) {
    val scope = rememberCoroutineScope()
    val identity = LocalIdentity.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { desk.poll() } }
    val state by desk.queue.state.collectAsState()
    val stale by desk.queue.staleSince.collectAsState()
    var refreshing by remember { mutableStateOf(false) }
    val counters = state.let { (it as? com.medbrains.kit.RemoteState.Loaded)?.value.orEmpty() }
        .mapNotNull { s -> s.station_id?.let { PickerOption(it, s.counter_name ?: "Counter") } }.distinctBy { it.id }.sortedBy { it.label }
    fun filtered(rows: List<AbdmProfileShare>) = desk.counter?.let { c -> rows.filter { it.station_id == c } } ?: rows

    Column(Modifier.fillMaxSize().testTag("module-home-scan-share")) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow("ABDM Scan & Share")
            Text("Shared at the counters today. Refreshes every ${ScanShare.REFRESH_MS / 1000} seconds while open.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            desk.notice?.let { CarbonNotification(NotificationKind.Info, "Note", it, Modifier.testTag("scan-share-notice")) }
            desk.failure?.let { CarbonNotification(NotificationKind.Error, "Not done", it, Modifier.testTag("scan-share-failure")) }
            stale?.let { CarbonNotification(NotificationKind.Warning, "Not refreshed", "Showing the queue as of ${com.medbrains.kit.ServerTime.short(com.medbrains.kit.ServerTime.format(it))}; the last refresh failed.") }
            if (counters.size > 1) CarbonPicker("Counter", counters, desk.counter, { desk.counter = it }, placeholder = "All counters", tag = "scan-share-counter")
        }
        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { refreshing = true; scope.launch { desk.reload(); refreshing = false } }, modifier = Modifier.weight(1f)) {
            RemoteContent("scan-share", state, "Couldn't load Scan & Share", "This does not mean nobody has shared — the queue failed to load.", { filtered(it).isEmpty() }, "Nobody has shared their ABHA at the counters today", "A patient who scans a counter's QR appears here with their token.", { scope.launch { desk.reload() } }) { rows ->
                LazyColumn(Modifier.fillMaxSize().testTag("scan-share-rows"), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    items(filtered(rows), key = { it.id }) { share -> ShareRow(share, desk, identity) }
                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
    }
}

/** One share: the token the patient holds, who they are, their ABHA, whether a record here carries it — and what the desk may do. */
@Composable
private fun ShareRow(share: AbdmProfileShare, desk: ScanShareDesk, identity: TenantIdentity?) {
    val scope = rememberCoroutineScope()
    val (label, tone) = ScanShare.status(share.status)
    CarbonTile(Modifier.padding(horizontal = 16.dp).testTag("share-row-${share.id}")) {
        Row(Modifier.fillMaxWidth()) {
            Text(share.token_number ?: "—", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f).semantics { contentDescription = "Token ${share.token_number ?: "none"}" })
            CarbonTag(label, toneOf(tone))
        }
        Text(ScanShare.name(share.profile), style = MaterialTheme.typography.titleMedium)
        Text(ScanShare.ageAndGender(share.profile, LocalDate.now()), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(listOfNotNull(share.abha_address, share.abha_number).joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 4.dp)) {
            if (share.patient_id != null) CarbonTag(share.patient_uhid ?: "Matched", CarbonTone.Success, mono = true) else CarbonTag("New")
            share.counter_name?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        if (ScanShare.isActionable(share.status) && identity != null) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val hasNumber = share.abha_number != null
            fun tag(id: String) = Modifier.fillMaxWidth().testTag("share-$id-${share.id}")
            if (share.patient_id != null) {
                if (identity.can(AbdmPermission.FIND_PATIENT)) CarbonPrimaryButton("Open patient", enabled = !desk.busy, modifier = tag("open"), onClick = { scope.launch { desk.open(share) } })
                if (identity.canCompareShare) CarbonTertiaryButton("Compare and link", enabled = !desk.busy, modifier = tag("compare"), onClick = { scope.launch { desk.use(share, ScanShare.Intent.COMPARE) } })
            } else {
                if (identity.canRegisterWithAbha) CarbonPrimaryButton("Register", enabled = !desk.busy && hasNumber, modifier = tag("register"), onClick = { scope.launch { desk.registerOrWarn(share, identity.canMatchPatients) } })
                if (identity.canCompareShare) CarbonTertiaryButton("Find existing patient", enabled = !desk.busy && hasNumber, modifier = tag("find"), onClick = { desk.find(share, registering = false) })
            }
            CarbonTertiaryButton("Dismiss", enabled = !desk.busy, modifier = tag("dismiss"), onClick = { scope.launch { desk.dismiss(share) } })
        }
    }
}

private fun toneOf(t: ScanShare.Tone): CarbonTone = when (t) {
    ScanShare.Tone.PRIMARY -> CarbonTone.Info
    ScanShare.Tone.SUCCESS -> CarbonTone.Success
    ScanShare.Tone.WARNING -> CarbonTone.Warning
    ScanShare.Tone.NEUTRAL -> CarbonTone.Neutral
}
