import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The MAR schedule for an admission. The list is the schedule; giving a
/// dose happens on the bedside screen, which scans the wristband and the
/// drug first.
struct MarScheduleView: View {
    @Environment(\.apiClient) private var client
    let admission: AdmissionRow
    @State private var remote = Remote<[MarRow]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "MAR", title: admission.patientName, subtitle: admission.bedLine)
                RemoteContentView(
                    id: "mar",
                    state: remote.state,
                    unavailableTitle: "Couldn't load MAR",
                    unavailableMessage: "The schedule could not be loaded. Do not read this as no doses due.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No scheduled doses",
                    emptyMessage: "MAR is empty for this admission.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(spacing: 8) {
                        ForEach(rows) { dose in DoseRow(admission: admission, dose: dose) }
                    }
                    .padding(16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("MAR")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-mar")
        // Refetch every time the screen shows: the dose the nurse just
        // recorded has to be visibly gone, or they will record it again.
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await NurseApi(client: client).listMar(admission.id) }
    }
}

func marTone(_ status: String) -> CarbonTone {
    switch status {
    case "scheduled": .info
    case "given": .success
    case "missed": .danger
    case "refused", "held": .warning
    default: .neutral
    }
}

private struct DoseRow: View {
    let admission: AdmissionRow
    let dose: MarRow

    var body: some View {
        CarbonTile(tone: dose.isHighAlert ? .highAlert : marTone(dose.status)) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(dose.drugName).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    Text("\(dose.dose) · \(dose.route)" + (dose.frequency.map { " · \($0)" } ?? "")).font(CarbonType.code).foregroundStyle(MedBrainsTheme.inkSecondary)
                    Text("DUE \(ServerTime.short(dose.scheduledAt))").font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    CarbonTag(dose.status, tone: marTone(dose.status))
                    if dose.isHighAlert { CarbonTag("high alert", tone: .highAlert) }
                }
            }
            if dose.status == "scheduled" {
                NavigationLink(value: NurseRoute.administer(admission, dose)) {
                    HStack { Text("Take to bedside"); Spacer(); Image(systemName: "arrow.right") }
                }
                .buttonStyle(.carbonPrimary)
                .accessibilityLabel("Take \(dose.drugName) to the bedside and scan")
                .accessibilityIdentifier("mar-take-to-bedside")
            }
        }
    }
}
