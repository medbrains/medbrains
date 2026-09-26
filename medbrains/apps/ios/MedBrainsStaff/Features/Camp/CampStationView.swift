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
    @State private var toast: String?
    @State private var failure: String?
    @State private var busy = false

    private var callingRoom: String? { station.rooms.count > 1 ? room : station.rooms.first ?? station.name }

    var body: some View {
        let rows = queue.value ?? []
        let waiting = rows.filter { $0.status == "waiting" }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: station.campName, title: station.label, subtitle: "Patients are called by the number they got at registration.")
                VStack(alignment: .leading, spacing: 8) {
                    if station.rooms.count > 1 {
                        CarbonPicker("Your room", options: station.rooms.map { .init(id: $0, label: $0) }, selection: $room, placeholder: "Which room you call to")
                            .accessibilityIdentifier("camp-room-picker")
                    }
                    if let toast { Text(toast).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.success).accessibilityIdentifier("camp-toast") }
                    if let failure { CarbonNotification(kind: .error, title: "Not done", message: failure) }
                    Button { Task { await act { try await $0.callNext(station, room: callingRoom ?? station.name) == nil ? "Nobody waiting" : "Called the next patient" } } } label: {
                        HStack { Text("Call next (\(waiting) waiting)"); Spacer(); Image(systemName: "megaphone") }
                    }
                    .buttonStyle(.carbonPrimary).disabled(busy || waiting == 0 || callingRoom == nil)
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
            await queue.poll(every: 5) { try await CampApi(client: client).queue(station) }
        }
    }

    @ViewBuilder
    private func tokenRow(_ t: WorklistToken) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonRow("\(t.number) · \(t.displayName)", detail: t.counterLabel) {
                CarbonTag(t.status.replacingOccurrences(of: "_", with: " "), tone: tokenTone(t.status))
            }
            if t.status == "called" || t.status == "serving" {
                HStack(spacing: 8) {
                    Button(isLast ? "Done" : "Done — send on") { Task { await act { _ = try await $0.complete(t.id); return isLast ? "Done" : "Sent to the next station" } } }
                        .buttonStyle(.carbonPrimary).accessibilityIdentifier("camp-complete-\(t.number)")
                    if !isLast {
                        Button("Done — finished") { Task { await act { _ = try await $0.finish(t.id); return "Finished — not sent on" } } }
                            .buttonStyle(.carbonTertiary).accessibilityIdentifier("camp-finish-\(t.number)")
                    }
                    Button("Not here") { Task { await act { _ = try await $0.noShow(t.id); return "Marked not here" } } }
                        .buttonStyle(.carbonGhost).accessibilityIdentifier("camp-no-show-\(t.number)")
                }
                .disabled(busy)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("camp-row-\(t.number)")
    }

    private func reload() async {
        guard let client else { return }
        await queue.load { try await CampApi(client: client).queue(station) }
    }

    /// Runs one action; its answer is what the volunteer is told happened.
    private func act(_ call: (CampApi) async throws -> String) async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            let done = try await call(CampApi(client: client))
            toast = done
            UIAccessibility.post(notification: .announcement, argument: done)
            await reload()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was changed."
        }
    }
}
