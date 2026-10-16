package com.medbrains.patient

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
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
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// The patient's privacy controls (DPDP Act s.6(4), s.11-14): the notice in
// their language and the purposes they agree to — changeable here as easily
// as at the desk — what the hospital holds about them, and their requests.
// The notice text is `packages/privacy/dpdp-notice.json`, the same file the
// web reads; the server checks the version.

@Serializable data class NoticeText(val language: String, val collected: String, val purposesIntro: String, val purposes: Map<String, String>, val rights: String)
@Serializable data class DpdpNotice(val version: String, val purposes: List<String>, val languages: Map<String, NoticeText>) {
    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        @Volatile private var cached: DpdpNotice? = null

        /** Read once; null when the bundled file is missing — a build defect the screen names. */
        fun bundled(context: Context): DpdpNotice? = cached ?: runCatching {
            context.assets.open(NOTICE_FILE).bufferedReader().use { json.decodeFromString(serializer(), it.readText()) }
        }.getOrNull()?.also { cached = it }
    }
}

private const val NOTICE_FILE = "dpdp-notice.json"
private val NOTICE_LANGUAGES = listOf("en", "hi", "ta")
private const val DEFAULT_LANGUAGE = "en"
/** Shorter than this is not yet a request anyone can act on (the server agrees). */
private const val MINIMUM_DETAILS = 5
private const val NOMINEE = "nominee"

/** What a patient can ask for, in their words. */
private val REQUEST_KINDS = listOf(
    "access" to "See what the hospital holds",
    "correction" to "Correct or complete my data",
    "erasure" to "Erase my data",
    NOMINEE to "Name a nominee",
    "grievance" to "Make a privacy complaint",
)
private val REQUEST_LABEL = REQUEST_KINDS.toMap()

private data class PrivacyOutcome(val kind: NotificationKind, val title: String, val message: String)

