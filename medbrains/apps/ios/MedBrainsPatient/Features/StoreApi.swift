import Foundation
import MedBrainsKit

// The hospital pharmacy's storefront, as the server sends it
// (crates/medbrains-pharmacy/src/storefront). Stock is a word, never a count.

struct StoreItem: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let inn: String?
    let pack: String?
    let schedule: String?
    let saleClass: String
    let prescriptionNeeded: Bool
    let note: String?
    let pickupOnly: Bool
    let stock: String
    let mrp: String?
    let price: String?
    let maxQuantity: Int
    let onSale: Bool
}

struct StoreSearchResult: Decodable, Sendable {
    let items: [StoreItem]
}

struct StoreCartLine: Decodable, Identifiable, Sendable {
    let item: StoreItem
    let quantity: Int
    let fromPrescription: Bool
    let lineTotal: String?
    var id: String { item.id }
}

struct StoreCart: Decodable, Sendable {
    let lines: [StoreCartLine]
    let total: String
    let prescriptionNeeded: Bool
    let prescriptionUploaded: Bool
}

struct StoreOrderLine: Decodable, Sendable {
    let catalogItemId: String
    let drugName: String
    let quantity: Int
    let status: String
    let approvedQuantity: Int?
    let rejectReason: String?
}

struct StoreOrder: Decodable, Identifiable, Sendable {
    let id: String
    let status: String
    let fulfilment: String
    let placedAt: String?
    let decisionNote: String?
    let lines: [StoreOrderLine]
    let total: String
}

struct StoreLeftOut: Decodable, Sendable {
    let drugName: String
    let reason: String
}

struct StoreOrderedPrescription: Decodable, Sendable {
    let prescriptionId: String
    let cart: StoreCart
    let leftOut: [StoreLeftOut]
}

private struct SetQuantity: Encodable { let quantity: Int }
private struct RxUpload: Encodable { let dataBase64: String }
private struct CheckoutAsk: Encodable {
    let prescriptionSource: String
    let prescriptionId: String?
    let delivery: HomeDelivery.Choice?
}

extension PortalApi {
    /// What the pharmacy sells online, by brand or generic name.
    func searchStore(tenantCode: String, q: String) async throws -> StoreSearchResult {
        let query = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return try await client.request(.get, "/api/store/\(tenantCode)/items?q=\(query)")
    }
    func cart() async throws -> StoreCart { try await client.request(.get, "/api/portal/store/cart") }
    /// 0 takes it out.
    func setQuantity(itemId: String, quantity: Int) async throws -> StoreCart {
        try await client.request(.put, "/api/portal/store/cart/items/\(itemId)", body: SetQuantity(quantity: quantity))
    }
    /// A photo of the prescription, JPEG.
    func uploadPrescription(jpeg: Data) async throws -> StoreCart {
        try await client.request(.put, "/api/portal/store/cart/prescription", body: RxUpload(dataBase64: jpeg.base64EncodedString()))
    }
    func storeDeliveryOptions() async throws -> PortalDeliveryOffer { try await client.request(.get, "/api/portal/store/delivery-options") }
    func checkout(source: String, prescriptionId: String?, delivery: HomeDelivery.Choice?) async throws -> StoreOrder {
        try await client.request(.post, "/api/portal/store/checkout", body: CheckoutAsk(prescriptionSource: source, prescriptionId: prescriptionId, delivery: delivery))
    }
    func storeOrders() async throws -> [StoreOrder] { try await client.request(.get, "/api/portal/store/orders") }
    /// "Order my prescription": the cart filled from one of the patient's prescriptions.
    func orderPrescription(_ prescriptionId: String) async throws -> StoreOrderedPrescription {
        try await client.request(.post, "/api/portal/store/prescriptions/\(prescriptionId)/order", body: Empty())
    }
}
