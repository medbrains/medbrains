import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The full registration wizard, opened from a camp's registration table:
/// every field the web asks, the form starting as this camp's, and the
/// patient put on the camp's route once registered. The quick form stays for
/// a queue of villagers; this is for the one who needs a proper record.
struct CampFullRegistrationView: View {
    let station: CampStation
    @Environment(\.apiClient) private var client
    @Environment(AuthStore.self) private var auth
    @State private var session = ReceptionSession()
    @State private var camp: CampSummary?
    @State private var loaded = false

    var body: some View {
        Group {
            if loaded {
                // A camp the list did not return (the role cannot list camps)
                // is still this camp: the station names it.
                RegisterPatientView(camp: camp ?? CampSummary(id: station.campId, name: station.campName, organizingDepartmentId: nil, venueName: nil, status: "planned"))
                    .environment(session)
            } else {
                ProgressView().accessibilityLabel("Loading the camp")
            }
        }
        .task { await load() }
    }

    /// The desk's lists through the session, so a list that failed is named on
    /// the form, then this station's camp (open or not) when the role may list camps.
    private func load() async {
        guard let client, !loaded else { return }
        let api = ReceptionApi(client: client)
        async let camps = (auth.identity?.can("camp.list") ?? false) ? try? api.camps() : nil
        await session.load(api, identity: auth.identity)
        camp = await camps?.first { $0.id == station.campId }
        loaded = true
    }
}
