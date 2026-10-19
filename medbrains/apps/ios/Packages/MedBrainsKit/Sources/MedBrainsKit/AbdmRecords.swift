import Foundation

/// Records from other hospitals (ABDM Milestone 3, this hospital as a Health
/// Information User): consent requests raised for a patient and the copies
/// other facilities sent under them. The wire shapes mirror
/// `packages/types/src/abdm-hiu.ts`; the words and rules mirror the web's
/// `components/Patient/abdm/abdmStatus.ts` and `ConsentRequestModal.tsx`.
public enum AbdmRecords {
    public enum Permission {
        /// See the requests and the records received.
        public static let view = "abdm.consent.view"
        /// Raise a request, and ask ABDM where one stands.
        public static let request = "abdm.consent.request"
    }

    public struct ConsentRequest: Decodable, Identifiable, Equatable, Sendable {
        public let id: String
        public let purposeCode: String
        public let hiTypes: [String]
        public let dateFrom: String
        public let dateTo: String
        public let dataEraseAt: String
        public let status: String
        public let error: String?
        public let requesterName: String
        public let requestedAt: String
        public let statusAt: String
        /// When ABDM was last asked where the request stands; nil if never.
        public let statusCheckedAt: String?
        public let recordsReceived: Int
        /// Copies still held — zero once the consent is revoked or expires.
        public let recordsHeld: Int
    }

    public struct ReceivedRecordItem: Decodable, Identifiable, Equatable, Sendable {
        public let id: String
        public let consentRequestId: String
        public let hiType: String?
        public let careContextReference: String
        public let sourceHipId: String
        public let sourceHipName: String?
        public let recordDate: String?
        public let title: String?
        public let receivedAt: String
        public let eraseAt: String
    }

    public struct PatientView: Decodable, Equatable, Sendable {
        public let configured: Bool
        /// Why records cannot be requested, in words for staff.
        public let blockedReason: String?
        public let requests: [ConsentRequest]
        public let records: [ReceivedRecordItem]
    }

    public struct ReceivedRecord: Decodable, Sendable {
        public let id: String
        public let patientId: String
        public let hiType: String?
        public let sourceHipId: String
        public let sourceHipName: String?
        public let receivedAt: String
        public let eraseAt: String
        /// The FHIR document bundle as the other facility sent it.
        public let bundle: JSONValue
    }

    /// What `POST …/consent-requests` takes.
    public struct NewRequest: Encodable, Equatable, Sendable {
        public let purposeCode: String
        public let hiTypes: [String]
        public let dateFrom: String
        public let dateTo: String
        /// When the received copies must be erased (ABDM's `dataEraseAt`).
        public let dataEraseAt: String
    }

    public struct Status: Equatable, Sendable {
        public let label: String
        public let tone: Tone
        public let hint: String
    }

    // MARK: words

    public static let awaitingPatient = "awaiting_patient"
    /// ABDM refused the request outright.
    public static let failed = "failed"
    public static let defaultPurpose = "CAREMGT"

    /// ABDM's consent purposes, in the order the form offers them.
    public static let purposes: [(code: String, label: String)] = [
        ("CAREMGT", "Care management"),
        ("BTG", "Break the glass (emergency)"),
        ("PUBHLTH", "Public health"),
        ("HPAYMT", "Healthcare payment"),
        ("DSRCH", "Disease-specific research"),
        ("PATRQT", "Requested by the patient"),
    ]

    /// ABDM's HI types in words staff use.
    public static let hiTypes: [(code: String, label: String)] = [
        ("OPConsultation", "OP consultation"),
        ("Prescription", "Prescription"),
        ("DiagnosticReport", "Diagnostic report"),
        ("DischargeSummary", "Discharge summary"),
        ("ImmunizationRecord", "Immunisation"),
        ("HealthDocumentRecord", "Health document"),
        ("WellnessRecord", "Wellness record"),
        ("Invoice", "Invoice"),
    ]
    public static let defaultHiTypes: Set<String> = ["OPConsultation", "Prescription", "DiagnosticReport", "DischargeSummary"]

    /// How long the copies may be kept, in days.
    public static let keepOptions: [(days: Int, label: String)] = [(7, "7 days"), (30, "30 days"), (90, "90 days"), (365, "1 year")]
    public static let defaultKeepDays = 30
    /// How far back the form starts by default.
    public static let defaultYearsBack = 5

