import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The address picker's value for "somewhere else".
private let newAddress = "new"
/// How many deliveries the section lists; the server sends at most this.
private let deliveryLimit = 20

/// How each stage is marked; the words come from `HomeDelivery`.
private let stageTones: [String: CarbonTone] = [
    "requested": .info, "awaiting_payment": .warning, "being_prepared": .info,
    "out_for_delivery": .warning, "delivered": .success, "failed": .danger,
    "cancelled": .neutral, "declined": .neutral, "not_deliverable": .warning,
]

/// Asking for a refill: collect it, or have it brought home. Delivery offers
/// only what the server allows this patient, and says why when it won't.
struct RefillChoiceSheet: View {
    let row: PortalRefill
    /// Nil when it was requested; otherwise why not.
    let send: (HomeDelivery.Choice?) async -> String?
    @Environment(\.portalApi) private var portal
    @Environment(\.dismiss) private var dismiss
    @State private var offer: PortalDeliveryOffer?
    @State private var offerFailed = false
    @State private var fulfilment = "pickup"
    @State private var addressKey: String?
    @State private var typedAddress = ""
    @State private var pincode = ""
    @State private var landmark = ""
    @State private var phone = ""
    @State private var slot: String?
    @State private var payment: String?
    @State private var sending = false
    @State private var refused: String?

    private var delivering: Bool { fulfilment == "delivery" && offer?.available == true }
    private var saved: PortalSavedAddress? {
        guard let addressKey, addressKey != newAddress, let i = Int(addressKey) else { return nil }
        return offer?.addresses[safe: i]
    }
    private var address: String { saved?.address ?? typedAddress }
    private var problem: String? {
        delivering ? HomeDelivery.problem(address: address, phone: phone, payment: payment, offered: offer?.payments ?? []) : nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Text(row.message)
                if offerFailed {
                    Text("We couldn't check home delivery. You can still collect it at the pharmacy.").accessibilityIdentifier("delivery-unchecked")
                }
                if let offer, !offer.available, let reason = offer.reason {
                    Text("Home delivery isn't available for this: \(reason)").accessibilityIdentifier("delivery-reason")
                }
                if offer?.available == true {
                    Picker("How you'll get it", selection: $fulfilment) {
                        Text("Collect").tag("pickup")
                        Text("Home delivery").tag("delivery")
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("refill-fulfilment")
                }
                if delivering, let offer { deliveryFields(offer) }
                if let problem { Text(problem).foregroundStyle(MedBrainsTheme.danger).accessibilityIdentifier("delivery-problem") }
                if let refused {
                    CarbonNotification(kind: .error, title: "Refill not requested", message: refused).accessibilityIdentifier("refill-refused")
                }
            }
            .navigationTitle("Request refill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Request") { Task { await submit() } }
                        .disabled(sending || problem != nil)
                        .accessibilityIdentifier("refill-send")
                }
            }
            .task { await loadOffer() }
        }
    }

    @ViewBuilder private func deliveryFields(_ offer: PortalDeliveryOffer) -> some View {
        let places = offer.addresses.enumerated().map { CarbonPicker<String>.Option(id: String($0.offset), label: "\($0.element.label): \($0.element.address)") }
            + [.init(id: newAddress, label: "Somewhere else")]
        CarbonPicker("Deliver to", options: places, selection: $addressKey).accessibilityIdentifier("delivery-address")
        if addressKey == newAddress {
            TextField("Address", text: $typedAddress, axis: .vertical).textContentType(.fullStreetAddress).accessibilityIdentifier("delivery-new-address")
            TextField("PIN code", text: $pincode).keyboardType(.numberPad).textContentType(.postalCode)
        }
        TextField("Landmark (optional)", text: $landmark)
        TextField("Phone for the delivery", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber).accessibilityIdentifier("delivery-phone")
        CarbonPicker("Preferred time (optional)", options: offer.slots.map { .init(id: $0, label: HomeDelivery.slotLabels[$0] ?? $0) }, selection: $slot, placeholder: "Any time")
        Picker("How you'll pay", selection: $payment) {
            ForEach(offer.payments, id: \.self) { Text(HomeDelivery.paymentLabels[$0] ?? $0).tag(Optional($0)) }
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("delivery-payment")
        Text(payment == HomeDelivery.payNow
             ? "Once the pharmacist approves it, a payment link appears under Deliveries. It goes out once paid."
             : "Pay when it arrives.")
            .font(CarbonType.helper)
    }

    private func loadOffer() async {
        guard let portal, offer == nil else { return }
        do {
            let loaded = try await portal.deliveryOptions(prescriptionId: row.prescriptionId)
            offer = loaded
            addressKey = loaded.addresses.isEmpty ? newAddress : "0"
            phone = loaded.contactPhone
            payment = loaded.payments.first
        } catch {
            offerFailed = true
        }
    }

    private func submit() async {
        sending = true
        defer { sending = false }
        let choice = delivering
            ? HomeDelivery.choice(address: address, landmark: landmark, pincode: saved?.pincode ?? pincode, phone: phone, slot: slot, payment: payment ?? "")
            : nil
        refused = await send(choice)
        if refused == nil { dismiss() }
    }
}

