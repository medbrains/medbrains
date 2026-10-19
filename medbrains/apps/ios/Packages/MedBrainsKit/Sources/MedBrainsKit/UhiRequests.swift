import Foundation

/// UHI requests: what patient apps booked or asked for through NHA's Unified
/// Health Interface. Consultations are booked straight into the day's
/// appointments; ambulance, blood and lab requests wait for someone to say
/// whether the hospital can help. Wire shape mirrors `packages/types/src/uhi.ts`;
/// the words and gates mirror `apps/web/src/pages/uhi-requests.tsx`.
public enum UhiRequests {
    public enum Permission {
        public static let view = "uhi.requests.view"
        public static let respond = "uhi.requests.respond"
        public static let dispatchAmbulance = "ambulance.trips.create"
        public static let issueBlood = "blood_bank.inventory.manage"
        public static let orderLab = "lab.orders.direct"
        public static let bookCollection = "lab.samples.manage"
    }

    public enum Service {
        public static let teleconsultation = "teleconsultation"
        public static let visit = "physical_consultation"
        public static let labTests = "lab_tests"
        public static let ambulance = "ambulance"
        public static let bloodBank = "blood_bank"
    }

    public static let pending = "pending"
    public static let awaitingPayment = "awaiting_payment"
    static let paid = "PAID"
    static let paidOnline = "ON-ORDER"
    /// States in which a booking no longer stands: money taken is a refund due.
    static let letGo: Set<String> = ["cancelled", "expired", "declined"]

    public struct Request: Decodable, Identifiable, Equatable, Sendable {
        public let id: String
        public let service: String
        public let state: String
        public let customerName: String?
        public let customerPhone: String?
        public let customerAbha: String?
        /// What was asked for, in a line: the doctor and time, the blood, the pickup.
        public let summary: String
        public let appointmentId: String?
        public let ambulanceTripId: String?
        public let declineReason: String?
        public let confirmedAt: String?
        public let respondedAt: String?
        public let updatedAt: String
        public let paymentType: String?
        public let paymentStatus: String?
        public let amount: String?
        /// A held booking lets go of its slot at this time unless paid.
        public let holdExpiresAt: String?
        public let labOrderIds: [String]
        /// A lab request for a home collection (accepting it books one).
        public let homeCollection: Bool
    }

    public enum Filter: String, CaseIterable, Sendable {
        case waiting, all
        public var label: String { self == .waiting ? "Waiting for us" : "All" }
    }

    public struct Label: Equatable, Sendable {
        public let text: String
        public let tone: Tone
    }

    public static let serviceLabels: [String: String] = [
        Service.teleconsultation: "Teleconsultation",
        Service.visit: "Visit",
        Service.labTests: "Lab tests",
        Service.ambulance: "Ambulance",
        Service.bloodBank: "Blood",
    ]

    public static let states: [String: Label] = [
        awaitingPayment: Label(text: "Held — waiting for payment", tone: .warning),
        pending: Label(text: "Waiting for us", tone: .warning),
        "confirmed": Label(text: "Confirmed", tone: .success),
        "declined": Label(text: "Declined", tone: .danger),
        "cancelled": Label(text: "Cancelled by patient", tone: .neutral),
        "expired": Label(text: "Not paid in time", tone: .neutral),
    ]

    static let acceptLabels: [String: String] = [
        Service.ambulance: "Accept and dispatch",
        Service.labTests: "Accept and order the tests",
    ]

    public static func serviceLabel(_ service: String) -> String { serviceLabels[service] ?? service }
    public static func state(_ state: String) -> Label { states[state] ?? Label(text: state, tone: .neutral) }
    public static func acceptLabel(_ service: String) -> String { acceptLabels[service] ?? "Accept" }

    /// Consultations land in the OPD appointments for their day.
    public static func isInAppointments(_ r: Request) -> Bool {
        (r.service == Service.teleconsultation || r.service == Service.visit) && r.appointmentId != nil
    }

    /// Whether this person may accept or decline: the queue's own permission,
    /// the request still waiting, and each service's module permission as
    /// well — the server checks the same. Consultations are never answered here.
    public static func mayAnswer(_ r: Request, _ who: TenantIdentity?) -> Bool {
        guard let who, who.can(Permission.respond), r.state == pending else { return false }
        switch r.service {
        case Service.ambulance: return who.can(Permission.dispatchAmbulance)
        case Service.bloodBank: return who.can(Permission.issueBlood)
        case Service.labTests: return who.can(Permission.orderLab) && (!r.homeCollection || who.can(Permission.bookCollection))
        default: return false
        }
    }

    /// How a booking is paid, in words: money taken for a booking that no
    /// longer stands is a refund the desk must make. Nil when not paid through UHI.
    public static func payment(_ r: Request) -> Label? {
        guard let type = r.paymentType else { return nil }
        let isPaid = r.paymentStatus == paid
        if isPaid, letGo.contains(r.state) { return Label(text: "Paid — refund due", tone: .danger) }
        if isPaid { return Label(text: "Paid online", tone: .success) }
        return type == paidOnline ? Label(text: "Not paid yet", tone: .warning) : Label(text: "Pay at the hospital", tone: .neutral)
    }

    public static func amountLine(_ r: Request) -> String {
        r.amount.map { "₹\($0)" } ?? "Fee set at the hospital"
    }

    /// The trimmed reason, or nil when there is none worth sending.
    public static func declineReason(_ text: String) -> String? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}

/// The UHI queue calls, one per route the screen uses.
public struct UhiRequestsApi: Sendable {
    let client: ApiClient

    public init(client: ApiClient) { self.client = client }

    private struct DeclineBody: Encodable { let reason: String }

    /// Bounded by the server (its newest page).
    public func list(_ filter: UhiRequests.Filter) async throws -> [UhiRequests.Request] {
        try await client.request(.get, filter == .waiting ? "/api/uhi/requests?state=\(UhiRequests.pending)" : "/api/uhi/requests")
    }

    public func accept(_ id: String) async throws -> UhiRequests.Request {
        try await client.request(.post, "/api/uhi/requests/\(id)/accept", body: Empty())
    }

    public func decline(_ id: String, reason: String) async throws -> UhiRequests.Request {
        try await client.request(.post, "/api/uhi/requests/\(id)/decline", body: DeclineBody(reason: reason))
    }
}
