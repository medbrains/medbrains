import Foundation

/// `/api/abdm/abha/*` and `/api/abdm/scan-share/*`, as `packages/api` names
/// them. Every call needs `abdm.abha.manage` (the scan-share ones
/// `abdm.scanshare.view`); the server checks, the screens gate the control.
public enum AbdmEndpoint {
    public static let verifications = "/api/abdm/abha/verifications"
    public static let enrolments = "/api/abdm/abha/enrolments"
    public static let scanShareQueue = "/api/abdm/scan-share/queue"
    public static let readQr = "/api/abdm/abha/qr"
    static func verification(_ id: String, _ tail: String) -> String { "\(verifications)/\(id)/\(tail)" }
    static func enrolment(_ id: String, _ tail: String) -> String { "\(enrolments)/\(id)/\(tail)" }
    static func share(_ id: String, _ tail: String) -> String { "/api/abdm/scan-share/\(id)/\(tail)" }
}

public struct AbhaApi: Sendable {
    let client: ApiClient

    public init(client: ApiClient) { self.client = client }

    private struct Start: Encodable { let method: AbhaVerifyMethod; let value: String; let otpVia: AbhaOtpVia? }
    private struct Otp: Encodable { let otp: String }
    private struct EnrolmentOtp: Encodable { let otp: String; let mobile: String }
    private struct Account: Encodable { let abhaNumber: String }
    private struct Address: Encodable { let abhaAddress: String }
    private struct Enrol: Encodable { let aadhaar: String; let consent: Bool }
    private struct ResendEnrol: Encodable { let aadhaar: String? }
    private struct Resend: Encodable { let value: String? }
    private struct QrPayload: Encodable { let payload: String }
    private struct Link: Encodable { let patientId: String; let apply: [AbhaField] }
    private struct Linked: Decodable { let linked: Bool }

    /// Send the person an OTP — or, finding by mobile, list the ABHAs on it.
    /// Only an ABHA number or address lookup chooses where the OTP goes.
    public func start(_ method: AbhaVerifyMethod, value: String, via: AbhaOtpVia) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.verifications, body: Start(method: method, value: value.trimmingCharacters(in: .whitespaces), otpVia: Abha.choosesOtpVia(method) ? via : nil))
    }

    /// The OTP again. An Aadhaar login sends the Aadhaar number again: the
    /// server never keeps it.
    public func resend(_ id: String, value: String? = nil) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.verification(id, "resend"), body: Resend(value: value))
    }

    /// What a scanned ABHA card says, to verify by OTP next.
    public func readQr(_ payload: String) async throws -> AbhaCardQr {
        try await client.request(.post, AbdmEndpoint.readQr, body: QrPayload(payload: payload))
    }

    public func submitOtp(_ id: String, otp: String) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.verification(id, "otp"), body: Otp(otp: otp))
    }

    public func chooseAccount(_ id: String, abhaNumber: String) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.verification(id, "account"), body: Account(abhaNumber: abhaNumber))
    }

    /// The Aadhaar number travels once, to the server, which encrypts it to
    /// ABDM and keeps nothing; the caller drops it once the OTP is sent.
    public func startEnrolment(aadhaar: String, consent: Bool) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.enrolments, body: Enrol(aadhaar: aadhaar, consent: consent))
    }

    public func enrolmentOtp(_ id: String, otp: String, mobile: String) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.enrolment(id, "otp"), body: EnrolmentOtp(otp: otp, mobile: mobile))
    }

    /// The waiting OTP again. The Aadhaar OTP needs the Aadhaar number again
    /// (never stored); the mobile OTP does not.
    public func resendEnrolment(_ id: String, aadhaar: String?) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.enrolment(id, "resend"), body: ResendEnrol(aadhaar: aadhaar))
    }

    public func enrolmentMobileOtp(_ id: String, otp: String) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.enrolment(id, "mobile-otp"), body: Otp(otp: otp))
    }

    public func chooseAddress(_ id: String, address: String) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.enrolment(id, "address"), body: Address(abhaAddress: address))
    }

    /// The ABHA card as ABDM renders it, to show, print or share.
    public func card(_ id: String) async throws -> Data { try await client.download(AbdmEndpoint.verification(id, "card")) }

    public func qr(_ id: String) async throws -> Data { try await client.download(AbdmEndpoint.verification(id, "qr")) }

    /// Link through the server's verified path: it checks the verification
    /// is this user's, verified, and not on another patient.
    public func link(_ id: String, patientId: String, apply: Set<AbhaField>) async throws {
        let _: Linked = try await client.request(.post, AbdmEndpoint.verification(id, "link"), body: Link(patientId: patientId, apply: apply.sorted { $0.rawValue < $1.rawValue }))
    }
}

public struct ScanShareApi: Sendable {
    let client: ApiClient

    public init(client: ApiClient) { self.client = client }

    private struct Complete: Encodable { let patientId: String }

    /// Today's shares, newest first; the server bounds the list.
    public func queue() async throws -> [AbdmProfileShare] { try await client.request(.get, AbdmEndpoint.scanShareQueue) }

    /// The share as a verified ABHA, recorded by the server from what ABDM delivered.
    public func verification(_ id: String) async throws -> AbhaVerificationStep {
        try await client.request(.post, AbdmEndpoint.share(id, "verification"))
    }

    public func complete(_ id: String, patientId: String) async throws -> AbdmProfileShare {
        try await client.request(.post, AbdmEndpoint.share(id, "complete"), body: Complete(patientId: patientId))
    }

    public func dismiss(_ id: String) async throws -> AbdmProfileShare {
        try await client.request(.post, AbdmEndpoint.share(id, "dismiss"))
    }
}
