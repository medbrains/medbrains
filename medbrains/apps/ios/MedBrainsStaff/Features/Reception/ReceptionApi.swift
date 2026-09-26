import Foundation
import MedBrainsKit

/// A patient as the desk needs them: the two identifiers (name and date of
/// birth), the phone, and the safety flags. The list, the match and the
/// created record all decode into this.
struct PatientSummary: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let uhid: String
    let firstName: String
    let lastName: String
    let dateOfBirth: String?
    let phone: String
    let gender: String
    var isMedicoLegal: Bool? = nil
    var mlcNumber: String? = nil
    var isVip: Bool? = nil
    var isDobEstimated: Bool? = nil
    var lastVisitDate: String? = nil
    var totalVisits: Int? = nil
    var outstandingBalance: String? = nil

    var fullName: String { "\(firstName) \(lastName)" }
    /// "UHID · DOB · phone": the line the desk reads back.
    var identifiers: String { [uhid, dateOfBirth ?? "DOB unknown", phone].joined(separator: " · ") }
}

/// A possible duplicate from `POST /api/patients/match`, scored by the server.
struct MatchCandidate: Decodable, Identifiable, Sendable {
    let id: String
    let uhid: String
    let firstName: String
    let lastName: String
    let dateOfBirth: String?
    let phone: String
    let score: Double

    var asSummary: PatientSummary {
        PatientSummary(id: id, uhid: uhid, firstName: firstName, lastName: lastName, dateOfBirth: dateOfBirth, phone: phone, gender: "unknown")
    }
}

struct MatchQuery: Encodable {
    let firstName: String
    let lastName: String
    let dateOfBirth: String?
    let phone: String
}

/// What the phone records about how this registration was checked, so a
/// second UHID for the same person is never silent.
struct MobileRegistrationAttributes: Encodable {
    let source: String
    let duplicateCheck: String
    let matchedUhid: String?
}

struct CreatePatientBody: Encodable {
    struct Attributes: Encodable { let mobileRegistration: MobileRegistrationAttributes }
    let firstName: String
    let lastName: String
    let gender: String
    let phone: String
    let dateOfBirth: String
    let isDobEstimated: Bool
    let registrationType: String
    let registrationSource: String
    let referredByName: String?
    let departmentId: String?
    let consultantId: String?
    let abhaNumber: String?
    let isMedicoLegal: Bool
    let mlcNumber: String?
    let isVip: Bool
    let attributes: Attributes
    /// What the patient agreed to be messaged on. No email is taken at this
    /// desk, so email is never agreed here.
    let contact: ContactPreferences
}

struct ContactPreferences: Encodable {
    let whatsappOptIn: Bool
    let emailOptIn: Bool
}

struct DepartmentRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let code: String
    let name: String
}

struct DoctorRow: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let fullName: String
    let specialization: String?
}

struct StartVisitBody: Encodable {
    let patientId: String
    let departmentId: String
    let doctorId: String?
    let chiefComplaint: String?
    let visitType: String
}

/// The visit and the token the server issued for it, in one answer.
struct VisitStarted: Decodable, Hashable, Sendable {
    struct Encounter: Decodable, Hashable, Sendable { let id: String }
    struct Queue: Decodable, Hashable, Sendable { let id: String; let tokenNumber: Int; let status: String }
    let encounter: Encounter
    let queue: Queue
}

private struct PatientPage: Decodable { let patients: [PatientSummary] }

struct ReceptionApi: Sendable {
    let client: ApiClient

    func matchPatients(_ q: MatchQuery) async throws -> [MatchCandidate] { try await client.request(.post, "/api/patients/match", body: q) }
    func createPatient(_ body: CreatePatientBody) async throws -> PatientSummary { try await client.request(.post, "/api/patients", body: body) }
    /// The desk's lookup, not the caller's own list. `/api/patients` is scoped
    /// to patients this user has a relationship with, so a receptionist could
    /// not find one a colleague registered; `/find` reaches the whole hospital
    /// and answers with identity only.
    func searchPatients(_ text: String) async throws -> [PatientSummary] {
        let q = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? text
        return try await client.request(.get, "/api/patients/find?q=\(q)")
    }
    func departments() async throws -> [DepartmentRow] { try await client.request(.get, "/api/setup/departments") }
    func doctors() async throws -> [DoctorRow] { try await client.request(.get, "/api/setup/doctors") }
    func startVisit(_ body: StartVisitBody) async throws -> VisitStarted { try await client.request(.post, "/api/opd/encounters", body: body) }
}
