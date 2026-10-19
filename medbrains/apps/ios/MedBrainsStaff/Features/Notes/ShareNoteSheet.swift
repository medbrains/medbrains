import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Choose the department boards and colleagues a note is shared with. The
/// note stays the author's: they can edit it or take it back at any time.
struct ShareNoteSheet: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    let note: StickyNotes.Note
    let saved: @MainActor () async -> Void

    /// Wait this long after the last keystroke before searching.
    private static let searchDelay: Duration = .milliseconds(250)

    @State private var departments: Set<String> = []
    @State private var users: Set<String> = []
    @State private var query = ""
    @State private var found = Remote<StickyNotes.Recipients>()
    @State private var problem: String?
    @State private var busy = false

    /// Already-chosen recipients keep their names while the search moves on.
    private var chosen: [StickyNotes.Recipient] {
        note.shares.map { StickyNotes.Recipient(id: $0.departmentId ?? $0.userId ?? $0.id, name: $0.label) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("People you share it with can read it.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                if case .failed(let message) = found.state {
                    Section { CarbonNotification(kind: .error, title: "Could not load departments and colleagues", message: message) }
                }
                Section("Department boards") {
                    ForEach(options(found.value?.departments)) { row($0, in: $departments, id: "share-dept") }
                }
                Section("Colleagues") {
                    ForEach(options(found.value?.users)) { row($0, in: $users, id: "share-user") }
                }
                if let problem {
                    Section { CarbonNotification(kind: .error, title: "Could not share the note", message: problem) }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search departments or names")
            .navigationTitle("Share note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            // Below the list, not in the bar: an active search hides the bar's buttons.
            .safeAreaInset(edge: .bottom) {
                Button("Save sharing") { Task { await save() } }
                    .buttonStyle(.carbonPrimary)
                    .disabled(busy)
                    .padding(16)
                    .background(MedBrainsTheme.canvas)
                    .accessibilityIdentifier("share-save")
            }
            // Restarts on each keystroke and is cancelled with the sheet: no stray search outlives it.
            .task(id: query) {
                try? await Task.sleep(for: Self.searchDelay)
                guard !Task.isCancelled, let client else { return }
                await found.load { try await StickyNotesApi(client: client).recipients(query) }
            }
        }
        .onAppear {
            let ids = StickyNotes.shareIds(note)
            departments = ids.departments
            users = ids.users
        }
    }

    private func options(_ results: [StickyNotes.Recipient]?) -> [StickyNotes.Recipient] {
        var seen = Set<String>()
        return ((results ?? []) + chosen).filter { seen.insert($0.id).inserted }
    }

    private func row(_ r: StickyNotes.Recipient, in set: Binding<Set<String>>, id: String) -> some View {
        Toggle(r.name, isOn: Binding(get: { set.wrappedValue.contains(r.id) }, set: { on in
            if on { set.wrappedValue.insert(r.id) } else { set.wrappedValue.remove(r.id) }
        }))
        .font(CarbonType.body)
        .frame(minHeight: 44)
        .accessibilityIdentifier("\(id)-\(r.id)")
    }

    private func save() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        do {
            try await StickyNotesApi(client: client).setShares(note.id, departments: departments, users: users)
            await saved()
            dismiss()
        } catch {
            problem = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
