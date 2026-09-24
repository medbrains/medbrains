import Foundation
import MedBrainsKit

// Wire shapes mirror crates/medbrains-tokens, medbrains-opd and
// medbrains-core/consultation.rs, hand-written from packages/types.

/// One row of the unified token queue with the patient behind it
/// (`/api/tokens/worklist`, gated on a clinical permission).
struct WorklistToken: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let number: String
    let seq: Int
    var status: String
    let priority: String
    let scopeLabel: String?
    var counterLabel: String?
    var calledAt: String?
    let createdAt: String
    let patientId: String?
    let patientName: String?
    let uhid: String?
    let encounterId: String?

    var displayName: String { patientName ?? "Unnamed patient" }
}

/// The token as a transition returns it; only what the detail screen merges back.
struct ModuleToken: Decodable, Sendable {
    let id: String
    let status: String
    let calledAt: String?
    let counterLabel: String?
}

struct Consultation: Decodable, Sendable {
    let id: String
    let encounterId: String
    let chiefComplaint: String?
    let examination: String?
    /// Assessment. The column is `notes`; the label a clinician reads is not.
    let notes: String?
    let plan: String?
}

struct ConsultationNotes: Encodable {
    let chiefComplaint: String
    let examination: String
    let notes: String
    let plan: String
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

private struct CallBody: Encodable { let counterLabel: String? }
private struct CallNextBody: Encodable { let counterLabel: String?; let module: String; let scope: String?; let scopeId: String? }

/// The doctor module's calls, one per route it uses.
struct DoctorApi: Sendable {
    let client: ApiClient

    /// Today's OPD queue, the one the waiting-room board shows.
    func listWorklist() async throws -> [WorklistToken] { try await client.request(.get, "/api/tokens/worklist?module=opd") }

    /// Call whoever is next and let the server decide who that is. `nil` is a
    /// real answer: nobody is waiting.
    func callNext() async throws -> ModuleToken? {
        let body = CallNextBody(counterLabel: nil, module: "opd", scope: nil, scopeId: nil)
        return try await client.request(.post, "/api/tokens/call-next", body: body, as: ModuleToken?.self)
    }
    func call(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/call", body: CallBody(counterLabel: nil)) }
    func serve(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/serve") }
    func complete(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/complete") }
    func noShow(_ id: String) async throws -> ModuleToken { try await client.request(.post, "/api/tokens/\(id)/no-show") }

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
