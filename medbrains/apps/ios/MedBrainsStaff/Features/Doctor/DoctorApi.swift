import Foundation
import MedBrainsKit

// Wire shapes mirror medbrains-opd, hand-written from packages/types. The
// case sheet lives in NotesApi.swift, the token queue in
// Shared/Tokens/TokenApi.swift.

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

    func listMyAppointments(doctorId: String, date: String) async throws -> [AppointmentRow] {
        try await client.request(.get, "/api/opd/appointments?doctor_id=\(doctorId)&date=\(date)")
    }
}
