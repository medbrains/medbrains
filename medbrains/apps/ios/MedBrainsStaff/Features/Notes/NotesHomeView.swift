import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Sticky notes: mine (written by me or pinned from my notifications, active
/// or resolved), notes colleagues shared with me, and my departments'
/// boards. One fetch answers all three; an outage reads as an outage.
struct NotesHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<StickyNotes.Listing>()
    @State private var action = QueueActionState()
    @State private var scope = Scope.mine
    @State private var filter = StickyNotes.Filter.active
    @State private var editing: Editing?
    @State private var sharing: StickyNotes.Note?

    enum Scope: String, CaseIterable { case mine, shared, boards }

    /// What the editor sheet is open on: a new note, or one of mine.
    struct Editing: Identifiable {
        let note: StickyNotes.Note?
        var id: String { note?.id ?? "new" }
    }

    private var api: StickyNotesApi? { client.map(StickyNotesApi.init) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Module")
                    Text("Team notes, department boards, pinned notifications.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                Picker("Show", selection: $scope) {
                    Text("Mine (\(remote.value.map { StickyNotes.filter($0.mine, .active).count } ?? 0))").tag(Scope.mine)
                    Text("Shared (\(remote.value?.sharedWithMe.count ?? 0))").tag(Scope.shared)
                    Text("Boards (\(remote.value?.boards.count ?? 0))").tag(Scope.boards)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .accessibilityIdentifier("notes-scope")
                if let failure = action.failure {
                    CarbonNotification(kind: .error, title: "That didn't go through", message: failure).padding(16)
                }
                RemoteContentView(
                    id: "notes", state: remote.state,
                    unavailableTitle: "Could not load notes",
                    unavailableMessage: "Your notes are safe — they just could not be fetched.",
                    isEmpty: { _ in false }, emptyTitle: "", emptyMessage: "",
                    retry: { Task { await load() } }
                ) { listing in
                    switch scope {
                    case .mine: mine(listing.mine)
                    case .shared: shared(listing.sharedWithMe)
                    case .boards: boards(listing)
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("module-home-notes")
        .refreshable { await load() }
        .task { await load() }
        .sheet(item: $editing) { NoteEditorSheet(note: $0.note) { await load() } }
        .sheet(item: $sharing) { ShareNoteSheet(note: $0) { await load() } }
    }

    private func mine(_ notes: [StickyNotes.Note]) -> some View {
        let shown = StickyNotes.filter(notes, filter)
        return LazyVStack(alignment: .leading, spacing: 12) {
            Button { editing = Editing(note: nil) } label: { Label("New note", systemImage: "plus") }
                .buttonStyle(.carbonPrimary)
                .accessibilityIdentifier("notes-new")
            Picker("Show active or resolved notes", selection: $filter) {
                ForEach(StickyNotes.Filter.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("notes-filter")
            if shown.isEmpty {
                empty(filter == .active ? "No notes yet. Write one, or pin a notification from the web's bell." : "Nothing has resolved itself this week.", id: "notes-mine-empty")
            }
            ForEach(shown) { note in
                NoteCard(note: note, showAuthor: false) { myActions(note) }
            }
        }
        .padding(16)
    }

    @ViewBuilder
    private func myActions(_ note: StickyNotes.Note) -> some View {
        let can = StickyNotes.actions(note)
        if can.canToggleAutoResolve {
            Toggle("Auto-resolve", isOn: Binding(get: { note.autoResolve }, set: { on in
                Task { await act("Auto-resolve changed") { try await $0.setAutoResolve(note.id, on) } }
            }))
            .font(CarbonType.bodyCompact)
            .fixedSize()
            .accessibilityIdentifier("note-auto-resolve-\(note.id)")
        }
        Spacer(minLength: 0)
        if can.canEdit {
            NoteIconButton(label: "Edit note", symbol: "pencil", id: "note-edit-\(note.id)") { editing = Editing(note: note) }
        }
        if can.canShare {
            NoteIconButton(label: "Share note", symbol: "square.and.arrow.up", id: "note-share-\(note.id)") { sharing = note }
        }
        NoteIconButton(label: StickyNotes.removeLabel(note), symbol: "trash", role: .destructive, id: "note-remove-\(note.id)") {
            Task { await act(note.isSystem ? "Note dismissed" : "Note deleted") { try await $0.remove(note.id) } }
        }
    }

    private func shared(_ notes: [StickyNotes.Note]) -> some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            if notes.isEmpty { empty("Nobody has shared a note with you.", id: "notes-shared-empty") }
            ForEach(notes, id: \.listKey) { note in
                NoteCard(note: note) { takeOff(note, label: "Dismiss note") }
            }
        }
        .padding(16)
    }

    private func boards(_ listing: StickyNotes.Listing) -> some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            if listing.boards.isEmpty { empty("You are not on any department's board.", id: "notes-boards-empty") }
            ForEach(listing.boards) { board in
                CarbonSectionTitle(board.departmentName).padding(.horizontal, -16)
                if board.notes.isEmpty { empty("Nothing on the \(board.departmentName) board.", id: "notes-board-empty-\(board.id)") }
                ForEach(board.notes, id: \.listKey) { note in
                    NoteCard(note: note) {
                        if StickyNotes.canTakeOff(note, canModerate: listing.canModerate, me: auth.identity?.userId) {
                            takeOff(note, label: "Take off the \(board.departmentName) board")
                        }
                    }
                }
            }
        }
        .padding(16)
    }

    @ViewBuilder
    private func takeOff(_ note: StickyNotes.Note, label: String) -> some View {
        if let shareId = note.shareId {
            Spacer(minLength: 0)
            NoteIconButton(label: label, symbol: "xmark", id: "note-takeoff-\(note.id)") {
                Task { await act("Taken off") { try await $0.removeShare(shareId) } }
            }
        }
    }

    private func empty(_ text: String, id: String) -> some View {
        Text(text).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 16)
            .accessibilityIdentifier(id)
    }

    /// Reads gate the fetch: without `notes.use` nothing is asked.
    private func load() async {
        guard let api, auth.identity?.can(StickyNotes.Permission.use) ?? false else { return }
        await remote.load { try await api.list() }
    }

    private func act(_ done: String, _ op: @escaping (StickyNotesApi) async throws -> Void) async {
        guard let api else { return }
        await action.run(unreachable: "Could not reach the hospital server.") {
            try await op(api)
            return done
        }
        await load()
    }
}

private extension StickyNotes.Note {
    /// A note can reach me twice (a board and a share): the share keys the row.
    var listKey: String { shareId ?? id }
}
