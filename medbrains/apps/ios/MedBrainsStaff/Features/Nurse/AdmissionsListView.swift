import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Active admissions worklist. Pick a bed to enter the bedside workspace.
struct AdmissionsListView: View {
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[AdmissionRow]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Nurse", title: "My shift", subtitle: "Tap a patient to open bedside MAR, vitals, I/O and risk actions.")
                RemoteContentView(
                    id: "admissions",
                    state: remote.state,
                    unavailableTitle: "Couldn't load admissions",
                    unavailableMessage: "The ward list could not be loaded. Do not read this as an empty ward.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No active admissions",
                    emptyMessage: "Nobody is admitted on your wards right now.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(spacing: 0) {
                        ForEach(rows) { row in
                            NavigationLink(value: NurseRoute.workspace(row)) {
                                CarbonRow(row.patientName, detail: row.bedLine) { CarbonTag("active", tone: .success) }
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("admission-\(row.id)")
                        }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("My shift")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-admissions")
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await NurseApi(client: client).listActiveAdmissions() }
    }
}
