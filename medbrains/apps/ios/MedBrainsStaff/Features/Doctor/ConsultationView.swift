import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The clinical record behind the token: four SOAP fields, nothing else. A
/// handheld between two patients is not where anyone authors a structured
/// history. Every field is prose, so the return key stays a newline. The
/// save button is disabled only while a write is in flight, never on
/// validity: pressing it runs the check and the field says what is missing.
/// A failed read is never an empty form — the doctor would write a second
/// consultation over the first.
struct ConsultationView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let token: WorklistToken
    @State private var existing = Remote<Consultation?>()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CarbonPageHeader(eyebrow: "Consultation", title: token.displayName, subtitle: "UHID \(token.uhid ?? "—") · Token \(token.number)")
            if let encounterId = token.encounterId {
                switch existing.state {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity).padding()
                case .failed(let message):
                    CarbonNotification(kind: .error, title: "Couldn't load the consultation", message: message) {
                        Button("Try again") { Task { await load(encounterId) } }.buttonStyle(.carbonGhost)
                    }
                    .padding(16)
                case .loaded(let record):
                    ConsultationForm(token: token, encounterId: encounterId, existing: record, canRecord: auth.identity?.can("opd.visit.update") ?? false)
                }
            } else {
                // A token issued before its encounter existed. Saying so beats a form that cannot save.
                CarbonNotification(kind: .warning, title: "No visit to record against", message: "This token has no OPD visit yet. Start the visit from reception, then the consultation can be written.")
                    .padding(16)
            }
            Spacer(minLength: 0)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-consultation")
        .task { if let e = token.encounterId { await load(e) } }
    }

    private func load(_ encounterId: String) async {
        guard let client else { return }
        await existing.load { try await DoctorApi(client: client).getConsultation(encounterId) }
    }
}

private struct ConsultationForm: View {
    @Environment(\.apiClient) private var client
    let token: WorklistToken
    let encounterId: String
    let canRecord: Bool
    @State private var saved: Consultation?
    @State private var chief: String
    @State private var exam: String
    @State private var assessment: String
    @State private var plan: String
    @State private var busy = false
    @State private var problem: String?
    @State private var error: String?
    @State private var toast: String?
    @FocusState private var focus: String?

    init(token: WorklistToken, encounterId: String, existing: Consultation?, canRecord: Bool) {
        self.token = token
        self.encounterId = encounterId
        self.canRecord = canRecord
        _saved = State(initialValue: existing)
        _chief = State(initialValue: existing?.chiefComplaint ?? "")
        _exam = State(initialValue: existing?.examination ?? "")
        _assessment = State(initialValue: existing?.notes ?? "")
        _plan = State(initialValue: existing?.plan ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonTile(tone: saved != nil ? .success : .warning) {
                    Eyebrow("Visit")
                    Text(saved != nil ? "Recorded" : "New consultation").font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    HStack(spacing: 8) {
                        CarbonTag("token \(token.number)", mono: true)
                        // The record's state is what a test anchors on; the toast dismisses itself.
                        CarbonTag(saved != nil ? "saved" : "not saved", tone: saved != nil ? .success : .warning)
                            .accessibilityIdentifier(saved != nil ? "consultation-saved" : "consultation-unsaved")
                    }
                }
                CarbonSectionTitle("Clinical note").padding(.horizontal, -16)
                field("Chief complaint", $chief, "chief_complaint", error: problem)
                field("Examination", $exam, "examination")
                field("Assessment", $assessment, "assessment")
                field("Plan", $plan, "plan")
                if let error { CarbonNotification(kind: .error, title: "Could not save the consultation", message: error) }
                if let toast { CarbonNotification(kind: .success, title: toast, message: "").accessibilityIdentifier("consultation-toast") }
                if canRecord {
                    Button(saved != nil ? "Save changes" : "Save consultation") { Task { await save() } }
                        .buttonStyle(.carbonPrimary).disabled(busy)
                        .accessibilityLabel("Save this consultation").accessibilityIdentifier("consultation-save")
                } else {
                    Text("You can read this consultation but not change it.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
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

    private func save() async {
        guard let client else { return }
        problem = consultationProblem(chiefComplaint: chief, examination: exam, assessment: assessment, plan: plan)
        guard problem == nil else { return }
        busy = true
        error = nil
        toast = nil
        defer { busy = false }
        focus = nil
        let notes = ConsultationNotes(chiefComplaint: chief.trimmingCharacters(in: .whitespacesAndNewlines), examination: exam.trimmingCharacters(in: .whitespacesAndNewlines), notes: assessment.trimmingCharacters(in: .whitespacesAndNewlines), plan: plan.trimmingCharacters(in: .whitespacesAndNewlines))
        do {
            let api = DoctorApi(client: client)
            let written: Consultation
            if let current = saved {
                written = try await api.updateConsultation(encounterId, current.id, notes)
            } else {
                written = try await api.createConsultation(encounterId, notes)
            }
            saved = written
            toast = "Consultation saved"
        } catch {
            // The values stay on screen with the error: a failed write on ward wifi costs a retry, not a re-type.
            self.error = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
