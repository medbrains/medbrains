import Foundation
import MedBrainsKit

// Wire shapes mirror medbrains-clinical-notes `model.rs` (the case sheet,
// RFCs/RFC-MODULE-clinical-notes.md). A visit's notes are the record; the
// old consultation row is only a projection of the signed ones.

/// One part of a note: free text (the web editor's HTML), or a structured
/// record such as the examination.
struct NoteSection: Codable, Sendable, Equatable {
    let code: String
    let title: String
    let text: String
    let data: JSONValue?
}

/// A note on the case sheet: who wrote it, when, and whether it is signed.
struct Note: Decodable, Identifiable, Sendable {
    let id: String
    let noteTypeCode: String
    let noteTypeName: String
    let authorName: String
    let authorRole: String
    let departmentName: String?
    /// `draft`, `signed` or `entered_in_error`.
    let status: String
    let serviceAt: String
    let signedAt: String?
    let currentVersion: Int
    let amendsNoteId: String?
    let enteredInErrorReason: String?
    let sections: [NoteSection]
    let isMine: Bool
    /// The caller may still revise it: theirs, signed, inside the grace.
    let revisable: Bool
    let cosignerName: String?
    /// Its content is withheld from this user (consultation access restricted).
    let withheld: Bool?
    let cosignStatus: String?
}

/// What a draft save sends for one section; nil leaves that part as it is.
struct SectionPatch: Encodable {
    let code: String
    let text: String?
    let data: JSONValue?
}

private struct NewNote: Encodable {
    let noteTypeCode: String
    let sections: [SectionPatch]
}

private struct DraftBody: Encodable {
    let sections: [SectionPatch]
}

private struct SignBody: Encodable {
    let lateEntryReason: String?
}

/// The case-sheet calls, one per route the screen uses.
struct NotesApi: Sendable {
    let client: ApiClient

    func list(_ encounterId: String) async throws -> [Note] {
        try await client.request(.get, "/api/encounters/\(encounterId)/clinical-notes")
    }
    func startConsultation(_ encounterId: String, _ sections: [SectionPatch]) async throws -> Note {
        try await client.request(.post, "/api/encounters/\(encounterId)/clinical-notes",
                                 body: NewNote(noteTypeCode: "consultation", sections: sections))
    }
    func saveDraft(_ noteId: String, _ sections: [SectionPatch]) async throws -> Note {
        try await client.request(.put, "/api/clinical-notes/\(noteId)/draft", body: DraftBody(sections: sections))
    }
    /// A note signed well after the care it records needs `lateReason`.
    func sign(_ noteId: String, lateReason: String? = nil) async throws -> Note {
        try await client.request(.post, "/api/clinical-notes/\(noteId)/sign", body: SignBody(lateEntryReason: lateReason))
    }
    func revise(_ noteId: String) async throws -> Note {
        try await client.request(.post, "/api/clinical-notes/\(noteId)/revise", body: Empty())
    }
}
