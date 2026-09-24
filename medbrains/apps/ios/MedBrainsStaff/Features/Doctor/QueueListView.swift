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
    @State private var calling = false
    @State private var callError: String?
    @State private var toast: String?

    var body: some View {
        let waiting = remote.value?.filter { $0.status == "waiting" }.count ?? 0
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Doctor", title: "OPD queue", subtitle: "Today's tokens — tap a row to begin a consult.")
                if auth.identity?.can("opd.token.manage") ?? false {
                    VStack(alignment: .leading, spacing: 8) {
                        Button {
                            Task { await callNext() }
                        } label: {
                            HStack { Text(waiting > 0 ? "Call next (\(waiting) waiting)" : "Call next"); Spacer(); Image(systemName: "arrow.right") }
                        }
                        .buttonStyle(.carbonPrimary)
                        .disabled(calling)
                        .accessibilityLabel(waiting > 0 ? "Call the next patient, \(waiting) waiting" : "Call the next patient, nobody waiting")
                        .accessibilityIdentifier("queue-call-next")
                        if let callError { CarbonNotification(kind: .error, title: "Could not call the next patient", message: callError) }
                        // The confirmation is the point: a call that says nothing is a call the doctor presses twice.
                        if let toast {
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
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await DoctorApi(client: client).listWorklist() }
    }

    private func callNext() async {
        guard let client else { return }
        calling = true
        callError = nil
        defer { calling = false }
        do {
            let called = try await DoctorApi(client: client).callNext()
            // Null is a real answer, not a failure: the queue is empty.
            toast = called.map { _ in "Called the next patient" } ?? "Nobody is waiting"
            await load()
        } catch {
            callError = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
