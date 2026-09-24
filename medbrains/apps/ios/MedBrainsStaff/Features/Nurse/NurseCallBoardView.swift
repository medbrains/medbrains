import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The ward's open calls, on the phone that can answer them. Two acts, and
/// they are not the same one: **Seen** records that a human has the call,
/// **Done** records that they went. The server keeps the waiting clock on
/// `created_at` through both, so acknowledging never quiets the board.
/// Unlike the TV, this screen shows the patient's own note: a phone is held
/// by one person, a nursing station is a corridor with a screen in it.
struct NurseCallBoardView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<NurseCallBoard>()

    /// A ward that has more than this waiting has a staffing problem, not a paging one.
    private let pageSize = 50

    var body: some View {
        let calls = Array((remote.value?.calls ?? []).prefix(pageSize))
        let overdue = calls.filter { nurseCallIsOverdue(escalation: $0.escalation) }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Nurse calls", title: "Open calls", subtitle: "Every call still waiting, oldest first.") {
                    if overdue > 0 { CarbonTag("\(overdue) overdue", tone: .danger) }
                }
                RemoteContentView(
                    id: "nurse-calls",
                    state: remote.state,
                    unavailableTitle: "Call board unavailable",
                    unavailableMessage: "The ward's calls could not be loaded. Do not read this as a quiet ward — check the station board or the handset.",
                    isEmpty: { $0.calls.isEmpty },
                    emptyTitle: "No open calls",
                    emptyMessage: "Every call has been answered.",
                    retry: { Task { await load() } }
                ) { _ in
                    LazyVStack(spacing: 8) {
                        ForEach(calls) { call in
                            CallRow(call: call, canRespond: auth.identity?.can("bedside.sessions.manage") ?? false, onChanged: { Task { await load() } })
                        }
                    }
                    .padding(16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Open calls")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-nurse-calls")
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await NurseApi(client: client).listNurseCalls() }
    }
}

private let requestTypeLabel: [String: String] = [
    "bathroom_assist": "Bathroom", "blanket_pillow": "Blanket / pillow", "nurse_call": "Nurse call",
    "other": "Assistance", "pain_management": "Pain", "position_change": "Reposition", "water_food": "Water / food",
]

private func escalationTone(_ escalation: String) -> (String, CarbonTone) {
    switch escalation {
    case "supervisor": ("Supervisor", .danger)
    case "charge_nurse": ("Charge nurse", .warning)
    default: ("Waiting", .neutral)
    }
}

private struct CallRow: View {
    @Environment(\.apiClient) private var client
    let call: ActiveNurseCall
    let canRespond: Bool
    let onChanged: () -> Void
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        let (label, tone) = escalationTone(call.escalation)
        CarbonTile(tone: tone) {
            HStack {
                Text((call.bedNumber ?? "No bed") + (call.wardName.map { " · \($0)" } ?? ""))
                    .font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                Spacer()
                CarbonTag(label, tone: tone)
            }
            Text(requestTypeLabel[call.requestType] ?? "Assistance").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            if let notes = call.notes, !notes.isEmpty {
                Text(notes).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            }
            Text(nurseCallWaitLabel(waitingSeconds: Int64(call.waitingSeconds)) + " waiting" + (call.acknowledgedAt != nil ? " · seen" : ""))
                .font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
            if let failure { Text(failure).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger) }
            if canRespond {
                HStack(spacing: 8) {
                    if call.acknowledgedAt == nil {
                        Button("Seen") { Task { await respond("acknowledged") } }
                            .buttonStyle(.carbonTertiary).disabled(busy)
                            .accessibilityLabel("Mark the call from \(call.bedNumber ?? "an unassigned bed") as seen")
                            .accessibilityIdentifier("nurse-call-seen-\(call.id)")
                    }
                    Button("Done") { Task { await respond("completed") } }
                        .buttonStyle(.carbonPrimary).disabled(busy)
                        .accessibilityLabel("Mark the call from \(call.bedNumber ?? "an unassigned bed") as answered")
                        .accessibilityIdentifier("nurse-call-done-\(call.id)")
                }
            }
        }
    }

    private func respond(_ status: String) async {
        guard let client else { return }
        busy = true
        failure = nil
        // The row unbusies even when the call failed, so a nurse can try
        // again. A button that never comes back reads as "it worked".
        defer { busy = false }
        do {
            _ = try await NurseApi(client: client).updateNurseCall(call.id, status: status)
            onChanged()
        } catch {
            failure = "Not recorded — try again."
        }
    }
}
