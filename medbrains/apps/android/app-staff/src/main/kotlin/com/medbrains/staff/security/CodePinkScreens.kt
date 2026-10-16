package com.medbrains.staff.security

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.RemoteState
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.BarcodeScanner
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * S6 entry, above every desk: a red banner while any tag alert is open,
 * polled every 15 s for as long as the home is on screen. A role that may
 * not read tag alerts never asks; one that may only match bands still gets
 * the way in.
 */
@Composable
fun CodePinkEntry(nav: NavHostController, api: SecurityApi) {
    val me = LocalIdentity.current
    val canList = me?.can(SecurityPermission.LIST_TAG_ALERTS) == true
    val canMatch = me?.can(SecurityPermission.VERIFY_BAND_MATCH) == true
    val alerts = remember { Remote<List<TagAlertRow>>() }
    LaunchedEffect(canList) { if (canList) alerts.poll(SecurityRefresh.ALARM_MS) { api.openTagAlerts() } }
    val state by alerts.state.collectAsState()
    val open = state.value.orEmpty()
    val pad = Modifier.padding(horizontal = 16.dp)
    when {
        canList && open.isNotEmpty() -> CarbonNotification(
            NotificationKind.Error, "Code Pink — ${open.size} tag alert${if (open.size == 1) "" else "s"} open", "Tap to see where, and to resolve.",
            pad.clickable(role = Role.Button) { nav.navigate("tag-alerts") }.testTag("security-code-pink-banner"),
        )
        canList && state is RemoteState.Failed -> CarbonNotification(
            NotificationKind.Warning, "Tag alerts unavailable", "Do not read this as no Code Pink. Check with the control room.", pad,
        )
        canList || canMatch -> CarbonActionRow(
            if (canList) "Tag alerts and band match" else "Mother and baby band match",
            if (canList) "No tag alert open" else null,
            onClick = { nav.navigate(if (canList) "tag-alerts" else "band-match") },
            modifier = Modifier.testTag("security-code-pink-link"),
        )
    }
}