    public static let statuses: [String: Status] = [
        "requested": Status(label: "Sent to ABDM", tone: .info, hint: "Waiting for ABDM to accept it."),
        awaitingPatient: Status(label: "Waiting for the patient", tone: .info, hint: "The patient approves or declines it in their ABHA app."),
        "granted": Status(label: "Granted", tone: .success, hint: "Records appear as each hospital sends them."),
        "denied": Status(label: "Denied", tone: .danger, hint: "The patient declined. Nothing was shared."),
        "revoked": Status(label: "Revoked", tone: .warning, hint: "The patient withdrew consent. The records received were erased."),
        "expired": Status(label: "Expired", tone: .neutral, hint: "The consent ended. The records received were erased."),
        failed: Status(label: "Not sent", tone: .danger, hint: "ABDM did not accept the request."),
    ]

    public static func status(_ code: String) -> Status {
        statuses[code] ?? Status(label: code.replacingOccurrences(of: "_", with: " "), tone: .neutral, hint: "")
    }

    public static func purposeLabel(_ code: String) -> String {
        purposes.first { $0.code == code }?.label ?? code
    }

    public static func hiTypeLabel(_ code: String?) -> String {
        guard let code else { return "Record" }
        return hiTypes.first { $0.code == code }?.label ?? code
    }

    // MARK: rules

    /// Only a request still waiting for the patient can be asked about again.
    public static func isCheckable(_ r: ConsentRequest) -> Bool { r.status == awaitingPatient }

    /// A request may be raised only by someone who holds the permission, for a
    /// patient the server says can be asked about.
    public static func canRaise(_ view: PatientView, holdsRequest: Bool) -> Bool {
        holdsRequest && view.blockedReason == nil
    }

    /// Copies a revoked or expired consent took with it: received, no longer held.
    public static func erased(_ r: ConsentRequest) -> Int {
        max(0, r.recordsReceived - r.recordsHeld)
    }

    public struct FacilityGroup: Identifiable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let records: [ReceivedRecordItem]
    }

    /// Received records grouped by the hospital that sent them, in the
    /// server's order (newest first within each).
    public static func byFacility(_ records: [ReceivedRecordItem]) -> [FacilityGroup] {
        var order: [String] = []
        var groups: [String: [ReceivedRecordItem]] = [:]
        for r in records {
            if groups[r.sourceHipId] == nil { order.append(r.sourceHipId) }
            groups[r.sourceHipId, default: []].append(r)
        }
        return order.map { id in
            let rows = groups[id] ?? []
            return FacilityGroup(id: id, name: rows.first?.sourceHipName ?? id, records: rows)
        }
    }

    /// The first thing wrong with a request, or nil when it can go.
    public static func problem(hiTypes: Set<String>, from: Date, to: Date, calendar: Calendar = .current) -> String? {
        if hiTypes.isEmpty { return "Choose at least one record type" }
        if calendar.startOfDay(for: from) > calendar.startOfDay(for: to) { return "The range ends before it starts" }
        return nil
    }

    /// The request as sent: whole days from the first to the last, and the
    /// copies erased `keepDays` from now.
    public static func newRequest(purpose: String, hiTypes: Set<String>, from: Date, to: Date, keepDays: Int, now: Date = Date(), calendar: Calendar = .current) -> NewRequest {
        let start = calendar.startOfDay(for: from)
        let end = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: to) ?? to
        let erase = now.addingTimeInterval(TimeInterval(keepDays) * 86_400)
        return NewRequest(
            purposeCode: purpose,
            hiTypes: hiTypes.sorted(),
            dateFrom: ServerTime.format(start),
            dateTo: ServerTime.format(end),
            dataEraseAt: ServerTime.format(erase)
        )
    }
}

/// The ABDM records calls, one per route the screens use.
public struct AbdmRecordsApi: Sendable {
    let client: ApiClient

    public init(client: ApiClient) { self.client = client }

    public func patientView(_ patientId: String) async throws -> AbdmRecords.PatientView {
        try await client.request(.get, "/api/abdm/patients/\(patientId)/received-records")
    }

    public func raise(_ patientId: String, _ body: AbdmRecords.NewRequest) async throws -> AbdmRecords.ConsentRequest {
        try await client.request(.post, "/api/abdm/patients/\(patientId)/consent-requests", body: body)
    }

    public func checkStatus(_ requestId: String) async throws -> AbdmRecords.ConsentRequest {
        try await client.request(.post, "/api/abdm/consent-requests/\(requestId)/check-status", body: Empty())
    }

    /// 404 once the consent ended or the erase date passed: the copy is gone.
    public func record(_ id: String) async throws -> AbdmRecords.ReceivedRecord {
        try await client.request(.get, "/api/abdm/received-records/\(id)")
    }
}
