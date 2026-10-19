package com.medbrains.staff.notes

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.StickyNotes
import com.medbrains.kit.StickyNotesApi
import com.medbrains.kit.value
import com.medbrains.staff.shared.tokens.QueueActionState
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import com.medbrains.ui.carbon
import kotlinx.coroutines.launch

private enum class Scope(val label: String) { Mine("Mine"), Shared("Shared"), Boards("Boards") }

/** What a sheet is open on: a new note, editing one of mine, or sharing one. */
private sealed interface Sheet {
    data class Edit(val note: StickyNotes.Note?) : Sheet
    data class Share(val note: StickyNotes.Note) : Sheet
}

/**
 * Sticky notes: mine (written by me or pinned from my notifications, active or
 * resolved), notes colleagues shared with me, and my departments' boards. One
 * fetch answers all three; an outage reads as an outage.
 */
@Composable
fun NotesModule() {
    val identity = LocalIdentity.current
    val api = StickyNotesApi(LocalApiClient.current)
    val remote = remember { Remote<StickyNotes.Listing>() }
    val action = remember { QueueActionState() }
    var scope by remember { mutableStateOf(Scope.Mine) }
    var filter by remember { mutableStateOf(StickyNotes.Filter.Active) }
    var sheet by remember { mutableStateOf<Sheet?>(null) }
    val coroutines = rememberCoroutineScope()
    // Reads gate the fetch: without `notes.use` nothing is asked.
    suspend fun load() { if (identity?.can(StickyNotes.Permission.USE) == true) remote.load { api.list() } }
    fun act(done: String, op: suspend (StickyNotesApi) -> Unit) {
        coroutines.launch {
            action.run("Could not reach the hospital server.") { op(api); done }
            load()
        }
    }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()
    val listing = state.value

    Column(Modifier.fillMaxSize().testTag("module-home-notes")) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            Eyebrow("Module")
            Text("Team notes, department boards, pinned notifications.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val counts = mapOf(
            Scope.Mine to (listing?.let { StickyNotes.filter(it.mine, StickyNotes.Filter.Active).size } ?: 0),
            Scope.Shared to (listing?.shared_with_me?.size ?: 0),
            Scope.Boards to (listing?.boards?.size ?: 0),
        )
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("notes-scope")) {
            Scope.entries.forEachIndexed { i, s ->
                SegmentedButton(selected = scope == s, onClick = { scope = s }, shape = SegmentedButtonDefaults.itemShape(i, Scope.entries.size), modifier = Modifier.testTag("notes-scope-${s.name.lowercase()}")) {
                    Text("${s.label} (${counts[s]})")
                }
            }
        }
        action.failure?.let { CarbonNotification(NotificationKind.Error, "That didn't go through", it, Modifier.padding(16.dp)) }
        RemoteContent(
            id = "notes", state = state,
            unavailableTitle = "Could not load notes", unavailableMessage = "Your notes are safe — they just could not be fetched.",
            isEmpty = { false }, emptyTitle = "", emptyMessage = "", retry = { coroutines.launch { load() } },
        ) { all ->
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (scope) {
                    Scope.Mine -> mine(all.mine, filter, { filter = it }, { sheet = it }, ::act)
                    Scope.Shared -> {
                        if (all.shared_with_me.isEmpty()) item { Empty("Nobody has shared a note with you.", "notes-shared-empty") }
                        items(all.shared_with_me, key = { it.listKey }) { note -> NoteCard(note) { TakeOff(note, "Dismiss note", ::act) } }
                    }
                    Scope.Boards -> {
                        if (all.boards.isEmpty()) item { Empty("You are not on any department's board.", "notes-boards-empty") }
                        all.boards.forEach { board ->
                            item(key = "board-${board.department_id}") { CarbonSectionTitle(board.department_name) }
                            if (board.notes.isEmpty()) item { Empty("Nothing on the ${board.department_name} board.", "notes-board-empty-${board.department_id}") }
                            items(board.notes, key = { "${board.department_id}/${it.listKey}" }) { note ->
                                NoteCard(note) {
                                    if (StickyNotes.canTakeOff(note, all.can_moderate, identity?.userId)) TakeOff(note, "Take off the ${board.department_name} board", ::act)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    when (val open = sheet) {
        is Sheet.Edit -> NoteEditorSheet(api, open.note, onClose = { sheet = null }, onSaved = { coroutines.launch { load() } })
        is Sheet.Share -> ShareNoteSheet(api, open.note, onClose = { sheet = null }, onSaved = { coroutines.launch { load() } })
        null -> Unit
    }
}

private fun LazyListScope.mine(
    notes: List<StickyNotes.Note>,
    filter: StickyNotes.Filter,
    setFilter: (StickyNotes.Filter) -> Unit,
    open: (Sheet) -> Unit,
    act: (String, suspend (StickyNotesApi) -> Unit) -> Unit,
) {
    val shown = StickyNotes.filter(notes, filter)
    item { CarbonPrimaryButton("New note", onClick = { open(Sheet.Edit(null)) }, modifier = Modifier.testTag("notes-new")) }
    item {
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("notes-filter")) {
            StickyNotes.Filter.entries.forEachIndexed { i, f ->
                SegmentedButton(selected = filter == f, onClick = { setFilter(f) }, shape = SegmentedButtonDefaults.itemShape(i, StickyNotes.Filter.entries.size)) { Text(f.label) }
            }
        }
    }
    if (shown.isEmpty()) item {
        Empty(if (filter == StickyNotes.Filter.Active) "No notes yet. Write one, or pin a notification from the web's bell." else "Nothing has resolved itself this week.", "notes-mine-empty")
    }
    items(shown, key = { it.id }) { note ->
        val can = StickyNotes.actions(note)
        NoteCard(note, showAuthor = false) {
            if (can.canToggleAutoResolve) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Auto-resolve", style = MaterialTheme.typography.bodyMedium)
                    Switch(checked = note.auto_resolve, onCheckedChange = { on -> act("Auto-resolve changed") { it.setAutoResolve(note.id, on) } },
                        modifier = Modifier.testTag("note-auto-resolve-${note.id}"))
                }
            }
            Spacer(Modifier.weight(1f))
            if (can.canEdit) NoteIcon(Icons.Filled.Edit, "Edit note", "note-edit-${note.id}") { open(Sheet.Edit(note)) }
            if (can.canShare) NoteIcon(Icons.Filled.Share, "Share note", "note-share-${note.id}") { open(Sheet.Share(note)) }
            NoteIcon(Icons.Filled.Delete, StickyNotes.removeLabel(note), "note-remove-${note.id}") {
                act(if (note.is_system) "Note dismissed" else "Note deleted") { it.remove(note.id) }
            }
        }
    }
}

@Composable
private fun Empty(text: String, tag: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 16.dp).testTag(tag))
}