/** The open tag alerts: what fired, where, when; resolved with a reason. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagAlertsScreen(nav: NavHostController, api: SecurityApi) {
    val me = LocalIdentity.current
    val canList = me?.can(SecurityPermission.LIST_TAG_ALERTS) == true
    val canResolve = me?.can(SecurityPermission.RESOLVE_TAG_ALERT) == true
    val alerts = remember { Remote<List<TagAlertRow>>() }
    val scope = rememberCoroutineScope()
    var resolving by remember { mutableStateOf<TagAlertRow?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(canList) { if (canList) alerts.poll(SecurityRefresh.ALARM_MS) { api.openTagAlerts() } }
    val state by alerts.state.collectAsState()
    val stale by alerts.staleSince.collectAsState()

    Column(Modifier.fillMaxSize().testTag("screen-security-tag-alerts")) {
        CarbonPageHeader("Code Pink", "Tag alerts", "An infant or patient tag left its zone or was tampered with.")
        if (me?.can(SecurityPermission.VERIFY_BAND_MATCH) == true) {
            CarbonPrimaryButton("Check a mother and baby band match", { nav.navigate("band-match") }, Modifier.padding(16.dp).testTag("security-band-match"))
        }
        failure?.let { CarbonNotification(NotificationKind.Error, "Not resolved", it, Modifier.padding(horizontal = 16.dp)) }
        StaleBanner(stale, "tag alerts")
        if (canList) {
            RemoteContent(
                id = "security-tag-alerts", state = state,
                unavailableTitle = "Couldn't load tag alerts", unavailableMessage = "Do not read this as no Code Pink. Check with the control room.",
                isEmpty = { it.isEmpty() }, emptyTitle = "No tag alert open",
                emptyMessage = "Exits and tampering from infant and patient tags appear here.",
                retry = { scope.launch { alerts.load { api.openTagAlerts() } } },
            ) { rows ->
                LazyColumn(Modifier.fillMaxSize().testTag("security-tag-alert-rows")) {
                    items(rows, key = { it.id }) { row ->
                        Column(Modifier.testTag("security-tag-alert-${row.id}")) {
                            CarbonActionRow(row.alertLabel, "${row.location_description ?: "Location not reported"} · ${ServerTime.short(row.triggered_at)}", onClick = {}) {
                                CarbonTag("Open", CarbonTone.Danger)
                            }
                            if (canResolve) {
                                CarbonTertiaryButton("Resolve", { resolving = row }, Modifier.padding(horizontal = 16.dp, vertical = 8.dp).testTag("security-tag-alert-resolve-${row.id}"))
                            }
                        }
                    }
                }
            }
        }
    }

    resolving?.let { row ->
        var notes by remember(row.id) { mutableStateOf("") }
        var falseAlarm by remember(row.id) { mutableStateOf(false) }
        ModalBottomSheet(onDismissRequest = { resolving = null }) {
            // Resolving says why: the next shift reads the reason, not a cleared flag.
            Column(Modifier.padding(16.dp).imePadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CarbonPageHeader("Resolve", row.alertLabel, row.location_description)
                CarbonTextField(notes, { notes = it }, "What was found", Modifier.testTag("field-tag-alert-notes"), singleLine = false)
                Row(Modifier.fillMaxWidth().clickable(role = Role.Checkbox) { falseAlarm = !falseAlarm }, verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = falseAlarm, onCheckedChange = null, modifier = Modifier.testTag("tag-alert-false-alarm"))
                    Text("It was a false alarm")
                }
                CarbonDangerButton("Resolve the alert", {
                    val text = notes.trim()
                    resolving = null
                    scope.launch {
                        failure = null
                        try { api.resolveTagAlert(row.id, text, falseAlarm); alerts.load { api.openTagAlerts() } } catch (e: Exception) { failure = securityWriteFailure(e) }
                    }
                }, Modifier.fillMaxWidth().testTag("security-tag-alert-resolve-submit"), enabled = notes.isNotBlank())
            }
        }
    }
}

/** Baby's band, then mother's band; the server compares and answers. */
@Composable
fun BandMatchScreen(api: SecurityApi) {
    val scope = rememberCoroutineScope()
    var infant by remember { mutableStateOf<String?>(null) }
    var resumeKey by remember { mutableStateOf(0) }
    var result by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var working by remember { mutableStateOf(false) }

    fun check(baby: String, mother: String) {
        working = true
        scope.launch {
            result = try {
                api.verifyBandMatch(baby, mother)
                true to "The baby may go with this mother."
            } catch (e: ApiError) {
                false to (if (e.status == 403) "You no longer have access to this — ask your administrator." else e.message ?: "Do not hand over.")
            } catch (e: Exception) {
                false to "Couldn't check the bands. Do not hand the baby over until it is checked."
            } finally { working = false }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-security-band-match")) {
        CarbonPageHeader("Code Pink", "Band match", "Never hand a baby over unless the two bands match.")
        val done = result
        val baby = infant
        when {
            done != null -> Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                CarbonTonedTile(if (done.first) CarbonTone.Success else CarbonTone.Danger, Modifier.testTag("security-band-result")) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(if (done.first) Icons.Filled.VerifiedUser else Icons.Filled.GppBad, contentDescription = null)
                        Text(if (done.first) "Bands match" else "Do not hand over", style = MaterialTheme.typography.headlineSmall)
                    }
                    Text(done.second, style = MaterialTheme.typography.bodyLarge)
                }
                CarbonTertiaryButton("Check another pair", { infant = null; result = null; resumeKey += 1 })
            }
            working -> Row(Modifier.fillMaxWidth().padding(32.dp), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator() }
            baby != null -> {
                CarbonRow("Baby's band", baby, mono = true)
                BarcodeScanner("Now the mother's band", "Scan or type the mother's band.", resumeKey, { check(baby, it) })
            }
            else -> BarcodeScanner("Scan the baby's band", "Scan or type the tag on the baby's band.", resumeKey, { infant = it; resumeKey += 1 })
        }
    }
}
