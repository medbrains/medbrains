import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The floor as the desk sees it, and one action: Call next. Who is next is
/// the server's decision under its lock, by priority, never a call per row.
/// An outage is never an empty floor.
struct ReceptionQueueBoardView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var queue = Remote<[WorklistToken]>()
    @State private var toast: String?
    @State private var failure: String?
    @State private var busy = false

    var body: some View {
        let rows = queue.value ?? []
        let waiting = rows.filter { $0.status == "waiting" }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Queue board", subtitle: "Today's OPD tokens, oldest first.")
                if auth.identity?.can("opd.token.manage") ?? false {
                    VStack(alignment: .leading, spacing: 8) {
                        if let toast { Text(toast).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.success).accessibilityIdentifier("queue-call-next-toast") }
                        if let failure { CarbonNotification(kind: .error, title: "Nobody called", message: failure) }
                        Button { Task { await callNext() } } label: { HStack { Text("Call next (\(waiting) waiting)"); Spacer(); Image(systemName: "megaphone") } }
                            .buttonStyle(.carbonPrimary).disabled(busy || waiting == 0)
                            .accessibilityIdentifier("queue-call-next")
                    }
                    .padding(16)
                }
                RemoteContentView(id: "reception-queue", state: queue.state, unavailableTitle: "Couldn't load the board", unavailableMessage: "The hospital server did not answer. Do not read this as an empty floor.", isEmpty: \.isEmpty, emptyTitle: "Nobody in the queue", emptyMessage: "No OPD tokens today yet.", retry: { Task { await reload() } }) { rows in
                    LazyVStack(spacing: 1) {
                        ForEach(rows) { t in
                            CarbonRow("\(t.number) · \(t.displayName)", detail: [t.uhid, t.scopeLabel].compactMap { $0 }.joined(separator: " · ")) {
                                CarbonTag(t.status.replacingOccurrences(of: "_", with: " "), tone: tokenTone(t.status))
                            }
                            .accessibilityIdentifier("queue-row-\(t.patientId ?? t.id)")
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Queue board").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-reception-queue")
        .task {
            guard let client else { return }
            await queue.poll(every: 5) { try await DoctorApi(client: client).listWorklist() }
        }
    }

    private func reload() async {
        guard let client else { return }
        await queue.load { try await DoctorApi(client: client).listWorklist() }
    }

    private func callNext() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            let called = try await DoctorApi(client: client).callNext()
            toast = called.map { _ in "Called the next patient" } ?? "Nobody waiting"
            UIAccessibility.post(notification: .announcement, argument: toast ?? "")
            await reload()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nobody was called."
        }
    }
}
