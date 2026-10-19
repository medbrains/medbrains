import Foundation

/// Sticky notes: a person's own notes, shared to department boards or
/// colleagues, and notes pinned from notifications. Wire shapes mirror
/// `packages/types/src/notes.ts`; the rules mirror the web's
/// `components/notes/notes-logic.ts` and `NoteEditorModal.tsx`.
public enum StickyNotes {
    public enum Permission {
        public static let use = "notes.use"
    }

    /// Longest note body, matching the server and the column's CHECK.
    public static let maxChars = 1000
    public static let colours = ["yellow", "blue", "green", "pink", "gray"]
    public static let defaultColour = "yellow"
    /// How long "in 8 hours" is.
    public static let shortClearHours = 8

    public struct Share: Decodable, Identifiable, Equatable, Sendable {
        public let id: String
        public let departmentId: String?
        public let userId: String?
        /// Department or colleague name.
        public let label: String
    }

    public struct Note: Decodable, Identifiable, Equatable, Sendable {
        public let id: String
        public let body: String
        public let colour: String
        public let pinned: Bool
        /// When the note clears itself; nil keeps it until removed.
        public let expiresAt: String?
        public let authorId: String
        public let authorName: String
        public let createdAt: String
        public let updatedAt: String
        /// The share that put it in front of the reader; removing it takes the note off.
        public let shareId: String?
        /// Every share — on the reader's own notes only.
        public let shares: [Share]
        /// Made by the system from a notification: read-only, never shared, dismissible.
        public let isSystem: Bool
        /// Where the item behind the note lives in the app.
        public let sourceUrl: String?
        /// Clears itself when the item behind it is resolved.
        public let autoResolve: Bool
        /// Whether the item behind it is one the server can tell is resolved.
        public let canAutoResolve: Bool
        /// When the item was resolved and the note cleared itself.
        public let resolvedAt: String?
    }

    public struct Board: Decodable, Identifiable, Equatable, Sendable {
        public let departmentId: String
        public let departmentName: String
        public let notes: [Note]
        public var id: String { departmentId }
    }

    public struct Listing: Decodable, Equatable, Sendable {
        public let mine: [Note]
        public let sharedWithMe: [Note]
        public let boards: [Board]
        public let canModerate: Bool
    }

    /// What a save sends.
    public struct Draft: Encodable, Equatable, Sendable {
        public let body: String
        public let colour: String
        public let pinned: Bool
        public let expiresAt: String?
    }

    public struct Recipient: Decodable, Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String

