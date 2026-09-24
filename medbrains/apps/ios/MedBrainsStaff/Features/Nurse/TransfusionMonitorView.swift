import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The transfusions running on this bed, and the observations they owe.
/// What this screen is for is the fifteen-minute check: an acute haemolytic
/// reaction declares itself early, so the phase is called out by name and
/// goes red when it is late. `reactionSuspected` is read, never computed.
struct TransfusionMonitorView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let admission: AdmissionRow
    @State private var remote = Remote<[BedsideTransfusion]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Transfusion", title: admission.patientName, subtitle: admission.bedLine)
                RemoteContentView(
                    id: "transfusions",
                    state: remote.state,
                    unavailableTitle: "Couldn't load the transfusion chart",
                    unavailableMessage: "Do not read this as nothing running; check the bedside chart.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No transfusions",
                    emptyMessage: "Nothing has been hung on this bed.",
                    retry: { Task { await load() } }
                ) { units in
                    LazyVStack(spacing: 8) {
                        ForEach(units) { unit in TransfusionCard(unit: unit, canRecord: auth.identity?.can("nurse.transfusion.administer") ?? false, onChanged: { Task { await load() } }) }
                    }
                    .padding(16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Transfusion")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-transfusions")
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await NurseApi(client: client).listTransfusions(admission.id) }
    }
}

private let phaseLabel: [String: String] = ["baseline": "Before starting", "fifteen_min": "15 minutes in", "periodic": "Hourly", "completion": "At the end"]

private struct TransfusionCard: View {
    @Environment(\.apiClient) private var client
    let unit: BedsideTransfusion
    let canRecord: Bool
    let onChanged: () -> Void
    @State private var observations = Remote<[TransfusionObservation]>()
    @State private var phase: String?
    @State private var failure: String?

    var body: some View {
        let charted = observations.value ?? []
        let started = ServerTime.parse(unit.transfusionStartTime).map { Int64($0.timeIntervalSince1970) }
        let running = transfusionIsRunning(startedUnix: started, ended: unit.transfusionEndTime != nil)
        let suspected = charted.contains(where: \.reactionSuspected)
        let states = transfusionPhaseStates(startedUnix: started, ended: unit.transfusionEndTime != nil, recordedPhases: charted.map(\.phase), nowUnix: Int64(Date().timeIntervalSince1970))
        CarbonTile(tone: suspected ? .danger : running ? .success : .neutral) {
            HStack {
                Text("\(unit.productType ?? "Unit") · \(unit.bloodGroup ?? "?")" + (unit.rhFactor.map { " \($0)" } ?? "")).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                Spacer()
                CarbonTag(suspected ? "reaction suspected" : running ? "running" : "finished", tone: suspected ? .danger : running ? .success : .neutral)
            }
            Text("BAG \(unit.bagNumber ?? "—")").font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
            if suspected {
                Text("Stop the transfusion, keep the line open, and call the doctor. Return the bag and the giving set to the blood bank.")
                    .font(CarbonType.body).foregroundStyle(MedBrainsTheme.danger)
            }
            // A chart that cannot be read is not an empty chart.
            if case .failed = observations.state {
                CarbonNotification(kind: .error, title: "Observations unavailable", message: "What is outstanding is unknown.")
            } else {
                ForEach(states, id: \.phase) { s in
                    HStack {
                        Text(phaseLabel[s.phase] ?? s.phase).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                        Spacer()
                        CarbonTag(s.recorded ? "charted" : s.overdue ? "overdue" : "due later", tone: s.recorded ? .success : s.overdue ? .danger : .neutral)
                    }
                }
            }
            if let failure { CarbonNotification(kind: .error, title: "Not saved", message: failure) }
            if canRecord, running, phase == nil {
                VStack(spacing: 8) {
                    ForEach(states.filter { $0.phase != "completion" }, id: \.phase) { s in
                        Button(phaseLabel[s.phase] ?? s.phase) { phase = s.phase }
                            .buttonStyle(s.overdue ? AnyButtonStyle(.carbonPrimary) : AnyButtonStyle(.carbonTertiary))
                            .accessibilityLabel("Chart observations \((phaseLabel[s.phase] ?? s.phase).lowercased())")
                    }
                    Button("Finish unit") { phase = "completion" }.buttonStyle(.carbonTertiary)
                        .accessibilityLabel("Record the final observations and close this unit")
                }
            }
            if canRecord, let phase {
                ObservationForm(transfusionId: unit.id, phase: phase, onCancel: { self.phase = nil }) { wasCompletion in
                    self.phase = nil
                    Task {
                        await loadObservations()
                        if wasCompletion { await complete() }
                    }
                }
            }
        }
        .task { await loadObservations() }
    }

