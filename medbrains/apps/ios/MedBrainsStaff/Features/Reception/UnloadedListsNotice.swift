import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Names the picker lists the desk could not load, with a retry, so an
/// outage never reads as a hospital with no doctors or departments.
struct UnloadedListsNotice: View {
    @Environment(\.apiClient) private var client
    @Environment(AuthStore.self) private var auth
    @Environment(ReceptionSession.self) private var session
    @State private var busy = false

    var body: some View {
        if !session.unloadedLists.isEmpty {
            let lists = ListFormatter.localizedString(byJoining: session.unloadedLists)
            CarbonNotification(
                kind: .error, title: "Couldn't load \(lists)",
                message:
                    "The hospital server did not answer, so those choices are missing here. Try again."
            ) {
                Button("Try again") { Task { await reload() } }
                    .buttonStyle(.carbonTertiary).disabled(busy)
                    .accessibilityIdentifier("unloaded-lists-retry")
            }
            .accessibilityIdentifier("unloaded-lists")
        }
    }

    /// Loads the desk's lists again; whatever still fails stays named above.
    private func reload() async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        await session.load(ReceptionApi(client: client), identity: auth.identity)
    }
}
