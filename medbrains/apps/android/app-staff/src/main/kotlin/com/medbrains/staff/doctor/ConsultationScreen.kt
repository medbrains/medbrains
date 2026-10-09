package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.RemoteState
import com.medbrains.staff.shared.tokens.WorklistToken
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch

/**
 * The visit's case sheet on the handheld: every note in the order care
 * happened, each with its author and whether it is signed, and the doctor's
 * own consultation note to write and sign. A failed read is never an empty
 * sheet — the doctor would start a second note over the first.
 */
@Composable
fun ConsultationScreen(api: NotesApi, token: WorklistToken) {
    val notes = remember { Remote<List<Note>>() }
    val encounterId = token.encounter_id
    val scope = rememberCoroutineScope()
    LaunchedEffect(encounterId) { if (encounterId != null) notes.load { api.list(encounterId) } }
    val state by notes.state.collectAsState()

    Column(Modifier.fillMaxSize().imePadding().testTag("screen-consultation")) {
        CarbonPageHeader("Case sheet", token.displayName, "UHID ${token.uhid ?: "—"} · Token ${token.number}")
        if (encounterId == null) {
            // A token issued before its encounter existed. Saying so beats a form that cannot save.
            CarbonNotification(NotificationKind.Warning, "No visit to record against", "This token has no OPD visit yet. Start the visit from reception, then the consultation can be written.", Modifier.padding(16.dp))
            return
        }
        val reload: suspend () -> Unit = { notes.load { api.list(encounterId) } }
        when (val s = state) {
            RemoteState.Loading -> Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            is RemoteState.Failed -> CarbonNotification(NotificationKind.Error, "Couldn't load the case sheet", s.message, Modifier.padding(16.dp)) {
                TextButton(onClick = { scope.launch { reload() } }) { Text("Try again") }
            }
            is RemoteState.Loaded -> CaseSheet(api, encounterId, s.value, reload)
        }
    }
}

@Composable
private fun CaseSheet(api: NotesApi, encounterId: String, list: List<Note>, reload: suspend () -> Unit) {
    val identity = LocalIdentity.current
    val canWrite = identity?.can("clinical_notes.write") == true
    val canSign = identity?.can("clinical_notes.sign") == true
    // The doctor's own consultation, newest last in care order; a struck one no longer counts.
    val mine = list.lastOrNull { it.is_mine && it.note_type_code == "consultation" && it.amends_note_id == null && it.status != "entered_in_error" }
    val scope = rememberCoroutineScope()
    var reviseError by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        list.filter { it.id != mine?.id || mine.status != "draft" }.forEach { NoteBlock(it) }
        if (list.isEmpty()) Text("No notes on this visit yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        reviseError?.let { CarbonNotification(NotificationKind.Error, "The note was not reopened", it) }
        when {
            mine?.status == "signed" -> if (mine.revisable && canSign) {
                CarbonTertiaryButton("Revise", onClick = {
                    scope.launch {
                        reviseError = null
                        try { api.revise(mine.id); reload() } catch (e: Exception) { reviseError = (e as? ApiError)?.message ?: "Could not reach the hospital server." }
                    }
                }, modifier = Modifier.testTag("consultation-revise"))
            }
            canWrite -> key(mine?.id ?: "new") { ConsultationNoteForm(api, encounterId, mine, canSign, reload) }
            else -> Text("You can read this case sheet but not write on it.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
