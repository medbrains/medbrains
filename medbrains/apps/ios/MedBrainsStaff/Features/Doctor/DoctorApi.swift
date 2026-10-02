import Foundation
import MedBrainsKit

// Wire shapes mirror medbrains-opd and medbrains-core/consultation.rs,
// hand-written from packages/types. The token queue lives in
// Shared/Tokens/TokenApi.swift.

struct Consultation: Decodable, Sendable {
    let id: String
    let encounterId: String
    let chiefComplaint: String?
    let examination: String?
    /// Assessment. The column is `notes`; the label a clinician reads is not.
    let notes: String?
    let plan: String?
    /// Only the site findings are read here; the web's system notes ride along untouched.
    let physicalExamination: SiteFindings?
}

struct ConsultationNotes: Encodable {
    let chiefComplaint: String
    let examination: String
    let notes: String
    let plan: String
    /// Sent only when the findings changed; the server merges it into the
    /// examination by key, so the system notes are kept.
    let physicalExamination: SiteFindings?
}

struct SiteFindings: Codable, Sendable {
    let findings: [ExamFinding]?
}

/// medbrains-core `ExamFinding`: what was found at a place on the body.
struct ExamFinding: Codable, Hashable, Sendable {
    let site: String
    /// FMA code when picked on the web's 3D model; a region has none.
    let siteCode: String?
    let laterality: Laterality?
    let finding: String

    /// "Left knee: effusion" — the side is in the label when it names one.
    var line: String {
        guard let side = laterality?.rawValue, !site.localizedCaseInsensitiveContains(side) else { return "\(site): \(finding)" }
        return "\(site) (\(side)): \(finding)"
    }
}

struct AppointmentRow: Decodable, Identifiable, Sendable {
    let id: String
    let patientId: String
    let patientName: String?
    let appointmentDate: String
    let startTime: String?
    let status: String
    let reason: String?
}

/// The doctor module's calls, one per route it uses.
struct DoctorApi: Sendable {
    let client: ApiClient

    /// The consultation for an encounter, or nil when none has been written.
    /// Narrowly 404: a refused read must not arrive as a blank note the
    /// doctor then writes a second consultation over.
    func getConsultation(_ encounterId: String) async throws -> Consultation? {
        do {
            return try await client.request(.get, "/api/opd/encounters/\(encounterId)/consultation")
        } catch let error as ApiError where error.status == 404 {
            return nil
        }
    }
    func createConsultation(_ encounterId: String, _ notes: ConsultationNotes) async throws -> Consultation {
        try await client.request(.post, "/api/opd/encounters/\(encounterId)/consultation", body: notes)
    }
    func updateConsultation(_ encounterId: String, _ id: String, _ notes: ConsultationNotes) async throws -> Consultation {
        try await client.request(.put, "/api/opd/encounters/\(encounterId)/consultation/\(id)", body: notes)
    }

    func listMyAppointments(doctorId: String, date: String) async throws -> [AppointmentRow] {
        try await client.request(.get, "/api/opd/appointments?doctor_id=\(doctorId)&date=\(date)")
    }
}
