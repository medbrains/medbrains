package com.medbrains.staff.notes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.medbrains.kit.ApiError
import com.medbrains.kit.Remote
import com.medbrains.kit.RemoteState
import com.medbrains.kit.ServerTime
import com.medbrains.kit.StickyNotes
import com.medbrains.kit.StickyNotesApi
import com.medbrains.kit.value
import com.medbrains.staff.shared.forms.FutureDateTimeField
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

/** Wait this long after the last keystroke before searching recipients. */
private const val SEARCH_DELAY_MS = 250L

/** Runs a save; its failure stays on the sheet in words, and leaving the sheet is not a failure. */
private suspend fun attempt(setProblem: (String?) -> Unit, op: suspend () -> Unit): Boolean = try {
    op(); true
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    setProblem((e as? ApiError)?.message ?: "Could not reach the hospital server."); false
}

/** Write or edit a note: text, colour, pin, and when it clears itself. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteEditorSheet(api: StickyNotesApi, note: StickyNotes.Note?, onClose: () -> Unit, onSaved: () -> Unit) {
    var text by remember { mutableStateOf(note?.body.orEmpty()) }
    var colour by remember { mutableStateOf(note?.colour ?: StickyNotes.DEFAULT_COLOUR) }
    var pinned by remember { mutableStateOf(note?.pinned ?: false) }
    val existing = ServerTime.parse(note?.expires_at)
    var clear by remember { mutableStateOf(if (existing != null) StickyNotes.Clear.OnDate else StickyNotes.Clear.Never) }
    var clearAt by remember { mutableStateOf(existing ?: Instant.now().plus(1, ChronoUnit.HOURS)) }
    var problem by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    ModalBottomSheet(onDismissRequest = onClose) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp).imePadding().navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(if (note == null) "New note" else "Edit note", style = MaterialTheme.typography.titleLarge)
            CarbonTextField(text, { text = it.take(StickyNotes.MAX_CHARS) }, "Note", Modifier.testTag("note-body"), error = problem, singleLine = false)
            Text("For the team's logistics. Patient details belong in the patient's chart. ${text.length}/${StickyNotes.MAX_CHARS}",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Colour", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("note-colour")) {
                StickyNotes.COLOURS.forEachIndexed { i, c ->
                    SegmentedButton(selected = colour == c, onClick = { colour = c }, shape = SegmentedButtonDefaults.itemShape(i, StickyNotes.COLOURS.size)) {
                        Text(c.replaceFirstChar { it.uppercase() }, maxLines = 1)
                    }
                }
            }
            Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(pinned, role = Role.Switch, onValueChange = { pinned = it }).testTag("note-pinned"), verticalAlignment = Alignment.CenterVertically) {
                Text("Pin to the top", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Switch(checked = pinned, onCheckedChange = null)
            }
            CarbonPicker("Clears itself", StickyNotes.Clear.entries.map { PickerOption(it.name, it.label) }, clear.name, { id -> id?.let { clear = StickyNotes.Clear.valueOf(it) } }, allowNone = false, tag = "note-clear")
            if (clear == StickyNotes.Clear.OnDate) FutureDateTimeField("Clear on", clearAt, { clearAt = it }, "note-clear-at")
            CarbonPrimaryButton("Save note", enabled = !busy, modifier = Modifier.testTag("note-save"), onClick = {
                problem = StickyNotes.problem(text, clear, clearAt)
                if (problem != null) return@CarbonPrimaryButton
                val draft = StickyNotes.draft(text, colour, pinned, clear, clearAt)
                scope.launch {
                    busy = true
                    val ok = attempt({ problem = it }) { if (note == null) api.create(draft) else api.update(note.id, draft) }
                    busy = false
                    if (ok) { onSaved(); onClose() }
                }
            })
            TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text("Cancel") }
        }
    }
}

/** Choose the department boards and colleagues a note is shared with. The note stays the author's. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareNoteSheet(api: StickyNotesApi, note: StickyNotes.Note, onClose: () -> Unit, onSaved: () -> Unit) {
    val (initialDepartments, initialUsers) = remember(note.id) { StickyNotes.shareIds(note) }
    var departments by remember { mutableStateOf(initialDepartments) }
    var users by remember { mutableStateOf(initialUsers) }
    var query by remember { mutableStateOf("") }
    val found = remember { Remote<StickyNotes.Recipients>() }
    var problem by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    // Restarts on each keystroke and is cancelled with the sheet: no stray search outlives it.
    LaunchedEffect(query) {
        delay(SEARCH_DELAY_MS)
        found.load { api.recipients(query) }
    }
    val state by found.state.collectAsState()
    // Already-chosen recipients keep their names while the search moves on.
    val chosen = remember(note.id) { note.shares.map { StickyNotes.Recipient(it.department_id ?: it.user_id ?: it.id, it.label) } }
    fun options(results: List<StickyNotes.Recipient>?) = ((results.orEmpty()) + chosen).distinctBy { it.id }

    ModalBottomSheet(onDismissRequest = onClose) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp).imePadding().navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Share note", style = MaterialTheme.typography.titleLarge)
            Text("People you share it with can read it. You can take it back at any time.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            CarbonTextField(query, { query = it }, "Search departments or names", Modifier.testTag("share-search"))
            (state as? RemoteState.Failed)?.let { CarbonNotification(NotificationKind.Error, "Could not load departments and colleagues", it.message) }
            CarbonSectionTitle("Department boards")
            options(state.value?.departments).forEach { r -> Choice(r, r.id in departments, "share-dept-${r.id}") { departments = if (it) departments + r.id else departments - r.id } }
            CarbonSectionTitle("Colleagues")
            options(state.value?.users).forEach { r -> Choice(r, r.id in users, "share-user-${r.id}") { users = if (it) users + r.id else users - r.id } }
            problem?.let { CarbonNotification(NotificationKind.Error, "Could not share the note", it) }
            CarbonPrimaryButton("Save sharing", enabled = !busy, modifier = Modifier.testTag("share-save"), onClick = {
                scope.launch {
                    busy = true
                    val ok = attempt({ problem = it }) { api.setShares(note.id, departments, users) }
                    busy = false
                    if (ok) { onSaved(); onClose() }
                }
            })
            TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text("Cancel") }
        }
    }
}

@Composable
private fun Choice(r: StickyNotes.Recipient, on: Boolean, tag: String, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(on, role = Role.Checkbox, onValueChange = onChange).testTag(tag), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = on, onCheckedChange = null)
        Text(r.name, style = MaterialTheme.typography.bodyLarge)
    }
}
