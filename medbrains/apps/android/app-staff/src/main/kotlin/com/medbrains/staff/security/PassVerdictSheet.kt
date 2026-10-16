package com.medbrains.staff.security

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GppBad
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.ServerTime
import com.medbrains.staff.reception.FrontOfficeApi
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

private sealed interface Outcome {
    data object Checking : Outcome
    data class Verdict(val pass: PassVerdict) : Outcome
    data object NoSuchPass : Outcome
    data object Unreachable : Outcome
}

/** The pass's id and whether its holder is inside, once looked up for recording. */
private data class Presence(val passId: String, val inside: Boolean)

/**
 * The scan does not return the pass id, so it is found among active passes.
 * ponytail: two extra reads per scan; drop them once the scan answers with the id and whether the holder is inside.
 */
private suspend fun locate(api: SecurityApi, number: String): Presence? = coroutineScope {
    val passes = async { api.activePasses() }
    val open = async { api.openVisits() }
    val pass = passes.await().firstOrNull { it.pass_number.equals(number, ignoreCase = true) } ?: return@coroutineScope null
    Presence(pass.id, open.await().any { it.pass_id == pass.id })
}

/**
 * The server's answer about one pass, in words a guard reads at arm's
 * length: let in or not, who it was issued to, where it opens. Nothing is
 * cached — a revoked pass must never read as valid from a phone's memory.
 */
@Composable
fun PassVerdictSheet(code: String, api: SecurityApi, desk: FrontOfficeApi, onDone: () -> Unit) {
    val canRecord = LocalIdentity.current?.canAny(SecurityPermission.RECORD_VISITS) == true
    val scope = rememberCoroutineScope()
    var outcome by remember { mutableStateOf<Outcome>(Outcome.Checking) }
    var presence by remember { mutableStateOf<Presence?>(null) }
    var working by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    var recorded by remember { mutableStateOf<String?>(null) }

    suspend fun check() {
        outcome = Outcome.Checking
        try {
            val pass = api.scan(code)
            outcome = Outcome.Verdict(pass)
            if (canRecord) presence = runCatching { locate(api, pass.pass_number) }.getOrNull()
        } catch (e: ApiError) {
            outcome = if (e.status == 404) Outcome.NoSuchPass else Outcome.Unreachable
        } catch (e: Exception) {
            outcome = Outcome.Unreachable
        }
    }
    LaunchedEffect(code) { check() }

    fun record(passId: String, entering: Boolean) {
        working = true; failure = null; recorded = null
        scope.launch {
            try {
                if (entering) desk.checkIn(passId) else desk.checkOut(passId)
                check()
                recorded = if (entering) "Entry recorded" else "Exit recorded"
            } catch (e: Exception) {
                failure = securityWriteFailure(e)
            } finally { working = false }
        }
    }

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp).testTag("security-verdict"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        when (val o = outcome) {
            Outcome.Checking -> Row(Modifier.fillMaxWidth().padding(32.dp), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator() }
            Outcome.NoSuchPass -> VerdictBand("No such pass — do not let in", "Nothing on record carries $code.", CarbonTone.Danger)
            Outcome.Unreachable -> {
                VerdictBand("Couldn't check this pass", "Do not read this as valid — check the paper pass and the ward.", CarbonTone.Warning)
                CarbonTertiaryButton("Try again", onClick = { scope.launch { check() } })
            }
            is Outcome.Verdict -> {
                val pass = o.pass
                VerdictBand(pass.headline, pass.revoked_reason?.let { "Reason: $it" }, if (pass.valid) CarbonTone.Success else CarbonTone.Danger)
                Column {
                    CarbonRow(pass.visitor_name, listOfNotNull(pass.relationship, pass.category).joinToString(" · "))
                    pass.id_type?.let { CarbonRow("ID", "$it ending ${pass.id_number?.takeLast(4) ?: "—"}") }
                    CarbonRow("Ward", listOfNotNull(pass.ward_name, pass.bed_number?.let { "bed $it" }).joinToString(" · ").ifEmpty { "Not named on the pass" })
                    CarbonRow("Valid until", ServerTime.short(pass.valid_until))
                    CarbonRow("Pass", pass.pass_number, mono = true)
                }
                val here = presence
                if (canRecord && here != null) {
                    if (here.inside) {
                        CarbonPrimaryButton(if (working) "Recording…" else "Record exit", { record(here.passId, entering = false) }, Modifier.testTag("security-record-exit"), enabled = !working)
                    } else if (pass.valid) {
                        CarbonPrimaryButton(if (working) "Recording…" else "Record entry", { record(here.passId, entering = true) }, Modifier.testTag("security-record-entry"), enabled = !working)
                    }
                }
            }
        }
        recorded?.let { CarbonNotification(NotificationKind.Success, it, "Read back from the hospital server.", Modifier.testTag("security-recorded")) }
        failure?.let { CarbonNotification(NotificationKind.Error, "Not recorded", it, Modifier.testTag("security-record-error")) }
        CarbonTertiaryButton("Scan next", onClick = onDone, modifier = Modifier.fillMaxWidth().testTag("security-scan-next"))
    }
}

/** The verdict, word and icon both: never colour alone. */
@Composable
private fun VerdictBand(headline: String, detail: String?, tone: CarbonTone) {
    CarbonTonedTile(tone) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(if (tone == CarbonTone.Success) Icons.Filled.VerifiedUser else Icons.Filled.GppBad, contentDescription = null)
            Text(headline, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.testTag("security-verdict-band").semantics { liveRegion = LiveRegionMode.Assertive })
        }
        detail?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
    }
}
