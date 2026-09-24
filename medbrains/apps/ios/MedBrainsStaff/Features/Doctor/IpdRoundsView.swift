import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The doctor's ward round worklist: a mobile clinical worklist, not an
/// admission-management screen.
struct IpdRoundsView: View {
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[AdmissionRow]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Doctor", title: "IPD rounds", subtitle: "Active admitted patients for ward review.")
                RemoteContentView(
                    id: "ipd-rounds",
                    state: remote.state,
                    unavailableTitle: "Couldn't load IPD rounds",
                    unavailableMessage: "The ward list could not be loaded. Do not read this as an empty ward.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No active admissions",
                    emptyMessage: "No patients are currently on rounds.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(spacing: 0) {
                        ForEach(rows) { row in
                            NavigationLink(value: DoctorRoute.roundDetail(row)) {
                                CarbonRow(row.patientName, detail: row.bedLine) { CarbonTag("round", tone: .info) }
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("round-\(row.id)")
                        }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("IPD rounds")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-ipd-rounds")
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await NurseApi(client: client).listActiveAdmissions() }
    }
}

/// The mobile round landing point for one admission. Progress notes,
/// diagnosis, prescription review and investigations stay under this
/// patient context; they land in later phases and say so here.
struct IpdRoundDetailView: View {
    let admission: AdmissionRow

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                CarbonPageHeader(eyebrow: "Round", title: admission.patientName, subtitle: admission.bedLine) { CarbonTag(admission.status, tone: .success) }
                CarbonTile(tone: .info) {
                    Eyebrow("Mini EMR")
                    Text("Ward review context").font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    Text("Progress notes, diagnosis, prescription review, investigations and discharge planning stay under this patient context.")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    HStack(spacing: 8) {
                        CarbonTag("encounter \(admission.encounterId.prefix(8))", mono: true)
                        CarbonTag("IPD", tone: .info)
                    }
                }
                .padding(.horizontal, 16)
                ForEach([("Progress note", "SOAP note, senior co-sign requirement and discharge readiness.", CarbonTone.info),
                         ("Diagnosis", "ICD/SNOMED review for the current admission.", .success),
                         ("Prescription review", "Medication reconciliation, MAR visibility and pharmacy status.", .highAlert),
                         ("Lab / radiology", "Critical values, pending reports and DICOM review links.", .warning)], id: \.0) { item in
                    CarbonTile(tone: item.2) {
                        Text(item.0).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                        Text(item.1).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle(admission.patientName)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-ipd-round-detail")
    }
}