        public init(id: String, name: String) {
            self.id = id
            self.name = name
        }
    }

    public struct Recipients: Decodable, Equatable, Sendable {
        public let departments: [Recipient]
        public let users: [Recipient]
    }

    public enum Filter: String, CaseIterable, Sendable {
        case active, resolved
        public var label: String { self == .active ? "Active" : "Resolved" }
    }

    /// When a note clears itself.
    public enum Clear: String, CaseIterable, Sendable {
        case never, shortly, endOfToday, onDate
        public var label: String {
            switch self {
            case .never: "Keep until I remove it"
            case .shortly: "In \(shortClearHours) hours"
            case .endOfToday: "At the end of today"
            case .onDate: "On a date I pick"
            }
        }
    }

    public struct Actions: Equatable, Sendable {
        public let canEdit: Bool
        public let canShare: Bool
        public let canToggleAutoResolve: Bool
    }

    // MARK: rules

    /// My notes under one filter: notes that cleared themselves only under "resolved".
    public static func filter(_ notes: [Note], _ filter: Filter) -> [Note] {
        notes.filter { ($0.resolvedAt != nil) == (filter == .resolved) }
    }

    /// What the author may do with one of their notes. A note from a
    /// notification is the system's text: dismiss it, never edit or share it.
    public static func actions(_ note: Note) -> Actions {
        Actions(canEdit: !note.isSystem, canShare: !note.isSystem, canToggleAutoResolve: note.canAutoResolve && note.resolvedAt == nil)
    }

    public static func removeLabel(_ note: Note) -> String {
        note.isSystem ? "Dismiss note" : "Delete note"
    }

    /// A note on a board comes off by its share: a moderator may take any
    /// off, everyone else only their own.
    public static func canTakeOff(_ note: Note, canModerate: Bool, me: String?) -> Bool {
        note.shareId != nil && (canModerate || note.authorId == me)
    }

    /// The first thing wrong with a note, or nil when it can be saved.
    public static func problem(body: String, clear: Clear, at: Date?, now: Date = Date()) -> String? {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { return "Write something first" }
        if text.count > maxChars { return "Keep it under \(maxChars) characters" }
        if clear == .onDate, (at ?? .distantPast) <= now { return "Pick a time in the future" }
        return nil
    }

    /// When the note clears itself, as sent; nil keeps it.
    public static func expiresAt(_ clear: Clear, at: Date?, now: Date = Date(), calendar: Calendar = .current) -> String? {
        switch clear {
        case .never: return nil
        case .shortly: return ServerTime.format(now.addingTimeInterval(TimeInterval(shortClearHours) * 3_600))
        case .endOfToday: return calendar.date(bySettingHour: 23, minute: 59, second: 0, of: now).map(ServerTime.format)
        case .onDate: return at.map(ServerTime.format)
        }
    }

    public static func draft(body: String, colour: String, pinned: Bool, clear: Clear, at: Date?, now: Date = Date()) -> Draft {
        Draft(body: body.trimmingCharacters(in: .whitespacesAndNewlines), colour: colour, pinned: pinned, expiresAt: expiresAt(clear, at: at, now: now))
    }

    /// The tone a note is drawn in: decoration only, the text carries the meaning.
    public static func tone(_ colour: String) -> Tone {
        switch colour {
        case "blue": .info
        case "green": .success
        case "pink": .danger
        case "yellow": .warning
        default: .neutral
        }
    }

    /// The department and colleague ids a note is shared with now.
    public static func shareIds(_ note: Note) -> (departments: Set<String>, users: Set<String>) {
        (Set(note.shares.compactMap(\.departmentId)), Set(note.shares.compactMap(\.userId)))
    }
}

/// The sticky-notes calls, one per route the screens use.
public struct StickyNotesApi: Sendable {
    let client: ApiClient

    public init(client: ApiClient) { self.client = client }

    private struct Saved: Decodable { let id: String }
    private struct SharesBody: Encodable { let departmentIds: [String]; let userIds: [String] }
    private struct AutoResolveBody: Encodable { let autoResolve: Bool }

    public func list() async throws -> StickyNotes.Listing {
        try await client.request(.get, "/api/notes")
    }

    @discardableResult
    public func create(_ draft: StickyNotes.Draft) async throws -> String {
        try await client.request(.post, "/api/notes", body: draft, as: Saved.self).id
    }

    @discardableResult
    public func update(_ id: String, _ draft: StickyNotes.Draft) async throws -> String {
        try await client.request(.put, "/api/notes/\(id)", body: draft, as: Saved.self).id
    }

    public func remove(_ id: String) async throws {
        _ = try await client.request(.delete, "/api/notes/\(id)", as: Empty.self)
    }

    public func setShares(_ id: String, departments: Set<String>, users: Set<String>) async throws {
        _ = try await client.request(.put, "/api/notes/\(id)/shares", body: SharesBody(departmentIds: departments.sorted(), userIds: users.sorted()), as: Empty.self)
    }

    /// Takes a note off a board or out of "shared with me".
    public func removeShare(_ shareId: String) async throws {
        _ = try await client.request(.delete, "/api/notes/shares/\(shareId)", as: Empty.self)
    }

    public func setAutoResolve(_ id: String, _ on: Bool) async throws {
        _ = try await client.request(.put, "/api/notes/\(id)/auto-resolve", body: AutoResolveBody(autoResolve: on), as: Empty.self)
    }

    public func recipients(_ query: String) async throws -> StickyNotes.Recipients {
        let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+=?"))) ?? ""
        return try await client.request(.get, "/api/notes/recipients?q=\(q)")
    }
}
