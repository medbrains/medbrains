import Foundation
import MedBrainsKit

// The patient portal — the only endpoints this app calls. Every read is
// subject-locked at the backend: the patient comes from the token, so there is
// no id to pass and none to get wrong. Wire shapes mirror
// crates/medbrains-server/src/routes/portal.rs.

struct PortalSession: Decodable, Sendable {
    let token: String
    let patientId: String
    let tenantId: String
    let expiresInHours: Int
}

struct PortalAppointment: Decodable, Identifiable, Sendable {
    let id: String
    let appointmentDate: String
    let status: String
    let departmentName: String?
}

struct PortalLabReport: Decodable, Sendable {
    let orderId: String
    let testName: String
    let parameterName: String
    let value: String
    let unit: String?
    let normalRange: String?
    let flag: String?
    let reportedAt: String
}

struct PortalPrescriptionItem: Decodable, Sendable {
    let prescriptionId: String
    let drugName: String
    let dosage: String
    let frequency: String
    let duration: String
    let prescribedAt: String
}

struct PortalInvoice: Decodable, Identifiable, Sendable {
    let id: String
    let invoiceNumber: String
    let status: String
    let totalAmount: String
    let paidAmount: String
    let balanceDue: String
    let createdAt: String
}

/// What the tenant has licensed for this patient, beyond their record.
struct PortalEntitlements: Decodable, Sendable {
    let companion: Bool
}

private struct OtpRequest: Encodable { let tenantCode: String; let phone: String }
private struct OtpVerify: Encodable { let tenantCode: String; let phone: String; let code: String }

struct PortalApi: Sendable {
    let client: ApiClient

    /// Asks for a sign-in code. The reply is the same whether or not the number
    /// is registered, so this cannot be used to find out who is a patient here.
    func requestCode(tenantCode: String, phone: String) async throws {
        let _: Empty = try await client.request(.post, "/api/portal/auth/request-otp", body: OtpRequest(tenantCode: tenantCode, phone: phone))
    }

    func verifyCode(tenantCode: String, phone: String, code: String) async throws -> PortalSession {
        try await client.request(.post, "/api/portal/auth/verify", body: OtpVerify(tenantCode: tenantCode, phone: phone, code: code))
    }

    func appointments() async throws -> [PortalAppointment] { try await client.request(.get, "/api/portal/appointments") }
    /// Only verified results, and nothing carrying an unacknowledged critical alert — the backend applies both rules.
    func labReports() async throws -> [PortalLabReport] { try await client.request(.get, "/api/portal/lab-reports") }
    func prescriptions() async throws -> [PortalPrescriptionItem] { try await client.request(.get, "/api/portal/prescriptions") }
    func bills() async throws -> [PortalInvoice] { try await client.request(.get, "/api/portal/bills") }
    func entitlements() async throws -> PortalEntitlements { try await client.request(.get, "/api/portal/entitlements") }
}
