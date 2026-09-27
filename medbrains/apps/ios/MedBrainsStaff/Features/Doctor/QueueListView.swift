import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Today's OPD queue — the unified `tokens` queue the waiting-room board
/// shows, so calling here moves the number on the wall. "Call next" lets the
/// server pick by priority and sequence under its lock; a client choosing a
/// row would race another desk and call one patient twice.
struct QueueListView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[WorklistToken]>()
    @State private var action = QueueActionState()
    /// Off: own patients, then the department's unassigned. On: the whole department.
    @State private var wholeDepartment = false

    private var slice: QueueSlice { wholeDepartment ? .myDepartments : .mine }

    var body: some View {
        let waiting = remote.value?.count(in: TokenStatus.waiting) ?? 0
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Doctor", title: "OPD queue", subtitle: wholeDepartment ? "Everyone waiting in your department." : "Your patients first, then your department's unassigned.")
                Toggle("Whole department", isOn: $wholeDepartment)
                    .font(CarbonType.bodyCompact)
                    .padding(.horizontal, 16).padding(.bottom, 12)
                    .accessibilityIdentifier("queue-whole-department")
                if auth.identity?.can("opd.token.manage") ?? false {
                    VStack(alignment: .leading, spacing: 8) {
                        Button {
                            Task { await callNext() }
                        } label: {
                            HStack { Text(waiting > 0 ? "Call next (\(waiting) waiting)" : "Call next"); Spacer(); Image(systemName: "arrow.right") }
                        }
                        .buttonStyle(.carbonPrimary)
                        .disabled(action.busy)
                        .accessibilityLabel(waiting > 0 ? "Call the next patient, \(waiting) waiting" : "Call the next patient, nobody waiting")
                        .accessibilityIdentifier("queue-call-next")
                        if let callError = action.failure { CarbonNotification(kind: .error, title: "Could not call the next patient", message: callError) }
                        // The confirmation is the point: a call that says nothing is a call the doctor presses twice.
                        if let toast = action.toast {
                            CarbonNotification(kind: .info, title: toast, message: "").accessibilityIdentifier("queue-call-next-toast")
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
                RemoteContentView(
                    id: "doctor-queue",
                    state: remote.state,
                    unavailableTitle: "Couldn't load the queue",
                    unavailableMessage: "Today's tokens could not be loaded. Do not read this as an empty clinic.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "Queue is empty",
                    emptyMessage: "No tokens issued for today yet.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(spacing: 0) {
                        ForEach(rows) { token in
                            NavigationLink(value: DoctorRoute.queueDetail(token)) {
                                CarbonRow(token.displayName, detail: "UHID \(token.uhid ?? "—") · TOKEN \(token.number)") {
                                    CarbonTag(token.status, tone: tokenTone(token.status))
                                }
                            }
                            .buttonStyle(.plain)
                            // Keyed by patient, not position: a queue reorders as it advances.
                            .accessibilityIdentifier("queue-row-\(token.patientId ?? token.id)")
                        }
                    }
                    .padding(.bottom, 32)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("OPD queue")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-doctor-queue")
        .task(id: wholeDepartment) { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await TokenApi(client: client, module: .opd).worklist(slice) }
    }

    private func callNext() async {
        guard let client else { return }
        await action.run(unreachable: "Could not reach the hospital server.") {
            let called = try await TokenApi(client: client, module: .opd).callNext(slice)
            await load()
            // Null is a real answer, not a failure: the queue is empty.
            return called == nil ? "Nobody is waiting" : "Called the next patient"
        }
    }
}
