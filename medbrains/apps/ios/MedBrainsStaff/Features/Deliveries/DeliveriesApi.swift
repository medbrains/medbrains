import Foundation
import MedBrainsKit

// Wire shapes mirror crates/medbrains-pharmacy-delivery. Money arrives as
// decimal strings ("40.00"); keep them as strings and show them as written.

struct Delivery: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let orderId: String
    let patientId: String
    let mode: String
    let address: String
    let landmark: String?
    let pincode: String?
    let contactPhone: String
    let payment: String
    let amountDue: String
    let status: String
    let failureReason: String?

    var isCashOnDelivery: Bool { payment == "cash_on_delivery" }
    /// "12 Lake Road · Near the temple · 630001"
    var addressLine: String { [address, landmark, pincode].compactMap { $0 }.joined(separator: " · ") }
}

/// The patient as the list may name them, masked per the runner's field access.
struct DeliveryPatient: Codable, Hashable, Sendable {
    let id: String
    let uhid: String
    let fullName: String
}

struct DeliveryList: Decodable, Sendable {
    let deliveries: [Delivery]
    let patients: [DeliveryPatient]
}

/// The statuses a runner works with.
enum DeliveryStatus {
    static let out = "out_for_delivery"
    static let delivered = "delivered"
}

private struct Handover: Encodable { let code: String; let cashCollected: Double? }
private struct NotDelivered: Encodable { let reason: String }

struct DeliveriesApi: Sendable {
    let client: ApiClient

    /// A runner is sent only their own deliveries; the server decides that.
    func list(status: String) async throws -> DeliveryList {
        try await client.request(.get, "/api/pharmacy/deliveries?status=\(status)")
    }

    /// Handed over against the patient's code, with the cash taken for cash on delivery.
    func complete(_ id: String, code: String, cash: Double?) async throws -> Delivery {
        try await client.request(.post, "/api/pharmacy/deliveries/\(id)/complete", body: Handover(code: code, cashCollected: cash))
    }

    func fail(_ id: String, reason: String) async throws -> Delivery {
        try await client.request(.post, "/api/pharmacy/deliveries/\(id)/fail", body: NotDelivered(reason: reason))
    }
}