/** An icon button on a note: 48dp, with its words for TalkBack. */
@Composable
private fun NoteIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tag: String, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(48.dp).testTag(tag)) { Icon(icon, contentDescription = label) }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.TakeOff(note: StickyNotes.Note, label: String, act: (String, suspend (StickyNotesApi) -> Unit) -> Unit) {
    val shareId = note.share_id ?: return
    Spacer(Modifier.weight(1f))
    NoteIcon(Icons.Filled.Close, label, "note-takeoff-${note.id}") { act("Taken off") { it.removeShare(shareId) } }
}

/**
 * One note in its colour, with where it is shared, when it clears, and — for a
 * note pinned from a notification — that it is the system's read-only text, a
 * link to its source and whether it resolved itself.
 */
@Composable
private fun NoteCard(note: StickyNotes.Note, showAuthor: Boolean = true, actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    val context = LocalContext.current
    val base = LocalApiClient.current.baseUrl
    val secondary = MaterialTheme.colorScheme.onSurfaceVariant
    CarbonTonedTile(StickyNotes.tone(note.colour).carbon, Modifier.fillMaxWidth().testTag("note-${note.id}")) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(note.body, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                if (note.pinned) Icon(Icons.Filled.PushPin, contentDescription = "Pinned", tint = secondary)
            }
            if (note.is_system) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    CarbonTag("From notification", CarbonTone.Info)
                    Text("Read-only", style = MaterialTheme.typography.bodySmall, color = secondary)
                }
                when {
                    note.resolved_at != null -> CarbonTag("Resolved automatically ${ServerTime.short(note.resolved_at)}", CarbonTone.Success, modifier = Modifier.testTag("note-resolved-${note.id}"))
                    note.auto_resolve -> Text("Clears itself when resolved", style = MaterialTheme.typography.bodySmall, color = secondary)
                }
                // The item behind it lives on the web app, on the same server.
                note.source_url?.let { path ->
                    TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(base.trimEnd('/') + path))) }, modifier = Modifier.testTag("note-source-${note.id}")) {
                        Text("Open the item")
                    }
                }
            }
            if (note.shares.isNotEmpty()) Text("Shared with ${note.shares.joinToString(", ") { it.label }}", style = MaterialTheme.typography.bodySmall, color = secondary)
            val footer = listOfNotNull(note.author_name.takeIf { showAuthor }, ServerTime.short(note.updated_at), note.expires_at?.let { "clears ${ServerTime.short(it)}" })
            Text(footer.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = secondary)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, content = actions)
        }
    }
}
