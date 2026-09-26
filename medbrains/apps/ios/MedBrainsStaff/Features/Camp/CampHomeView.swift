import MedBrainsKit
import MedBrainsUI
import SwiftUI

enum CampRoute: Hashable {
    case register(CampStation)
    case station(CampStation, isLast: Bool)
}

/// A camp's route as the volunteer picks their place in it: the first step
/// registers people, every later step calls them by the number registration
/// gave. A step with two doctors is one queue; the room is chosen inside.
struct CampHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var stations = Remote<[CampStation]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Camp", title: "Your station", subtitle: "Choose where you are working today.")
                RemoteContentView(id: "camp-stations", state: stations.state, unavailableTitle: "Couldn't load the camps", unavailableMessage: "The hospital server did not answer. Your camp is still running.", isEmpty: \.isEmpty, emptyTitle: "No camp running", emptyMessage: "A camp appears here once its coordinator starts its route.", retry: { Task { await load() } }) { rows in
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(camps(rows), id: \.first?.campId) { steps in
                            CarbonSectionTitle(steps.first?.campName ?? "")
                            ForEach(steps) { step in row(step, first: step == steps.first, last: step == steps.last) }
                        }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("module-home-camp")
        .navigationDestination(for: CampRoute.self) { route in
            switch route {
            case .register(let s): CampRegisterView(station: s)
            case .station(let s, let isLast): CampStationView(station: s, isLast: isLast)
            }
        }
        // A coordinator often starts the route after the volunteers have
        // opened the app; the camp has to appear without a restart.
        .task {
            guard let client else { return }
            await stations.poll(every: 15) { try await CampApi(client: client).stations() }
        }
    }

    /// Stations arrive in route order; each camp's steps stay together.
    private func camps(_ rows: [CampStation]) -> [[CampStation]] {
        var order: [String] = []
        var byCamp: [String: [CampStation]] = [:]
        for s in rows {
            if byCamp[s.campId] == nil { order.append(s.campId) }
            byCamp[s.campId, default: []].append(s)
        }
        return order.compactMap { byCamp[$0] }
    }

    @ViewBuilder
    private func row(_ step: CampStation, first: Bool, last: Bool) -> some View {
        // Registration hands out numbers; nobody queues at it.
        if first {
            if auth.identity?.can("camp.registrations.create") ?? false {
                NavigationLink(value: CampRoute.register(step)) {
                    CarbonRow(step.label, detail: "Register people and give their number") { Image(systemName: "person.badge.plus").foregroundStyle(MedBrainsTheme.interactive) }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("camp-station-\(step.counterId)")
            }
        } else {
            NavigationLink(value: CampRoute.station(step, isLast: last)) {
                CarbonRow(step.label, detail: step.rooms.count > 1 ? "\(step.rooms.count) rooms share this queue" : "Call the next patient") { Image(systemName: "person.3.sequence").foregroundStyle(MedBrainsTheme.interactive) }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("camp-station-\(step.counterId)")
        }
    }

    private func load() async {
        guard let client else { return }
        await stations.load { try await CampApi(client: client).stations() }
    }
}
