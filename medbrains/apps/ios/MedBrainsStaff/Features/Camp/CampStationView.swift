import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One camp station: its queue, one Call next, and what happened to the
/// patient in front of you. A step shared by two doctors asks which room you
/// are in, so the call tells the patient where to walk.
struct CampStationView: View {
    let station: CampStation
    let isLast: Bool
    @Environment(\.apiClient) private var client
    @State private var queue = Remote<[WorklistToken]>()
    @State private var room: String?
    @State private var action = QueueActionState()

    private static let unreachable = "Could not reach the hospital server. Nothing was changed."

    private var slice: QueueSlice { .counter(station.counterId) }
    private var callingRoom: String? { station.rooms.count > 1 ? room : station.rooms.first ?? station.name }

    var body: some View {
        let waiting = (queue.value ?? []).filter { $0.status == TokenStatus.waiting }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: station.campName, title: station.label, subtitle: "Patients are called by the number they got at registration.")
                VStack(alignment: .leading, spacing: 8) {
                    if station.rooms.count > 1 {
                        CarbonPicker("Your room", options: station.rooms.map { .init(id: $0, label: $0) }, selection: $room, placeholder: "Which room you call to")
                            .accessibilityIdentifier("camp-room-picker")
                    }
                    if let toast = action.toast { Text(toast).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.success).accessibilityIdentifier("camp-toast") }
                    if let failure = action.failure { CarbonNotification(kind: .error, title: "Not done", message: failure) }
                    Button { Task { await callNext() } } label: {
                        HStack { Text("Call next (\(waiting) waiting)"); Spacer(); Image(systemName: "megaphone") }
                    }
                    .buttonStyle(.carbonPrimary).disabled(action.busy || waiting == 0 || callingRoom == nil)
                    .accessibilityIdentifier("camp-call-next")
                }
                .padding(16)
                RemoteContentView(id: "camp-queue", state: queue.state, unavailableTitle: "Couldn't load this station", unavailableMessage: "The hospital server did not answer. Do not read this as an empty queue.", isEmpty: \.isEmpty, emptyTitle: "Nobody here yet", emptyMessage: "Patients appear once the station before this one is done with them.", retry: { Task { await reload() } }) { rows in
                    LazyVStack(spacing: 1) { ForEach(rows) { tokenRow($0) } }.padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle(station.name).navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-camp-station")
        .task {
            guard let client else { return }
            await queue.poll(every: QueuePolling.queueSeconds) { try await TokenApi(client: client, module: .camp).worklist(slice) }
        }
    }

    @ViewBuilder
    private func tokenRow(_ t: WorklistToken) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonRow("\(t.number) · \(t.displayName)", detail: t.counterLabel) {
                CarbonTag(TokenStatus.label(t.status), tone: tokenTone(t.status))
            }
            if TokenStatus.isWithStaff(t.status) {
                HStack(spacing: 8) {
                    Button(isLast ? "Done" : "Done — send on") { act(isLast ? "Done" : "Sent to the next station") { try await $0.complete(t.id) } }
                        .buttonStyle(.carbonPrimary).accessibilityIdentifier("camp-complete-\(t.number)")
                    if !isLast {
                        Button("Done — finished") { act("Finished — not sent on") { try await $0.finish(t.id) } }
                            .buttonStyle(.carbonTertiary).accessibilityIdentifier("camp-finish-\(t.number)")
                    }
                    Button("Not here") { act("Marked not here") { try await $0.noShow(t.id) } }
                        .buttonStyle(.carbonGhost).accessibilityIdentifier("camp-no-show-\(t.number)")
                }
                .disabled(action.busy)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("camp-row-\(t.number)")
    }

    private func reload() async {
        guard let client else { return }
        await queue.load { try await TokenApi(client: client, module: .camp).worklist(slice) }
    }

    private func callNext() async {
        guard let client else { return }
        await action.run(unreachable: Self.unreachable) {
            let called = try await TokenApi(client: client, module: .camp).callNext(slice, counterLabel: callingRoom ?? station.name)
            await reload()
            return called == nil ? "Nobody waiting" : "Called the next patient"
        }
    }

    /// One action on the patient in front of the volunteer, then the queue again.
    private func act(_ done: String, _ op: @escaping (TokenApi) async throws -> ModuleToken) {
        guard let client else { return }
        Task {
            await action.run(unreachable: Self.unreachable) {
                _ = try await op(TokenApi(client: client, module: .camp))
                await reload()
                return done
            }
        }
    }
}
