import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// How often the runner's list refreshes while open, in seconds.
private let refreshSeconds: Double = 30

/// A runner's deliveries: what is out with them now, and what they have
/// handed over. The server sends a runner only their own.
struct DeliveriesHomeView: View {
    @Environment(\.apiClient) private var client
    @State private var status = DeliveryStatus.out
    @State private var remote = Remote<DeliveryList>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Deliveries", title: "My deliveries", subtitle: "Hand medicines over only against the patient's code.")
                Picker("Show", selection: $status) {
                    Text("Out with me").tag(DeliveryStatus.out)
                    Text("Delivered").tag(DeliveryStatus.delivered)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
                .accessibilityIdentifier("delivery-filter")
                RemoteContentView(
                    id: "deliveries",
                    state: remote.state,
                    unavailableTitle: "Couldn't load your deliveries",
                    unavailableMessage: "This is not an empty list. Try again in a moment.",
                    isEmpty: { $0.deliveries.isEmpty },
                    emptyTitle: status == DeliveryStatus.out ? "Nothing out with you" : "Nothing delivered yet",
                    emptyMessage: "Deliveries the pharmacy gives you appear here.",
                    retry: { Task { await load() } }
                ) { list in
                    let names = Dictionary(list.patients.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
                    LazyVStack(spacing: 0) {
                        ForEach(list.deliveries) { delivery in
                            let patient = names[delivery.patientId]
                            NavigationLink(value: delivery) {
                                CarbonRow(patient?.fullName ?? "Patient", detail: delivery.addressLine) {
                                    if delivery.isCashOnDelivery { CarbonTag("₹\(delivery.amountDue) cash", tone: .warning) }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("delivery-\(delivery.id)")
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationDestination(for: Delivery.self) { delivery in
            HandoverView(delivery: delivery, patient: remote.value?.patients.first { $0.id == delivery.patientId }) {
                Task { await load() }
            }
        }
        .accessibilityIdentifier("screen-deliveries")
        .task(id: status) {
            guard let client else { return }
            await remote.poll(every: refreshSeconds) { try await DeliveriesApi(client: client).list(status: status) }
        }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await DeliveriesApi(client: client).list(status: status) }
    }
}
