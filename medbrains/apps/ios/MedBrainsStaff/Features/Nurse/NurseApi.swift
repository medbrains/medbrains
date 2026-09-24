import Foundation
import MedBrainsKit

// Wire shapes mirror crates/medbrains-ipd, medbrains-nursing, medbrains-care-mgmt
// and medbrains-blood-bank, hand-written from packages/types per the RFC.
// Timestamps stay strings (the server writes fractional seconds); parse with
// `ServerTime` where arithmetic is needed.

struct AdmissionRow: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let encounterId: String
    let patientId: String
    let patientName: String
    let uhid: String
    var bedLabel: String?
    let wardName: String?
    /// Needed to ask who else is on duty when a dose wants a witness.
    let wardId: String?
    let status: String
    let admittedAt: String

    var bedLine: String { "UHID \(uhid)" + (bedLabel.map { " · BED \($0)" } ?? "") }
}

private struct AdmissionList: Decodable { let admissions: [AdmissionRow] }

struct MarRow: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let admissionId: String
    let drugName: String
    let dose: String
    let route: String
    let frequency: String?
    let scheduledAt: String
    let administeredAt: String?
    let status: String
    let isHighAlert: Bool
    let barcodeVerified: Bool
    let holdReason: String?
}

struct UpdateMarPayload: Encodable {
    var status: String
    var administeredAt: String?
    var witnessedBy: String?
    var holdReason: String?
    var refusedReason: String?
}

struct BarcodeVerifyResult: Decodable, Sendable {
    let verified: Bool
    let rightPatient: Bool
    let rightDrug: Bool
    let reason: String?
}

struct WardOnDutyRow: Decodable, Identifiable, Sendable {
    var id: String { nurseUserId }
    let nurseUserId: String
    let nurseName: String
    let shiftType: String
    let primaryAssigned: Bool
    let isCharge: Bool
    let patientCount: Int
}

struct ActiveNurseCall: Decodable, Identifiable, Sendable {
    let id: String
    let admissionId: String
    let wardId: String?
    let wardName: String?
    let bedNumber: String?
    let requestType: String
    let status: String
    let notes: String?
    let createdAt: String
    let acknowledgedAt: String?
    let waitingSeconds: Int
    let escalation: String
}

struct NurseCallBoard: Decodable, Sendable {
    let calls: [ActiveNurseCall]
    let escalateSecs: Int
    let supervisorSecs: Int
}

struct CodeBlueEvent: Decodable, Identifiable, Sendable {
    let id: String
    let patientId: String
    let location: String
    let startedAt: String
    let endedAt: String?
}

struct CodeBlueResponder: Decodable, Sendable {
    let codeBlueId: String
    let userId: String
    let userName: String
    let secondsAfterCall: Int
}

struct EmergencyCodeActivation: Decodable, Identifiable, Sendable {
    let id: String
    let codeType: String
    let activatedAt: String
    let deactivatedAt: String?
    let location: String?
}

struct HandoffAlert: Codable, Hashable, Sendable {
    let kind: String
    let note: String
}

struct ShiftHandoff: Decodable, Identifiable, Sendable {
    let id: String
    let encounterId: String
    let outgoingNurseId: String
    let incomingNurseId: String
    let incomingSignedAt: String?
    let situation: String?
    let background: String?
    let assessment: String?
    let recommendation: String?
    let alerts: [HandoffAlert]?
    let completedAt: String?
    let createdAt: String
}

struct CreateHandoffPayload: Encodable {
    let encounterId: String
    let incomingNurseId: String
    var situation: String?
    var background: String?
    var assessment: String?
    var recommendation: String?
}

struct BedsideTransfusion: Decodable, Identifiable, Sendable {
    let id: String
    let productType: String?
    let bagNumber: String?
    let bloodGroup: String?
    let rhFactor: String?
    let transfusionStartTime: String?
    let transfusionEndTime: String?
    let adverseReaction: Bool
}

struct TransfusionObservation: Decodable, Identifiable, Sendable {
    let id: String
    let phase: String
    let temperatureC: Double?
    let pulse: Int?
    let adverseSigns: Bool
    /// Server-computed, never sent: a client that could set it could record a febrile patient as unremarkable.
    let reactionSuspected: Bool
    let observedAt: String
}

struct RecordObservationPayload: Encodable {
    let phase: String
    var temperatureC: Double?
    var pulse: Int?
    var systolicBp: Int?
    var diastolicBp: Int?
    let adverseSigns: Bool
    var notes: String?
}

struct CreateVitalsPayload: Encodable {
    let encounterId: String
    var temperature: String?
    var pulse: Int?
    var systolicBp: Int?
    var diastolicBp: Int?
    var respiratoryRate: Int?
    var spo2: Int?
    var notes: String?
}

struct CreateIoEntryPayload: Encodable {
    let encounterId: String
    let category: String
    let direction: String
    let volumeMl: Int
    var notes: String?
}

struct IoBalance: Decodable, Sendable {
    let intakeTotal: Double
    let outputTotal: Double
    let balance: Double
}

