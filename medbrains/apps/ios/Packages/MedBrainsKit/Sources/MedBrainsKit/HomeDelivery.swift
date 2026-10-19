import Foundation

/// A patient's pickup-or-delivery choice for a refill, and how a delivery's
/// progress reads. The same rules as the web portal
/// (`apps/web/src/pages/portal/portal-delivery.ts`); the server decides what
/// is offered, this only checks and shapes what is sent.
public enum HomeDelivery {
    public static let payOnDelivery = "cash_on_delivery"
    public static let payNow = "prepaid"
    /// Digits in a phone number, as the server checks.
    public static let phoneDigits = 10...15
    /// The shortest address worth sending a runner to.
    public static let minAddressLength = 5

    public static let paymentLabels: [String: String] = [payOnDelivery: "Pay on delivery", payNow: "Pay now"]
    public static let slotLabels: [String: String] = ["morning": "Morning", "afternoon": "Afternoon", "evening": "Evening"]
    public static let stageLabels: [String: String] = [
        "requested": "Requested",
        "awaiting_payment": "Waiting for payment",
        "being_prepared": "Being prepared",
        "out_for_delivery": "Out for delivery",
        "delivered": "Delivered",
        "failed": "Not delivered",
        "cancelled": "Cancelled",
        "declined": "Declined by your doctor",
        "not_deliverable": "Collect at the pharmacy",
    ]

    public static func stageLabel(_ stage: String) -> String {
        stageLabels[stage] ?? stage.replacingOccurrences(of: "_", with: " ")
    }

    /// The home-delivery choice sent with a refill request.
    public struct Choice: Encodable, Equatable, Sendable {
        public let address: String
        public let landmark: String?
        public let pincode: String?
        public let contactPhone: String
        public let preferredSlot: String?
        public let payment: String
    }

    /// The first thing wrong with a delivery choice, or nil when it can go.
    public static func problem(address: String, phone: String, payment: String?, offered: [String]) -> String? {
        if address.trimmingCharacters(in: .whitespacesAndNewlines).count < minAddressLength { return "Enter the full address" }
        if !phoneDigits.contains(phone.filter(\.isNumber).count) { return "Enter a 10-digit phone number" }
        guard let payment, offered.contains(payment) else { return "Choose how to pay" }
        return nil
    }

    /// The choice as sent: trimmed, and blanks left out.
    public static func choice(address: String, landmark: String, pincode: String?, phone: String, slot: String?, payment: String) -> Choice {
        func text(_ s: String?) -> String? {
            let t = s?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return t.isEmpty ? nil : t
        }
        return Choice(
            address: text(address) ?? "",
            landmark: text(landmark),
            pincode: text(pincode),
            contactPhone: text(phone) ?? "",
            preferredSlot: text(slot),
            payment: payment
        )
    }

    public struct Step: Equatable, Sendable {
        public let label: String
        public let at: String
    }

    /// The steps a delivery has reached, with when, oldest first.
    public static func steps(requestedAt: String, preparedAt: String?, dispatchedAt: String?, deliveredAt: String?) -> [Step] {
        [("Requested", requestedAt), ("Being prepared", preparedAt), ("Out for delivery", dispatchedAt), ("Delivered", deliveredAt)]
            .compactMap { label, at in at.map { Step(label: label, at: $0) } }
    }
}
