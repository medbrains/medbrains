import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// SBAR shift handover for one encounter: the narrative, pending work that
/// must not be dropped between shifts, and patients the incoming nurse has
/// to be warned about. Handovers addressed to the signed-in nurse and not
/// yet accepted come first — an unaccepted handover is work nobody has
/// taken responsibility for.
struct ShiftHandoverView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let admission: AdmissionRow
    @State private var remote = Remote<[ShiftHandoff]>()

    /// Newest handovers only — the ward's history is unbounded, the screen is not.
    private let pageSize = 50

    var body: some View {
        let me = auth.identity?.userId ?? ""
        let handoffs = Array((remote.value ?? []).prefix(pageSize))
        let pending = handoffs.filter { $0.incomingNurseId == me && $0.incomingSignedAt == nil }
        let carried = handoffs.filter { $0.completedAt == nil }.flatMap { $0.alerts ?? [] }
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "SBAR handover", title: admission.patientName, subtitle: "UHID \(admission.uhid)") {
                    if !pending.isEmpty { CarbonTag("\(pending.count) to accept", tone: .danger) }
                }
                if !carried.isEmpty { CarriedOverBanner(alerts: carried).padding(.horizontal, 16) }
                RemoteContentView(
                    id: "handover",
                    state: remote.state,
                    unavailableTitle: "Handover unavailable",
                    unavailableMessage: "The shift handover could not be loaded. Nothing has been signed.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No handover recorded",
                    emptyMessage: "Nothing has been handed over for this encounter yet.",
                    retry: { Task { await load() } }
                ) { _ in
                    LazyVStack(spacing: 8) {
                        ForEach(handoffs) { h in HandoffRow(handoff: h, awaitingMe: h.incomingNurseId == me && h.incomingSignedAt == nil, onAccepted: { Task { await load() } }) }
                    }
                    .padding(16)
                }
                if auth.identity?.can("nurse.handoff.record") ?? false {
                    ComposeHandover(encounterId: admission.encounterId, onRecorded: { Task { await load() } }).padding(16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Handover")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-handover")
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await NurseApi(client: client).listHandoffs(admission.encounterId) }
    }
}

private struct CarriedOverBanner: View {
    let alerts: [HandoffAlert]
    var body: some View {
        let critical = alerts.filter { $0.kind == "critical" }
        let tasks = alerts.filter { $0.kind == "task" }
        CarbonNotification(kind: critical.isEmpty ? .info : .warning, title: critical.isEmpty ? "Carried over" : "Critical — carried over", message: (critical + tasks).map { ($0.kind == "critical" ? "! " : "• ") + $0.note }.joined(separator: "\n"))
    }
}

private struct HandoffRow: View {
    @Environment(\.apiClient) private var client
    let handoff: ShiftHandoff
    let awaitingMe: Bool
    let onAccepted: () -> Void
    @State private var busy = false
    @State private var failed = false

    var body: some View {
        CarbonTile(tone: handoff.completedAt != nil ? .success : awaitingMe ? .danger : .info) {
            HStack {
                Text(ServerTime.short(handoff.createdAt)).font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
                Spacer()
                CarbonTag(handoff.completedAt != nil ? "Accepted" : awaitingMe ? "Awaiting you" : "Awaiting nurse", tone: handoff.completedAt != nil ? .success : awaitingMe ? .danger : .info)
            }
            Text(handoff.situation ?? "No situation recorded").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink).lineLimit(2)
            Text(handoff.recommendation ?? "No recommendation recorded").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary).lineLimit(1)
            // Accepting is a signature. A failure must read as "not signed", never as a silent success.
            if failed { Text("Not accepted — try again.").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger) }
            if awaitingMe {
                Button("Accept handover") { Task { await accept() } }.buttonStyle(.carbonPrimary).disabled(busy)
                    .accessibilityLabel("Accept handover recorded \(ServerTime.short(handoff.createdAt))")
            }
        }
    }

    private func accept() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failed = false
        do { _ = try await NurseApi(client: client).acceptHandoff(handoff.id); onAccepted() } catch { failed = true }
    }
}

private struct ComposeHandover: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let encounterId: String
    let onRecorded: () -> Void
    @State private var open = false
    @State private var incomingNurseId = ""
    @State private var s = ""
    @State private var b = ""
    @State private var a = ""
    @State private var r = ""
    @State private var busy = false
    @State private var failed = false
    @FocusState private var focus: String?

    var body: some View {
        if open {
            VStack(alignment: .leading, spacing: 16) {
                field("Incoming nurse (user id)", $incomingNurseId, "incoming")
                field("Situation", $s, "s")
                field("Background", $b, "b")
                field("Assessment", $a, "a")
                field("Recommendation", $r, "r")
                if failed { CarbonNotification(kind: .error, title: "Handover not recorded", message: "Nothing was signed. Try again.") }
                HStack(spacing: 8) {
                    Button("Cancel") { open = false }.buttonStyle(.carbonTertiary).disabled(busy)
                    Button("Sign handover") { Task { await submit() } }.buttonStyle(.carbonPrimary)
                        .disabled(busy || incomingNurseId.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityLabel("Sign and record this handover")
                }
            }
            .padding(16)
            .background(MedBrainsTheme.surface)
        } else {
            Button("Record handover") { open = true }.buttonStyle(.carbonPrimary).accessibilityLabel("Record a shift handover")
        }
    }

    private func field(_ label: String, _ text: Binding<String>, _ key: String) -> some View {
        CarbonField(label, isFocused: focus == key) {
            TextField(label, text: text, axis: .vertical).lineLimit(1...4).focused($focus, equals: key)
        }
    }

    private func submit() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failed = false
        func opt(_ v: String) -> String? { let t = v.trimmingCharacters(in: .whitespacesAndNewlines); return t.isEmpty ? nil : t }
        do {
            _ = try await NurseApi(client: client).createHandoff(CreateHandoffPayload(encounterId: encounterId, incomingNurseId: incomingNurseId.trimmingCharacters(in: .whitespaces), situation: opt(s), background: opt(b), assessment: opt(a), recommendation: opt(r)))
            open = false
            s = ""; b = ""; a = ""; r = ""
            onRecorded()
        } catch { failed = true }
    }
}