struct CreatePainEntryPayload: Encodable {
    let encounterId: String
    let scale: String
    let score: Int
    var location: String?
    var character: String?
    var interventionTaken: String?
}

struct CreateFallRiskPayload: Encodable {
    let encounterId: String
    let scale: String
    let score: Int
    let riskLevel: String
    let interventions: [String]
}

private struct Responded: Decodable { let responded: Bool }
private struct StatusBody: Encodable { let status: String }
private struct VerifyBody: Encodable { let patientBarcode: String; let drugBarcode: String }
private struct CompleteBody: Encodable { let totalVolumeInfusedMl: Int? }

/// The nurse module's calls, one per route it uses.
struct NurseApi: Sendable {
    let client: ApiClient

    func listActiveAdmissions() async throws -> [AdmissionRow] {
        let page: AdmissionList = try await client.request(.get, "/api/ipd/admissions?status=admitted&per_page=100")
        return page.admissions.map { row in
            var r = row
            if r.bedLabel == nil { r.bedLabel = row.wardName }
            return r
        }
    }

    func listNurseCalls() async throws -> NurseCallBoard { try await client.request(.get, "/api/bedside/nurse-calls/active") }
    func updateNurseCall(_ id: String, status: String) async throws -> Empty {
        try await client.request(.put, "/api/bedside/nurse-requests/\(id)/status", body: StatusBody(status: status))
    }

    func listActiveCodeBlues() async throws -> [CodeBlueEvent] { try await client.request(.get, "/api/nurse/code-blue?active_only=true") }
    func listCodeBlueResponders() async throws -> [CodeBlueResponder] { try await client.request(.get, "/api/nurse/code-blue/responders") }
    func respondToCodeBlue(_ id: String) async throws {
        let _: Responded = try await client.request(.post, "/api/nurse/code-blue/\(id)/respond")
    }
    func listOpenEmergencyCodes() async throws -> [EmergencyCodeActivation] {
        let rows: [EmergencyCodeActivation] = try await client.request(.get, "/api/emergency/codes")
        return rows.filter { $0.deactivatedAt == nil }
    }

    func listMar(_ admissionId: String) async throws -> [MarRow] { try await client.request(.get, "/api/ipd/admissions/\(admissionId)/mar") }
    func updateMar(_ admissionId: String, _ marId: String, _ payload: UpdateMarPayload) async throws -> MarRow {
        try await client.request(.put, "/api/ipd/admissions/\(admissionId)/mar/\(marId)", body: payload)
    }
    func verifyMarBarcode(_ marId: String, patient: String, drug: String) async throws -> BarcodeVerifyResult {
        try await client.request(.post, "/api/nurse/mar/\(marId)/verify-barcode", body: VerifyBody(patientBarcode: patient, drugBarcode: drug))
    }
    func wardOnDuty(_ wardId: String) async throws -> [WardOnDutyRow] { try await client.request(.get, "/api/ipd/wards/\(wardId)/on-duty") }

    func listHandoffs(_ encounterId: String) async throws -> [ShiftHandoff] { try await client.request(.get, "/api/nurse/handoffs/encounter/\(encounterId)") }
    func createHandoff(_ payload: CreateHandoffPayload) async throws -> ShiftHandoff { try await client.request(.post, "/api/nurse/handoffs", body: payload) }
    func acceptHandoff(_ id: String) async throws -> ShiftHandoff { try await client.request(.put, "/api/nurse/handoffs/\(id)/accept") }

    func listTransfusions(_ admissionId: String) async throws -> [BedsideTransfusion] { try await client.request(.get, "/api/ipd/admissions/\(admissionId)/transfusions") }
    func listObservations(_ transfusionId: String) async throws -> [TransfusionObservation] { try await client.request(.get, "/api/blood-bank/transfusions/\(transfusionId)/observations") }
    func recordObservation(_ transfusionId: String, _ payload: RecordObservationPayload) async throws -> TransfusionObservation {
        try await client.request(.post, "/api/blood-bank/transfusions/\(transfusionId)/observations", body: payload)
    }
    func completeTransfusion(_ id: String) async throws -> BedsideTransfusion {
        try await client.request(.put, "/api/ipd/transfusions/\(id)/complete", body: CompleteBody(totalVolumeInfusedMl: nil))
    }

    func createVitals(_ p: CreateVitalsPayload) async throws -> Empty { try await client.request(.post, "/api/nurse/vitals", body: p) }
    func createIoEntry(_ p: CreateIoEntryPayload) async throws -> Empty { try await client.request(.post, "/api/nurse/io-entries", body: p) }
    func ioBalance(_ encounterId: String) async throws -> IoBalance { try await client.request(.get, "/api/nurse/io-entries/encounter/\(encounterId)/balance?since_hours=8") }
    func createPain(_ p: CreatePainEntryPayload) async throws -> Empty { try await client.request(.post, "/api/nurse/pain-entries", body: p) }
    func createFallRisk(_ p: CreateFallRiskPayload) async throws -> Empty { try await client.request(.post, "/api/nurse/fall-risk", body: p) }
}