/// The patient's deliveries: where each is, when it moved, who is bringing
/// it, the code for the runner, and the link to pay while one is owed.
struct DeliveriesSection: View {
    /// Bumped when a refill is requested, so a new delivery shows at once.
    let refresh: Int
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<[PortalDelivery]>()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CarbonSectionTitle("Deliveries")
            RemoteContentView(id: "deliveries", state: remote.state, unavailableTitle: "Couldn't load your deliveries", unavailableMessage: "Try again in a moment.", isEmpty: \.isEmpty, emptyTitle: "No deliveries", emptyMessage: "Medicines you ask to have delivered appear here.", retry: { Task { await load() } }) { rows in
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(rows.prefix(deliveryLimit)) { DeliveryRow(d: $0) }
                }
                .accessibilityElement(children: .contain)
            }
        }
        .task(id: refresh) { await load() }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.deliveries() }
    }
}

private struct DeliveryRow: View {
    let d: PortalDelivery

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(d.drugs.isEmpty ? "Your medicines" : d.drugs.joined(separator: ", ")).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
            CarbonTag(HomeDelivery.stageLabel(d.stage), tone: stageTones[d.stage] ?? .neutral).accessibilityIdentifier("delivery-stage-\(d.id)")
            if let address = d.address { Text(address).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary) }
            ForEach(HomeDelivery.steps(requestedAt: d.requestedAt, preparedAt: d.preparedAt, dispatchedAt: d.dispatchedAt, deliveredAt: d.deliveredAt), id: \.label) { step in
                Text("\(step.label): \(ServerTime.short(step.at))").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            }
            if let carrier = d.carrier { Text("Bringing it: \(carrier)\(d.trackingRef.map { " · tracking \($0)" } ?? "")").font(CarbonType.body) }
            if let note = d.note { Text(note).font(CarbonType.body) }
            if let due = d.amountDue, d.stage != "delivered" { Text("To pay when it arrives: ₹\(due)").font(CarbonType.body) }
            if let code = d.handoverCode {
                Eyebrow("Give this code to the person delivering")
                Text(code).font(CarbonType.display).monospaced().accessibilityIdentifier("delivery-code")
            }
            if d.stage == "awaiting_payment" {
                if let link = d.paymentUrl.flatMap(URL.init(string:)) {
                    Link("Pay ₹\(d.payAmount ?? "") now", destination: link).buttonStyle(CarbonPrimaryButtonStyle()).accessibilityIdentifier("delivery-pay")
                } else {
                    Text("Your payment link is being made. Check back in a minute.").font(CarbonType.helper)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("delivery-\(d.id)")
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
