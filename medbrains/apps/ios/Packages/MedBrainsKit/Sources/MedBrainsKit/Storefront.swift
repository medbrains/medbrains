import Foundation

/// The hospital pharmacy's storefront as the patient app applies it: what can
/// go in a cart, which prescription an order rides on, how statuses read. The
/// same rules as the web (`apps/web/src/pages/store/storefront.ts`) and
/// Android; the server decides, this only shapes what is shown and sent.
public enum Storefront {
    public static let counterOnly = "counter_only"
    public static let stockLabels: [String: String] = ["available": "In stock", "low": "Few left", "out": "Out of stock"]
    public static let orderStatusLabels: [String: String] = [
        "awaiting_verification": "With the pharmacist",
        "released": "Being prepared",
        "rejected": "Not approved",
        "cancelled": "Cancelled",
    ]
    public static let rejectReasonLabels: [String: String] = [
        "expired": "Prescription expired",
        "illegible": "Can't be read",
        "not_on_prescription": "Not on the prescription",
        "quantity_exceeds_prescription": "More than prescribed",
        "needs_consultation": "Needs a consultation",
        "other": "Other",
    ]

    public static func label(_ map: [String: String], _ key: String) -> String {
        map[key] ?? key.replacingOccurrences(of: "_", with: " ")
    }

    /// Whether a signed-in patient can put this in the cart now.
    public static func canAdd(onSale: Bool, saleClass: String, price: String?, stock: String) -> Bool {
        onSale && saleClass != counterOnly && price != nil && stock != "out"
    }

    /// A quantity within 1 and the item's limit.
    public static func clamp(_ n: Int, max: Int) -> Int { Swift.min(Swift.max(n, 1), Swift.max(max, 1)) }

    /// A prescription an order may ride on: not expired `today` (yyyy-MM-dd).
    public static func usable(validUntil: String?, today: String) -> Bool { validUntil.map { $0 >= today } ?? true }

    /// How a shared mobile's people are told apart.
    public static func personLabel(name: String, birthYear: Int?) -> String {
        birthYear.map { "\(name) (born \($0))" } ?? name
    }

    /// The checkout's prescription, or why it can't be placed yet.
    public enum Checkout: Equatable, Sendable {
        case ready(source: String, prescriptionId: String?)
        case problem(String)
    }

    /// Nothing needing a prescription goes without one; otherwise the
    /// hospital prescription picked wins over an upload.
    public static func checkout(lines: Int, allOnSale: Bool, prescriptionNeeded: Bool, hospitalId: String?, uploaded: Bool) -> Checkout {
        if lines == 0 { return .problem("Your cart is empty") }
        if !allOnSale { return .problem("Take out what can't be ordered online") }
        if !prescriptionNeeded { return .ready(source: "none", prescriptionId: nil) }
        if let hospitalId { return .ready(source: "hospital", prescriptionId: hospitalId) }
        if uploaded { return .ready(source: "upload", prescriptionId: nil) }
        return .problem("Choose one of your prescriptions, or upload one")
    }
}
