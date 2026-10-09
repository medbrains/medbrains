package com.medbrains.staff.doctor

import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// Wire shapes mirror medbrains-clinical-notes `model.rs` (the case sheet,
// RFCs/RFC-MODULE-clinical-notes.md). A visit's notes are the record; the
// old consultation row is only a projection of the signed ones.

/** One part of a note: free text (the web editor's HTML), or a structured record such as the examination. */
@Serializable
data class NoteSection(val code: String, val title: String, val text: String = "", val data: JsonElement? = null)

/** A note on the case sheet: who wrote it, when, and whether it is signed. */
@Serializable
data class Note(
    val id: String,
    val note_type_code: String,
    val note_type_name: String,
    val author_name: String,
    val author_role: String,
    val department_name: String? = null,
    /** `draft`, `signed` or `entered_in_error`. */
    val status: String,
    val service_at: String,
    val signed_at: String? = null,
    val current_version: Int,
    val amends_note_id: String? = null,
    val entered_in_error_reason: String? = null,
    val sections: List<NoteSection> = emptyList(),
    val is_mine: Boolean,
    /** The caller may still revise it: theirs, signed, inside the grace. */
    val revisable: Boolean,
    val cosigner_name: String? = null,
    val cosign_status: String? = null,
)

/** What a draft save sends for one section; null leaves that part as it is. */
@Serializable
data class SectionPatch(val code: String, val text: String? = null, val data: JsonElement? = null)

@Serializable private data class NewNote(val note_type_code: String, val sections: List<SectionPatch>)
@Serializable private data class DraftBody(val sections: List<SectionPatch>)
@Serializable private data class SignBody(val late_entry_reason: String? = null)

/** The case-sheet calls, one per route the screen uses. */
class NotesApi(private val client: ApiClient) {
    suspend fun list(encounterId: String): List<Note> = client.get("/api/encounters/$encounterId/clinical-notes")
    suspend fun startConsultation(encounterId: String, sections: List<SectionPatch>): Note =
        client.post("/api/encounters/$encounterId/clinical-notes", NewNote("consultation", sections))
    suspend fun saveDraft(noteId: String, sections: List<SectionPatch>): Note =
        client.put("/api/clinical-notes/$noteId/draft", DraftBody(sections))
    /** A note signed well after the care it records needs [lateReason]. */
    suspend fun sign(noteId: String, lateReason: String? = null): Note =
        client.post("/api/clinical-notes/$noteId/sign", SignBody(lateReason))
    suspend fun revise(noteId: String): Note = client.post("/api/clinical-notes/$noteId/revise")
}
