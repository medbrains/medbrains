import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// What each request status reads as, and its tone.
private let requestStatus: [String: (label: String, tone: CarbonTone)] = [
    "with_doctor": ("With your doctor", .info),
    "sent_to_pharmacy": ("Sent to the pharmacy", .success),
    "declined": ("Declined", .warning),
]

/// How many prescriptions the section lists; the server sends at most this.
private let refillLimit = 20

/// Refills, at the top of Medicines: each recent prescription says what
/// asking would do — straight to the pharmacy, or to the doctor first — or
/// why it can't be asked for now, and how the last request went. Asking
/// opens the choice of collecting it or having it delivered. The server
/// decides all of it; the screen only shows it.
struct RefillsSection: View {
    /// Told when a refill was requested, so the deliveries list refreshes.
    var onRequested: () -> Void = {}
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalRefill]>()
    @State private var choosing: PortalRefill?
    @State private var outcome: (kind: CarbonNotification<EmptyView>.Kind, title: String, message: String)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CarbonSectionTitle("Refills")
            if let outcome {
                CarbonNotification(kind: outcome.kind, title: outcome.title, message: outcome.message)
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier("refill-outcome")
            }
            RemoteContentView(id: "refills", state: remote.state, unavailableTitle: "Couldn't load your refills", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "Nothing to refill", emptyMessage: "Recent prescriptions appear here.", retry: { Task { await load() } }) { rows in
                // A container of its own, so the list's identifier stays on the
                // list and each request button keeps its own.
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(rows.prefix(refillLimit)) { row in
                        RefillRow(row: row) { choosing = row }
                    }
                }
                .accessibilityElement(children: .contain)
            }
        }
        .task { await load() }
        .sheet(item: $choosing) { row in
            RefillChoiceSheet(row: row) { delivery in await ask(row, delivery: delivery) }
        }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.refills() }
    }

    /// Nil when requested; otherwise the server's reason, shown on the sheet.
    private func ask(_ row: PortalRefill, delivery: HomeDelivery.Choice?) async -> String? {
        guard let portal else { return "Sign in again to ask for a refill." }
        do {
            let request = try await portal.requestRefill(prescriptionId: row.prescriptionId, delivery: delivery)
            outcome = request.status == "with_doctor"
                ? (.success, "Refill requested", "Your doctor will look at it. Their answer shows here.")
                : delivery != nil
                    ? (.success, "Refill requested", "Follow it under Deliveries.")
                    : (.success, "Refill requested", "The pharmacy will have it ready.")
            await load()
            onRequested()
            return nil
        } catch {
            return error.localizedDescription
        }
    }
}

private struct RefillRow: View {
    let row: PortalRefill
    let onAsk: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(row.drugs.joined(separator: ", ")).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
            Text(details).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
            if let last = row.latestRequest, let status = requestStatus[last.status] {
                CarbonTag(status.label, tone: status.tone)
                if let note = last.decisionNote {
                    Text("Doctor's note: \(note)").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                }
            }
            Text(row.message).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            if row.goesTo != nil {
                Button("Request refill", action: onAsk)
                    .buttonStyle(CarbonPrimaryButtonStyle())
                    .accessibilityIdentifier("request-refill-\(row.prescriptionId)")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var details: String {
        var parts = ["Prescribed \(ServerTime.short(row.prescribedAt))"]
        if let doctor = row.doctorName { parts.append("Dr. \(doctor)") }
        if let until = row.validUntil { parts.append("valid until \(ServerTime.day(until))") }
        if row.refillsLeft > 0 { parts.append("\(row.refillsLeft) refill(s) left") }
        return parts.joined(separator: " · ")
    }
}