@Composable
fun PrivacyScreen(portal: PortalApi) {
    val context = LocalContext.current
    val notice = remember { DpdpNotice.bundled(context) }
    val remote = remember { Remote<PortalPrivacy>() }
    val scope = rememberCoroutineScope()
    var language by remember { mutableStateOf<String?>(null) }
    var choices by remember { mutableStateOf<Set<String>?>(null) }
    var saving by remember { mutableStateOf(false) }
    var asking by remember { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<PrivacyOutcome?>(null) }
    LaunchedEffect(Unit) { remote.load { portal.privacy() } }
    val state by remote.state.collectAsState()

    fun reload() = scope.launch { remote.load { portal.privacy() } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-privacy")) {
        CarbonSectionTitle("Your privacy")
        outcome?.let { CarbonNotification(it.kind, it.title, it.message, Modifier.padding(horizontal = 16.dp).testTag("privacy-outcome")) }
        RemoteContent("privacy", state, "Couldn't load your privacy settings", "Try again in a moment.", { false }, "", "", { reload() }) { privacy ->
            val current = privacy.consent.history.firstOrNull()
            val lang = language ?: current?.notice_language ?: DEFAULT_LANGUAGE
            val chosen = choices ?: current?.purposes?.toSet().orEmpty()
            val text = notice?.languages?.get(lang)
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (notice == null || text == null) {
                    CarbonNotification(NotificationKind.Error, "The privacy notice is unavailable", "Ask the hospital's front desk.")
                } else {
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("privacy-language")) {
                        NOTICE_LANGUAGES.forEachIndexed { i, code ->
                            SegmentedButton(
                                selected = lang == code,
                                onClick = { language = code },
                                shape = SegmentedButtonDefaults.itemShape(i, NOTICE_LANGUAGES.size),
                            ) { Text(notice.languages[code]?.language ?: code) }
                        }
                    }
                    Text(text.collected, style = MaterialTheme.typography.bodyMedium)
                    Text(text.purposesIntro, style = MaterialTheme.typography.titleSmall)
                    notice.purposes.forEach { purpose ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(text.purposes[purpose] ?: purpose, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                            Switch(
                                checked = purpose in chosen,
                                onCheckedChange = { on -> choices = if (on) chosen + purpose else chosen - purpose },
                                modifier = Modifier.testTag("purpose-$purpose"),
                            )
                        }
                    }
                    Text(text.rights, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    CarbonPrimaryButton(
                        if (saving) "Saving…" else "Save my choices",
                        {
                            saving = true
                            scope.launch {
                                outcome = runCatching {
                                    portal.setConsent(DpdpConsentChoice(notice.version, lang, chosen.sorted()))
                                }.fold(
                                    onSuccess = { choices = null; PrivacyOutcome(NotificationKind.Success, "Your choices are saved", "You can change them here at any time.") },
                                    onFailure = { PrivacyOutcome(NotificationKind.Error, "Not saved", it.message ?: "Try again in a moment.") },
                                )
                                saving = false
                                remote.load { portal.privacy() }
                            }
                        },
                        Modifier.testTag("privacy-save"),
                        enabled = choices != null && !saving,
                    )
                }
            }
            CarbonSectionTitle("What the hospital holds about you")
            Column(Modifier.testTag("privacy-held")) {
                privacy.held.held.filter { it.count > 0 }.forEach { CarbonRow(it.category, it.count.toString()) }
                CarbonRow("Staff who opened your record this year", privacy.held.staff_who_viewed.toString())
            }
            CarbonSectionTitle("Your requests")
            Column(Modifier.testTag("privacy-requests")) {
                if (privacy.requests.isEmpty()) {
                    Text("You have not made any requests.", Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.bodyMedium)
                }
                privacy.requests.forEach { CarbonRow(REQUEST_LABEL[it.request_type] ?: it.request_type, requestState(it)) }
                if (asking) {
                    NewPrivacyRequest(
                        onCancel = { asking = false },
                        onSend = { kind, details, nominee ->
                            scope.launch {
                                outcome = runCatching { portal.makePrivacyRequest(PrivacyRequestAsk(kind, details, nominee)) }.fold(
                                    onSuccess = { asking = false; PrivacyOutcome(NotificationKind.Success, "Request sent", "The hospital answers within 90 days.") },
                                    onFailure = { PrivacyOutcome(NotificationKind.Error, "Request not sent", it.message ?: "Try again in a moment.") },
                                )
                                remote.load { portal.privacy() }
                            }
                        },
                    )
                } else {
                    CarbonTertiaryButton("Make a request", { asking = true }, Modifier.padding(horizontal = 16.dp).testTag("privacy-make-request"))
                }
            }
        }
    }
}

private fun requestState(request: PrivacyRequestRow): String = when (request.status) {
    "open" -> "Answer due by ${request.due_at.take(10)}"
    "completed" -> "Done: ${request.decision.orEmpty()}"
    else -> "Refused: ${request.decision.orEmpty()}"
}

@Composable
private fun NewPrivacyRequest(onCancel: () -> Unit, onSend: (String, String, String?) -> Unit) {
    var kind by remember { mutableStateOf(REQUEST_KINDS.first().first) }
    var details by remember { mutableStateOf("") }
    var nominee by remember { mutableStateOf("") }
    val ready = details.trim().length >= MINIMUM_DETAILS && (kind != NOMINEE || nominee.isNotBlank())
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("I want to", style = MaterialTheme.typography.labelMedium)
        REQUEST_KINDS.forEach { (id, label) ->
            FilterChip(selected = kind == id, onClick = { kind = id }, label = { Text(label) }, modifier = Modifier.testTag("request-kind-$id"))
        }
        CarbonTextField(details, { details = it }, "Tell us more", Modifier.testTag("request-details"), singleLine = false)
        if (kind == NOMINEE) {
            CarbonTextField(nominee, { nominee = it }, "Nominee's name", Modifier.testTag("request-nominee"))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CarbonTertiaryButton("Cancel", onCancel)
            CarbonPrimaryButton("Send", { onSend(kind, details.trim(), nominee.takeIf { kind == NOMINEE }) }, Modifier.testTag("request-send"), enabled = ready)
        }
    }
}
