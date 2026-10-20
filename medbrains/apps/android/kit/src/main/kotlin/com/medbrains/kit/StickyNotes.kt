package com.medbrains.kit

import kotlinx.serialization.Serializable
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * Sticky notes: a person's own notes, shared to department boards or
 * colleagues, and notes pinned from notifications. Wire shapes mirror
 * `packages/types/src/notes.ts`; the rules mirror the web's
 * `components/notes/notes-logic.ts` and `NoteEditorModal.tsx`, and iOS.
 */
object StickyNotes {
    object Permission {
        const val USE = "notes.use"
    }

    /** Longest note body, matching the server and the column's CHECK. */
    const val MAX_CHARS = 1000
    val COLOURS = listOf("yellow", "blue", "green", "pink", "gray")
    const val DEFAULT_COLOUR = "yellow"
    /** How long "in 8 hours" is. */
    const val SHORT_CLEAR_HOURS = 8L

    @Serializable
    data class Share(val id: String, val department_id: String? = null, val user_id: String? = null, val label: String)

    @Serializable
    data class Note(
        val id: String,
        val body: String,
        val colour: String,
        val pinned: Boolean = false,
        /** When the note clears itself; null keeps it until removed. */
        val expires_at: String? = null,
        val author_id: String,
        val author_name: String,
        val created_at: String,
        val updated_at: String,
        /** The share that put it in front of the reader; removing it takes the note off. */
        val share_id: String? = null,
        /** Every share — on the reader's own notes only. */
        val shares: List<Share> = emptyList(),
        /** Made by the system from a notification: read-only, never shared, dismissible. */
        val is_system: Boolean = false,
        /** Where the item behind the note lives in the app. */
        val source_url: String? = null,
        /** Clears itself when the item behind it is resolved. */
        val auto_resolve: Boolean = false,
        /** Whether the item behind it is one the server can tell is resolved. */
        val can_auto_resolve: Boolean = false,
        /** When the item was resolved and the note cleared itself. */
        val resolved_at: String? = null,
    ) {
        /** A note can reach me twice (a board and a share): the share keys the row. */
        val listKey: String get() = share_id ?: id
    }

    @Serializable
    data class Board(val department_id: String, val department_name: String, val notes: List<Note> = emptyList())

    @Serializable
    data class Listing(
        val mine: List<Note> = emptyList(),
        val shared_with_me: List<Note> = emptyList(),
        val boards: List<Board> = emptyList(),
        val can_moderate: Boolean = false,
    )

    /** What a save sends. */
    @Serializable
    data class Draft(val body: String, val colour: String, val pinned: Boolean, val expires_at: String?)

    @Serializable
    data class Recipient(val id: String, val name: String)

    @Serializable
    data class Recipients(val departments: List<Recipient> = emptyList(), val users: List<Recipient> = emptyList())

    enum class Filter(val label: String) { Active("Active"), Resolved("Resolved") }

    /** When a note clears itself. */
    enum class Clear(val label: String) {
        Never("Keep until I remove it"),
        Shortly("In $SHORT_CLEAR_HOURS hours"),
        EndOfToday("At the end of today"),
        OnDate("On a date I pick"),
    }

    data class Actions(val canEdit: Boolean, val canShare: Boolean, val canToggleAutoResolve: Boolean)

    /** My notes under one filter: notes that cleared themselves only under "resolved". */
    fun filter(notes: List<Note>, filter: Filter): List<Note> = notes.filter { (it.resolved_at != null) == (filter == Filter.Resolved) }

    /** What the author may do with one of their notes. A note from a notification is the system's text: dismiss it, never edit or share it. */
    fun actions(note: Note) = Actions(canEdit = !note.is_system, canShare = !note.is_system, canToggleAutoResolve = note.can_auto_resolve && note.resolved_at == null)

    fun removeLabel(note: Note): String = if (note.is_system) "Dismiss note" else "Delete note"

    /** A note on a board comes off by its share: a moderator may take any off, everyone else only their own. */
    fun canTakeOff(note: Note, canModerate: Boolean, me: String?): Boolean = note.share_id != null && (canModerate || note.author_id == me)

    /** The first thing wrong with a note, or null when it can be saved. */
    fun problem(body: String, clear: Clear, at: Instant?, now: Instant = Instant.now()): String? {
        val text = body.trim()
        return when {
            text.isEmpty() -> "Write something first"
            text.length > MAX_CHARS -> "Keep it under $MAX_CHARS characters"
            clear == Clear.OnDate && (at == null || !at.isAfter(now)) -> "Pick a time in the future"
            else -> null
        }
    }

    /** When the note clears itself, as sent; null keeps it. */
    fun expiresAt(clear: Clear, at: Instant?, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String? = when (clear) {
        Clear.Never -> null
        Clear.Shortly -> ServerTime.format(now.plus(SHORT_CLEAR_HOURS, ChronoUnit.HOURS))
        Clear.EndOfToday -> ServerTime.format(now.atZone(zone).toLocalDate().atTime(LocalTime.of(23, 59)).atZone(zone).toInstant())
        Clear.OnDate -> at?.let(ServerTime::format)
    }

    fun draft(body: String, colour: String, pinned: Boolean, clear: Clear, at: Instant?, now: Instant = Instant.now()) =
        Draft(body.trim(), colour, pinned, expiresAt(clear, at, now))

    /** The tone a note is drawn in: decoration only, the text carries the meaning. */
    fun tone(colour: String): Tone = when (colour) {
        "blue" -> Tone.Info
        "green" -> Tone.Success
        "pink" -> Tone.Danger
        "yellow" -> Tone.Warning
        else -> Tone.Neutral
    }

    /** The department and colleague ids a note is shared with now. */
    fun shareIds(note: Note): Pair<Set<String>, Set<String>> =
        note.shares.mapNotNull { it.department_id }.toSet() to note.shares.mapNotNull { it.user_id }.toSet()
}

/** The sticky-notes calls, one per route the screens use. */
class StickyNotesApi(private val client: ApiClient) {
    @Serializable private data class SharesBody(val department_ids: List<String>, val user_ids: List<String>)
    @Serializable private data class AutoResolveBody(val auto_resolve: Boolean)

    suspend fun list(): StickyNotes.Listing = client.get("/api/notes")
    suspend fun create(draft: StickyNotes.Draft) { client.call("POST", "/api/notes", client.json.encodeToString(StickyNotes.Draft.serializer(), draft)) }
    suspend fun update(id: String, draft: StickyNotes.Draft) { client.call("PUT", "/api/notes/$id", client.json.encodeToString(StickyNotes.Draft.serializer(), draft)) }
    suspend fun remove(id: String) { client.call("DELETE", "/api/notes/$id") }
    suspend fun setShares(id: String, departments: Set<String>, users: Set<String>) {
        client.call("PUT", "/api/notes/$id/shares", client.json.encodeToString(SharesBody.serializer(), SharesBody(departments.sorted(), users.sorted())))
    }
    /** Takes a note off a board or out of "shared with me". */
    suspend fun removeShare(shareId: String) { client.call("DELETE", "/api/notes/shares/$shareId") }
    suspend fun setAutoResolve(id: String, on: Boolean) {
        client.call("PUT", "/api/notes/$id/auto-resolve", client.json.encodeToString(AutoResolveBody.serializer(), AutoResolveBody(on)))
    }
    suspend fun recipients(query: String): StickyNotes.Recipients = client.get("/api/notes/recipients?q=${URLEncoder.encode(query, "UTF-8")}")
}