    private func loadObservations() async {
        guard let client else { return }
        await observations.load { try await NurseApi(client: client).listObservations(unit.id) }
    }

    private func complete() async {
        guard let client else { return }
        do { _ = try await NurseApi(client: client).completeTransfusion(unit.id); onChanged() } catch { failure = (error as? ApiError)?.message ?? "The unit could not be closed." }
    }
}

/// Erases a button style so a condition can pick one.
struct AnyButtonStyle: ButtonStyle {
    private let make: (Configuration) -> AnyView
    init<S: ButtonStyle>(_ style: S) { make = { AnyView(style.makeBody(configuration: $0)) } }
    func makeBody(configuration: Configuration) -> some View { make(configuration) }
}

/// One set of observations. Every field is optional except the signs tick:
/// a nurse who took a pulse and not a blood pressure charts the pulse;
/// sending 0 for the rest would record a patient with no circulation.
private struct ObservationForm: View {
    @Environment(\.apiClient) private var client
    let transfusionId: String
    let phase: String
    let onCancel: () -> Void
    let onRecorded: (Bool) -> Void
    @State private var temperature = ""
    @State private var pulse = ""
    @State private var systolic = ""
    @State private var diastolic = ""
    @State private var adverseSigns = false
    @State private var notes = ""
    @State private var busy = false
    @State private var failure: String?
    @FocusState private var focus: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(phaseLabel[phase] ?? phase).font(CarbonType.heading01).foregroundStyle(MedBrainsTheme.ink)
            numberField("Temperature (°C)", $temperature, "t", decimal: true)
            numberField("Pulse", $pulse, "p")
            HStack(spacing: 8) {
                numberField("Systolic", $systolic, "s")
                numberField("Diastolic", $diastolic, "d")
            }
            Toggle("Rigors, rash, breathlessness or back pain", isOn: $adverseSigns).font(CarbonType.body).tint(MedBrainsTheme.interactive)
            CarbonField("Notes", isFocused: focus == "n") { TextField("Notes", text: $notes, axis: .vertical).focused($focus, equals: "n") }
            if let failure { CarbonNotification(kind: .error, title: "Not saved", message: failure) }
            HStack(spacing: 8) {
                Button("Save") { Task { await save() } }.buttonStyle(.carbonPrimary).disabled(busy).accessibilityLabel("Save these observations")
                Button("Cancel", action: onCancel).buttonStyle(.carbonGhost)
            }
        }
    }

    private func numberField(_ label: String, _ text: Binding<String>, _ key: String, decimal: Bool = false) -> some View {
        CarbonField(label, isFocused: focus == key) {
            TextField(label, text: text).keyboardType(decimal ? .decimalPad : .numberPad).focused($focus, equals: key)
        }
    }

    /// An empty field is not a zero. A decimal comma is accepted because a handset keyboard set to most of Europe offers one.
    private func number(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".")) }

    private func save() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            _ = try await NurseApi(client: client).recordObservation(transfusionId, RecordObservationPayload(phase: phase, temperatureC: number(temperature), pulse: number(pulse).map(Int.init), systolicBp: number(systolic).map(Int.init), diastolicBp: number(diastolic).map(Int.init), adverseSigns: adverseSigns, notes: notes.isEmpty ? nil : notes))
            onRecorded(phase == "completion")
        } catch { failure = (error as? ApiError)?.message ?? "The observations could not be saved." }
    }
}
