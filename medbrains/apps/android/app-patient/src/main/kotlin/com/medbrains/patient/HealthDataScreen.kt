package com.medbrains.patient

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.PermissionController
import com.medbrains.kit.HealthDataKind
import com.medbrains.kit.HealthDataSharing
import com.medbrains.kit.HealthShare
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

private data class ShareOutcome(val kind: NotificationKind, val title: String, val message: String)

/**
 * Share readings from Health Connect with the hospital. Each kind is off
 * until the patient turns it on (and grants Health Connect's read permission
 * for it); turning one off stops sharing it, while what was shared stays in
 * the record. The care team sees these as patient-reported -- never charted
 * or scored as the ward's own observations.
 */
@Composable
fun HealthDataScreen(portal: PortalApi) {
    val context = LocalContext.current
    val reader = remember { HealthConnectReader(context) }
    val remote = remember { Remote<HealthDataSharing>() }
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<ShareOutcome?>(null) }
    var pending by remember { mutableStateOf<HealthDataKind?>(null) }
    LaunchedEffect(Unit) { remote.load { portal.healthData() } }
    val state by remote.state.collectAsState()

    fun setChoice(kind: HealthDataKind, on: Boolean) = scope.launch {
        busy = true
        outcome = runCatching { val next = portal.setHealthConsent(kind, on); remote.load { next } }
            .fold({ null }, { ShareOutcome(NotificationKind.Error, "Not changed", "Your choice for ${kind.label.lowercase()} wasn't saved. Try again.") })
        busy = false
    }

    val askPermission = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
        val kind = pending ?: return@rememberLauncherForActivityResult
        pending = null
        if (HealthConnectReader.permission(kind) in granted) {
            setChoice(kind, true)
        } else {
            outcome = ShareOutcome(NotificationKind.Info, "Not turned on", "Health Connect didn't allow reading ${kind.label.lowercase()}.")
        }
    }

    fun share(sharing: HealthDataSharing) = scope.launch {
        busy = true
        var accepted = 0
        var refused = 0
        outcome = runCatching {
            for (kind in HealthDataKind.entries.filter { sharing.isShared(it) }) {
                val readings = reader.readings(kind)
                for (batch in HealthShare.batches(readings)) {
                    val result = portal.shareHealthReadings(batch)
                    accepted += result.accepted
                    refused += result.refused.size
                }
                readings.maxOfOrNull { it.epochSeconds }?.let { reader.markShared(kind, it) }
            }
        }.fold(
            {
                val more = if (refused > 0) "; $refused could not be taken" else ""
                ShareOutcome(NotificationKind.Success, "Shared", if (accepted == 0) "Nothing new to share." else "$accepted new reading${if (accepted == 1) "" else "s"} shared$more.")
            },
            { ShareOutcome(NotificationKind.Error, "Not shared", "The readings couldn't be sent. Nothing was lost; try again.") },
        )
        busy = false
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-health-data")) {
        CarbonPageHeader("Health", "Share health data", "Readings from Health Connect your care team can see, marked as reported by you.")
        if (!reader.isAvailable) {
            CarbonNotification(NotificationKind.Info, "Health Connect isn't available", "Install or update Health Connect to share readings.", Modifier.padding(16.dp))
        }
        outcome?.let { CarbonNotification(it.kind, it.title, it.message, Modifier.padding(horizontal = 16.dp).testTag("health-share-outcome")) }
        RemoteContent("health-data", state, "Couldn't load your sharing choices", "Try again in a moment.", { false }, "", "", { scope.launch { remote.load { portal.healthData() } } }) { sharing ->
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonSectionTitle("What you share")
                HealthDataKind.entries.forEach { kind ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(kind.label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Switch(
                            checked = sharing.isShared(kind),
                            enabled = !busy && reader.isAvailable,
                            onCheckedChange = { on ->
                                if (on) {
                                    pending = kind
                                    askPermission.launch(setOf(HealthConnectReader.permission(kind)))
                                } else {
                                    setChoice(kind, false)
                                }
                            },
                            modifier = Modifier.testTag("share-${kind.wire}"),
                        )
                    }
                }
                Text(
                    "Read only: MedBrains never writes to Health Connect. Turning a kind off stops sharing it; readings already shared stay in your record.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                CarbonPrimaryButton(
                    if (busy) "Sharing…" else "Share now",
                    { share(sharing) },
                    enabled = !busy && HealthDataKind.entries.any { sharing.isShared(it) },
                    modifier = Modifier.fillMaxWidth().testTag("share-now"),
                )
            }
        }
    }
}
