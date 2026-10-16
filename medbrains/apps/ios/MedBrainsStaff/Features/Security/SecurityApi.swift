import Foundation
import MedBrainsKit

// Wire shapes mirror crates/medbrains-ancillary (pass_check, front_office)
// and crates/medbrains-security (incidents, tag alerts, band match).

/// The codes this module checks, named once.
enum SecurityPermission {
    static let verifyPass = "front_office.passes.verify"
    static let listPasses = "front_office.passes.list"
    static let listVisitors = "front_office.visitors.list"
    /// The desk that issues passes may also record entry and exit.
    static let recordVisits = ["front_office.passes.manage", "front_office.visitor_logs.record"]
    static let listIncidents = "security.incidents.list"
    static let createIncident = "security.incidents.create"
    static let updateIncident = "security.incidents.update"
    static let listTagAlerts = "security.patient_safety.list"
    static let resolveTagAlert = "security.patient_safety.manage"
    static let verifyBandMatch = "security.patient_safety.verify_match"
}

/// How often each list refreshes while on screen, in seconds.
enum SecurityRefresh {
    static let queue: Double = 30
    static let alarm: Double = 15
}

/// `GET /api/front-office/passes/scan`: the server's verdict, never the client's.
struct PassVerdict: Decodable, Sendable {
    let valid: Bool
    /// "revoked", "expired" or "not_yet_valid" when it does not let the holder in.
    let reason: String?
    let passNumber: String
    let visitorName: String
    let relationship: String?
    let category: String
    let idType: String?
    let idNumber: String?
    let photoUrl: String?
    let wardName: String?
    let bedNumber: String?
    let validUntil: String
    let revokedReason: String?

    /// The verdict in words, for the band at the top of the sheet.
    var headline: String {
        if valid { return "Let in" }
        switch reason {
        case "revoked": return "Do not let in — Revoked"
        case "expired": return "Do not let in — Expired"
        case "not_yet_valid": return "Do not let in — Not yet valid"
        default: return "Do not let in"
        }
    }
}

struct SecurityIncidentRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let incidentNumber: String
    let severity: String
    let status: String
    let category: String
    let locationDescription: String?
    let occurredAt: String
    let description: String

    var isOpen: Bool { status == "reported" || status == "investigating" }
    var categoryLabel: String { IncidentCategory.label(category) }
}

struct IncidentUpdateRow: Decodable, Identifiable, Sendable {
    let id: String
    let updateType: String
    let description: String
    let updatedByName: String?
    let createdAt: String
}

struct TagAlertRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let tagId: String
    let alertType: String
    let triggeredAt: String
    let locationDescription: String?

    /// "exit_zone" → "Exit zone": the event in words, never a code.
    var alertLabel: String { alertType.replacingOccurrences(of: "_", with: " ").capitalized(with: nil) }
}

struct BandMatchResult: Decodable, Sendable {
    let matched: Bool
}

/// The categories the web register offers, in the same words.
enum IncidentCategory {
    static let all: [(id: String, label: String)] = [
        ("theft", "Theft"), ("assault", "Assault"), ("trespass", "Trespass"),
        ("property_damage", "Property damage"), ("policy_violation", "Policy violation"),
        ("elopement", "Elopement"), ("other", "Other"),
    ]

    static func label(_ id: String) -> String { all.first { $0.id == id }?.label ?? id.replacingOccurrences(of: "_", with: " ") }
}

enum IncidentSeverity {
    static let all = ["low", "medium", "high", "critical"]
}

struct NewIncidentBody: Encodable {
    let category: String
    let severity: String
    let locationDescription: String?
    let description: String
    let personsInvolved: [String]?
}

private struct NoteBody: Encodable { let description: String }
private struct StatusBody: Encodable { let status: String }
private struct ResolveAlertBody: Encodable { let wasFalseAlarm: Bool; let resolutionNotes: String }
private struct BandMatchBody: Encodable { let infantTag: String; let motherBand: String; let purpose: String }

struct SecurityApi: Sendable {
    let client: ApiClient

    /// The pass number as the QR carries it; the server compares.
    func scan(_ code: String) async throws -> PassVerdict {
        try await client.request(.get, "/api/front-office/passes/scan?code=\(Self.query(code))")
    }

    /// Active passes, to find the id a scan does not return and to name who is inside.
    func activePasses() async throws -> [PassRow] { try await client.request(.get, "/api/front-office/passes?status=active") }

    /// Entries with no exit yet.
    func openVisits() async throws -> [VisitorLogRow] { try await client.request(.get, "/api/front-office/visitor-logs?active_only=true") }

    func incidents() async throws -> [SecurityIncidentRow] { try await client.request(.get, "/api/security/incidents") }
    func report(_ body: NewIncidentBody) async throws -> SecurityIncidentRow { try await client.request(.post, "/api/security/incidents", body: body) }
    func updates(_ id: String) async throws -> [IncidentUpdateRow] { try await client.request(.get, "/api/security/incidents/\(id)/updates") }
    func addUpdate(_ id: String, _ text: String) async throws -> IncidentUpdateRow {
        try await client.request(.post, "/api/security/incidents/\(id)/updates", body: NoteBody(description: text))
    }
    func resolveIncident(_ id: String) async throws -> SecurityIncidentRow {
        try await client.request(.put, "/api/security/incidents/\(id)", body: StatusBody(status: "resolved"))
    }

    func openTagAlerts() async throws -> [TagAlertRow] { try await client.request(.get, "/api/security/tag-alerts?is_resolved=false") }
    func resolveTagAlert(_ id: String, notes: String, falseAlarm: Bool) async throws -> TagAlertRow {
        try await client.request(.put, "/api/security/tag-alerts/\(id)/resolve", body: ResolveAlertBody(wasFalseAlarm: falseAlarm, resolutionNotes: notes))
    }

    /// Baby's band against mother's band; a mismatch answers 409 in the server's words.
    func verifyBandMatch(infant: String, mother: String) async throws -> BandMatchResult {
        try await client.request(.post, "/api/security/patient-tags/verify-match", body: BandMatchBody(infantTag: infant, motherBand: mother, purpose: "nursery_exit"))
    }

    private static let queryAllowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_.~"))
    private static func query(_ text: String) -> String { text.addingPercentEncoding(withAllowedCharacters: queryAllowed) ?? text }
}

/// A write that did not land, in words: a lost permission, the server's own
/// reason, or no connection — and in every case, that nothing was saved.
func securityWriteFailure(_ error: Error) -> String {
    guard let api = error as? ApiError else { return "Not saved — no connection. Nothing was recorded." }
    if api.status == 403 { return "You no longer have access to this — ask your administrator." }
    return api.message
}
