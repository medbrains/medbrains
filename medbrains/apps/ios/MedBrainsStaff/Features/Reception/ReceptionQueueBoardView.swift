import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The desk's department as the desk sees it, and one action: Call next. Who
/// is next is the server's decision under its lock, by priority, never a call
/// per row. An outage is never an empty floor. Never the whole hospital: a
/// large OPD runs past the server's page and the desk's patients fall off it.
struct ReceptionQueueBoardView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @Environment(ReceptionSession.self) private var session
    @State private var queue = Remote<[WorklistToken]>()
    @State private var action = QueueActionState()

    var body: some View {
        let rows = queue.value ?? []
        let waiting = rows.count(in: TokenStatus.waiting)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Queue board", subtitle: "Today's OPD tokens for your department, oldest first.")
                CarbonPicker("Department", options: session.departments.map { .init(id: $0.id, label: $0.name) }, selection: Bindable(session).departmentId, placeholder: "Choose the desk's department")
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier("picker-board-department")
                if auth.identity?.can("opd.token.manage") ?? false {
                    VStack(alignment: .leading, spacing: 8) {
                        if let toast = action.toast { Text(toast).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.success).accessibilityIdentifier("queue-call-next-toast") }
                        if let failure = action.failure { CarbonNotification(kind: .error, title: "Nobody called", message: failure) }
                        Button { Task { await callNext() } } label: { HStack { Text("Call next (\(waiting) waiting)"); Spacer(); Image(systemName: "megaphone") } }
                            .buttonStyle(.carbonPrimary).disabled(action.busy || waiting == 0)
                            .accessibilityIdentifier("queue-call-next")
                    }
                    .padding(16)
                }
                if session.departmentId == nil, session.departmentsFailed {
                    CarbonNotification(kind: .error, title: "Couldn't load the board", message: "The hospital server did not answer. Do not read this as an empty floor.")
                        .padding(16)
                        .accessibilityIdentifier("reception-queue-unavailable")
                } else if session.departmentId == nil {
                    Text("Choose the desk's department to see who is waiting for it.")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
                        .accessibilityIdentifier("reception-queue-choose-department")
                } else {
                RemoteContentView(id: "reception-queue", state: queue.state, unavailableTitle: "Couldn't load the board", unavailableMessage: "The hospital server did not answer. Do not read this as an empty floor.", isEmpty: \.isEmpty, emptyTitle: "Nobody in the queue", emptyMessage: "No OPD tokens today yet.", retry: { Task { await reload() } }) { rows in
                    LazyVStack(spacing: 1) {
                        ForEach(rows) { t in
                            CarbonRow("\(t.number) · \(t.displayName)", detail: [t.uhid, t.scopeLabel].compactMap { $0 }.joined(separator: " · ")) {
                                CarbonTag(TokenStatus.label(t.status), tone: tokenTone(t.status))
                            }
                            .accessibilityIdentifier("queue-row-\(t.patientId ?? t.id)")
                        }
                    }
                    .padding(.horizontal, 16)
                }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Queue board").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-reception-queue")
        .task(id: session.departmentId) {
            guard let client, let dept = session.departmentId else { return }
            await queue.poll(every: QueuePolling.queueSeconds) { try await TokenApi(client: client, module: .opd).worklist(.department(dept)) }
        }
    }

    private func reload() async {
        guard let client, let dept = session.departmentId else { return }
        await queue.load { try await TokenApi(client: client, module: .opd).worklist(.department(dept)) }
    }

    private func callNext() async {
        guard let client, let dept = session.departmentId else { return }
        await action.run(unreachable: "Could not reach the hospital server. Nobody was called.") {
            let called = try await TokenApi(client: client, module: .opd).callNext(.department(dept))
            await reload()
            return called == nil ? "Nobody waiting" : "Called the next patient"
        }
    }
}
