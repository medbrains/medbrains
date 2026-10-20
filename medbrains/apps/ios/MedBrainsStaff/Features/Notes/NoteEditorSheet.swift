import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Write or edit a note: text, colour, pin, and when it clears itself.
struct NoteEditorSheet: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    /// The note being edited; nil for a new note.
    let note: StickyNotes.Note?
    let saved: @MainActor () async -> Void

    @State private var text = ""
    @State private var colour = StickyNotes.defaultColour
    @State private var pinned = false
    @State private var clear = StickyNotes.Clear.never
    @State private var clearAt = Date().addingTimeInterval(3_600)
    @State private var problem: String?
    @State private var busy = false
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    CarbonField("Note", helper: "For the team's logistics. Patient details belong in the patient's chart. \(text.count)/\(StickyNotes.maxChars)", error: problem, isFocused: focused) {
                        TextField("", text: $text, axis: .vertical)
                            .lineLimit(3...8)
                            .focused($focused)
                            .accessibilityLabel("Note")
                            .accessibilityIdentifier("note-body")
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Colour").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                        Picker("Colour", selection: $colour) {
                            ForEach(StickyNotes.colours, id: \.self) { Text($0.capitalized).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .accessibilityIdentifier("note-colour")
                    }
                    Toggle("Pin to the top", isOn: $pinned).font(CarbonType.body).frame(minHeight: 44).accessibilityIdentifier("note-pinned")
                    Picker("Clears itself", selection: $clear) {
                        ForEach(StickyNotes.Clear.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("note-clear")
                    if clear == .onDate {
                        DatePicker("Clear on", selection: $clearAt, in: Date()...).font(CarbonType.body)
                    }
                    Button("Save note") { Task { await save() } }
                        .buttonStyle(.carbonPrimary)
                        .disabled(busy)
                        .accessibilityIdentifier("note-save")
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(note == nil ? "New note" : "Edit note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
        .onAppear(perform: fill)
    }

    private func fill() {
        guard let note else { return }
        text = note.body
        colour = note.colour
        pinned = note.pinned
        if let at = ServerTime.parse(note.expiresAt) {
            clear = .onDate
            clearAt = at
        }
    }

    private func save() async {
        guard let client else { return }
        if let p = StickyNotes.problem(body: text, clear: clear, at: clearAt) { problem = p; return }
        busy = true
        defer { busy = false }
        let draft = StickyNotes.draft(body: text, colour: colour, pinned: pinned, clear: clear, at: clearAt)
        let api = StickyNotesApi(client: client)
        do {
            if let note { try await api.update(note.id, draft) } else { try await api.create(draft) }
            await saved()
            dismiss()
        } catch {
            problem = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
