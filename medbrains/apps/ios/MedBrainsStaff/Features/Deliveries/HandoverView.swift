import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The digits in a patient's delivery code.
private let codeLength = 6

/// At the door: the patient reads out the code they were texted, and the
/// medicines are handed over against it — with the cash taken, for cash on
/// delivery. Or it wasn't delivered, and the runner says why.
struct HandoverView: View {
    let delivery: Delivery
    let patient: DeliveryPatient?
    let onDone: () -> Void
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var cash = ""
    @State private var reason = ""
    @State private var working = false
    @State private var failure: String?
    @FocusState private var focus: Field?

    private enum Field { case code, cash, reason }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: patient?.uhid ?? "Delivery", title: patient?.fullName ?? "Patient", subtitle: delivery.addressLine)
                HStack(spacing: 12) {
                    if let phone = URL(string: "tel:\(delivery.contactPhone)") {
                        Link("Call \(delivery.contactPhone)", destination: phone).buttonStyle(CarbonGhostButtonStyle())
                    }
                    if let maps = directions {
                        Link("Directions", destination: maps).buttonStyle(CarbonGhostButtonStyle())
                    }
                }
                .padding(.horizontal, 16)
                if let failure {
                    CarbonNotification(kind: .error, title: "Not recorded", message: failure)
                        .padding(.horizontal, 16)
                        .accessibilityIdentifier("handover-error")
                }
                VStack(alignment: .leading, spacing: 16) {
                    CarbonField("Patient's code", helper: "The six digits in the patient's text.", isFocused: focus == .code) {
                        TextField("Code", text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .focused($focus, equals: .code)
                            .accessibilityIdentifier("handover-code")
                    }
                    if delivery.isCashOnDelivery {
                        CarbonField("Cash taken (₹\(delivery.amountDue) due)", helper: "Hand the cash to the pharmacy counter.", isFocused: focus == .cash) {
                            TextField("Amount", text: $cash)
                                .keyboardType(.decimalPad)
                                .focused($focus, equals: .cash)
                                .accessibilityIdentifier("handover-cash")
                        }
                    }
                    Button(working ? "Recording…" : "Delivered") { Task { await handOver() } }
                        .buttonStyle(CarbonPrimaryButtonStyle())
                        .disabled(working || code.count != codeLength || (delivery.isCashOnDelivery && Double(cash) == nil))
                        .accessibilityIdentifier("handover-delivered")
                    CarbonSectionTitle("Couldn't deliver")
                    CarbonField("What happened", isFocused: focus == .reason) {
                        TextField("Nobody home, refused, wrong address…", text: $reason, axis: .vertical)
                            .focused($focus, equals: .reason)
                            .accessibilityIdentifier("handover-reason")
                    }
                    Button("Not delivered") { Task { await notDelivered() } }
                        .buttonStyle(CarbonDangerButtonStyle())
                        .disabled(working || reason.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("handover-not-delivered")
                }
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 24)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Hand over")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-handover")
        .onAppear { if delivery.isCashOnDelivery { cash = delivery.amountDue } }
    }

    private var directions: URL? {
        var parts = URLComponents(string: "https://maps.apple.com/")
        parts?.queryItems = [URLQueryItem(name: "daddr", value: delivery.addressLine)]
        return parts?.url
    }

    private func handOver() async {
        await record { api in _ = try await api.complete(delivery.id, code: code, cash: delivery.isCashOnDelivery ? Double(cash) : nil) }
    }

    private func notDelivered() async {
        await record { api in _ = try await api.fail(delivery.id, reason: reason.trimmingCharacters(in: .whitespaces)) }
    }

    private func record(_ op: (DeliveriesApi) async throws -> Void) async {
        guard let client else { return }
        working = true
        defer { working = false }
        do {
            try await op(DeliveriesApi(client: client))
            onDone()
            dismiss()
        } catch {
            failure = error.localizedDescription
        }
    }
}
