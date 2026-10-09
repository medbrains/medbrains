import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The doctor's own consultation note while it is a draft: the four prose
/// fields and the findings at a site. Save keeps the draft; Sign makes it
/// the record. Buttons are disabled only while a write is in flight, never
/// on validity — pressing runs the check and the field says what is missing.
/// A failed write keeps every word on screen.
struct ConsultationNoteForm: View {
    @Environment(\.apiClient) private var client
    let encounterId: String
    let canSign: Bool
    /// The draft being written; nil until the first save starts the note.
    @State var note: Note?
    let onChange: () async -> Void
    @State private var draft: ConsultationDraft
    @State private var busy = false
    @State private var problem: String?
    @State private var error: String?
    @State private var lateReason: String?
    @State private var savedDraft = false
    @FocusState private var focus: String?

    init(encounterId: String, note: Note?, canSign: Bool, onChange: @escaping () async -> Void) {
        self.encounterId = encounterId
        self.canSign = canSign
        self.onChange = onChange
        _note = State(initialValue: note)
        _draft = State(initialValue: note.map(ConsultationDraft.init) ?? ConsultationDraft())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            CarbonSectionTitle(note == nil ? "New consultation note" : "Your draft").padding(.horizontal, -16)
            CarbonTag(note == nil ? "not saved" : "draft — not signed", tone: .warning)
                .accessibilityIdentifier(note == nil ? "consultation-unsaved" : "consultation-saved")
            field("Chief complaint", $draft.chief, "chief_complaint", error: problem)
            field("Examination", $draft.exam, "examination")
            field("Assessment", $draft.assessment, "assessment")
            field("Plan", $draft.plan, "plan")
            ExamFindingsSection(findings: $draft.findings, canRecord: true)
            if let error { CarbonNotification(kind: .error, title: "The note was not saved", message: error) }
            if savedDraft {
                CarbonNotification(kind: .success, title: "Draft saved", message: "Not part of the record until you sign it.")
                    .accessibilityIdentifier("consultation-draft-saved")
            }
            if lateReason != nil {
                CarbonField("Why it is written now", isFocused: focus == "late") {
                    TextField("This note is signed well after the care", text: Binding($lateReason, replacingNilWith: ""), axis: .vertical)
                        .focused($focus, equals: "late").accessibilityIdentifier("field-late-reason")
                }
            }
            Button("Save draft") { Task { await save(sign: false) } }
                .buttonStyle(.carbonTertiary).disabled(busy)
                .accessibilityIdentifier("consultation-save")
            if canSign {
                Button(lateReason == nil ? "Sign note" : "Sign as late entry") { Task { await save(sign: true) } }
                    .buttonStyle(.carbonPrimary).disabled(busy)
                    .accessibilityLabel("Sign this consultation note").accessibilityIdentifier("consultation-sign")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("consultation-form")
    }

    private func field(_ label: String, _ text: Binding<String>, _ key: String, error: String? = nil) -> some View {
        CarbonField(label, error: error, isFocused: focus == key) {
            TextField(label, text: text, axis: .vertical)
                .lineLimit(3...8)
                .textInputAutocapitalization(.sentences)
                .focused($focus, equals: key)
                .accessibilityIdentifier("field-\(key)")
        }
    }

    private func save(sign: Bool) async {
        guard let client else { return }
        problem = consultationProblem(chiefComplaint: draft.chief, examination: draft.exam, assessment: draft.assessment, plan: draft.plan)
        guard problem == nil else { return }
        busy = true
        error = nil
        savedDraft = false
        focus = nil
        defer { busy = false }
        let api = NotesApi(client: client)
        let patches = draft.patches(examData: note?.sections.first { $0.code == "examination" }?.data)
        do {
            let saved = if let note {
                try await api.saveDraft(note.id, patches)
            } else {
                try await api.startConsultation(encounterId, patches)
            }
            note = saved
            guard sign else {
                savedDraft = true
                return
            }
            let reason = lateReason?.trimmingCharacters(in: .whitespacesAndNewlines)
            _ = try await api.sign(saved.id, lateReason: reason?.isEmpty == false ? reason : nil)
            // Signed, it joins the sheet as the record.
            await onChange()
        } catch let failure as ApiError where failure.message.localizedCaseInsensitiveContains("late entry") {
            // Care written up long after it happened must say why before it is signed.
            lateReason = lateReason ?? ""
            error = failure.message
        } catch {
            self.error = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}

private extension Binding where Value == String {
    init(_ source: Binding<String?>, replacingNilWith fallback: String) {
        self.init(get: { source.wrappedValue ?? fallback }, set: { source.wrappedValue = $0 })
    }
}
