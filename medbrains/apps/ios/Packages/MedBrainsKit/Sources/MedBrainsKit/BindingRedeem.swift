import CryptoKit
import Foundation

/// The network half of binding: redeem a verified QR at the server it names,
/// over the pinned session, and check the server proves it holds the QR's key.
public struct HospitalBinder: Sendable {
    public let secrets: SecretStore
    public var verifier: BindingVerifier

    public init(secrets: SecretStore, verifier: BindingVerifier = BindingVerifier()) {
        self.secrets = secrets
        self.verifier = verifier
    }

    /// Verify, redeem and store. Throws `BindingError` with a readable reason.
    /// `appVariant` is the surface (`Mobile-Staff`); `clientVariant` the
    /// `X-MedBrains-Client` suffix (`staff`).
    public func bind(_ scanned: String, deviceLabel: String, appVariant: String, clientVariant: String, now: Date = Date()) async throws -> HospitalBinding {
        let existing = try? secrets.readBinding()
        let code = try verifier.verify(scanned, existing: existing, now: now)
        let payload = code.payload
        guard let base = URL(string: payload.apiBase) else { throw BindingError.malformed }
        let challenge = Base64URL.encode(Self.randomBytes(BindingKeys.challengeBytes))
        let request = RedeemRequest(
            token: code.token,
            deviceLabel: deviceLabel,
            appVariant: appVariant,
            publicKeyPem: try DeviceKey.make(secrets: secrets),
            challenge: challenge
        )
        let client = ApiClient(baseURL: base, variant: clientVariant, secrets: secrets, session: SPKIPinningDelegate.session(pin: payload.spki))
        let answer: RedeemResponse
        do {
            answer = try await client.request(.post, BindingContract.redeemPath, body: request)
        } catch let error as ApiError {
            throw BindingError.refused(error.status == 409 ? "This hospital code has already been used. Ask for a new one." : error.message)
        } catch {
            throw BindingError.refused("Could not reach the hospital server, or it is not the server this code names.")
        }
        guard BindingVerifier.isValidProof(answer.proof, ik: payload.ik, jti: payload.jti, challenge: challenge) else {
            throw BindingError.badSignature
        }
        let binding = HospitalBinding(
            tenant: answer.tenant, tenantName: answer.tenantName, apiBase: payload.apiBase,
            spki: payload.spki, ik: payload.ik, pairedDeviceId: answer.pairedDeviceId, boundAt: now
        )
        try secrets.writeBinding(binding)
        return binding
    }

    static func randomBytes(_ count: Int) -> Data {
        Data(SymmetricKey(size: SymmetricKeySize(bitCount: count * 8)).withUnsafeBytes { Array($0) })
    }
}

enum BindingKeys {
    static let challengeBytes = 32
}

struct RedeemRequest: Encodable {
    let token: String
    let deviceLabel: String
    let appVariant: String
    let publicKeyPem: String
    let challenge: String
}

struct RedeemResponse: Decodable {
    let pairedDeviceId: String
    let tenant: String
    let tenantName: String
    let proof: String
}

/// This device's own P-256 key for the binding: in the Secure Enclave when the
/// hardware has one. A fresh key per binding; only the public half leaves.
enum DeviceKey {
    static func make(secrets: SecretStore) throws -> String {
        if SecureEnclave.isAvailable {
            let key = try SecureEnclave.P256.Signing.PrivateKey()
            try secrets.write(.deviceKey, key.dataRepresentation.base64EncodedString())
            return key.publicKey.pemRepresentation
        }
        let key = P256.Signing.PrivateKey()
        try secrets.write(.deviceKey, key.rawRepresentation.base64EncodedString())
        return key.publicKey.pemRepresentation
    }
}

public extension SecretStore {
    func readBinding() throws -> HospitalBinding? {
        guard let json = try read(.hospitalBinding) else { return nil }
        return try JSONDecoder.medbrains.decode(HospitalBinding.self, from: Data(json.utf8))
    }

    func writeBinding(_ binding: HospitalBinding) throws {
        try write(.hospitalBinding, String(decoding: try JSONEncoder.medbrains.encode(binding), as: UTF8.self))
    }

    /// "Forget this hospital": the next binding may come from any trusted key.
    func deleteBinding() throws {
        try delete(.hospitalBinding)
        try delete(.deviceKey)
    }
}
