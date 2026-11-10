import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Share readings from Apple Health with the hospital. Each kind is off until
/// the patient turns it on; turning one off stops sharing it (what was
/// already shared stays in the record). The care team sees these as
/// patient-reported -- they are never charted or scored as the ward's own
/// observations.
struct HealthDataView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<HealthDataSharing>()
    @State private var busy = false
    @State private var outcome: (kind: CarbonNotification<EmptyView>.Kind, title: String, message: String)?
    private let reader = HealthKitReader()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Health", title: "Share health data", subtitle: "Readings from Apple Health your care team can see, marked as reported by you.")
                if !HealthKitReader.isAvailable {
                    CarbonNotification(kind: .info, title: "Apple Health isn't available", message: "This device has no Apple Health to read from.").padding(16)
                }
                if let outcome {
                    CarbonNotification(kind: outcome.kind, title: outcome.title, message: outcome.message)
                        .padding(.horizontal, 16)
                        .accessibilityIdentifier("health-share-outcome")
                }
                RemoteContentView(id: "health-data", state: remote.state, unavailableTitle: "Couldn't load your sharing choices", unavailableMessage: "Try again in a moment.", isEmpty: { _ in false }, emptyTitle: "", emptyMessage: "", retry: { Task { await load() } }) { sharing in
                    VStack(alignment: .leading, spacing: 8) {
                        CarbonSectionTitle("What you share")
                        ForEach(HealthDataKind.allCases) { kind in
                            Toggle(kind.label, isOn: Binding(
                                get: { sharing.isShared(kind, from: .healthkit) },
                                set: { on in Task { await choose(kind, on) } }
                            ))
                            .disabled(busy || !HealthKitReader.isAvailable)
                            .accessibilityIdentifier("share-\(kind.rawValue)")
                        }
                        Text("Read only: MedBrains never writes to Apple Health. Turning a kind off stops sharing it; readings already shared stay in your record.")
                            .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                        Button(busy ? "Sharing…" : "Share now") { Task { await share(sharing) } }
                            .buttonStyle(.carbonPrimary)
                            .disabled(busy || !HealthDataKind.allCases.contains { sharing.isShared($0, from: .healthkit) })
                            .accessibilityIdentifier("share-now")
                    }
                    .padding(.horizontal, 16)
                    .accessibilityElement(children: .contain)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Health data")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-health-data")
        .task { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.healthData() }
    }

    private func choose(_ kind: HealthDataKind, _ on: Bool) async {
        guard let portal else { return }
        busy = true
        defer { busy = false }
        do {
            if on { try await reader.requestAccess(to: kind) }
            let next = try await portal.setHealthConsent(kind: kind, granted: on)
            await remote.load { next }
        } catch {
            outcome = (.error, "Not changed", "Your choice for \(kind.label.lowercased()) wasn't saved. Try again.")
        }
    }

    private func share(_ sharing: HealthDataSharing) async {
        guard let portal else { return }
        busy = true
        defer { busy = false }
        var accepted = 0, refused = 0
        do {
            for kind in HealthDataKind.allCases where sharing.isShared(kind, from: .healthkit) {
                let readings = try await reader.readings(kind)
                for batch in HealthShare.batches(readings) {
                    let result = try await portal.shareHealthReadings(batch)
                    accepted += result.accepted
                    refused += result.refused.count
                }
                if let last = readings.map(\.measuredAt).max() { await reader.markShared(kind, through: last) }
            }
            outcome = (.success, "Shared", accepted == 0 ? "Nothing new to share." : "\(accepted) new reading\(accepted == 1 ? "" : "s") shared\(refused > 0 ? "; \(refused) could not be taken" : "").")
        } catch {
            outcome = (.error, "Not shared", "The readings couldn't be sent. Nothing was lost; try again.")
        }
    }
}
