import CryptoKit
import Foundation

/// Signed-QR hospital binding (contract v1). A hospital administrator prints
/// a QR; scanning it binds this app to that hospital's server, so nobody types
/// a hospital code and the app talks to no other server.
///
/// Trust model: the QR is a JWS signed with the server's Ed25519 binding key,
/// whose public half (`ik`) rides in the payload. A self-carried key proves
/// only that the QR was not altered, so authenticity comes from one of:
/// 1. `trustedIssuerKeys` — keys pinned into the build; when non-empty, a QR
///    signed by any other key is refused outright.
/// 2. Otherwise trust on first use: the first binding's `ik` is kept, and a
///    later QR from a different key is refused until the person forgets the
///    current hospital on purpose.
/// Either way the redeem call then goes over TLS pinned to the QR's `spki`,
/// and the server must sign the app's fresh challenge with the same key —
/// proof that the pinned server, not just the QR's author, holds it.
public enum BindingContract {
    public static let scheme = "medbrains://bind?t="
    public static let algorithm = "EdDSA"
    public static let type = "mb-binding+jws"
    public static let audience = "medbrains-app"
    public static let version = 1
    /// Clock drift tolerated on `iat` / `exp`.
    public static let clockSkew: TimeInterval = 60
    public static let redeemPath = "/api/device-binding/redeem"
    public static let proofPrefix = "mb-binding-proof:v1:"
    /// Issuer keys (base64url, raw 32 bytes) pinned into this build. Empty:
    /// trust on first use. A hospital's own build lists its server's key.
    public static let trustedIssuerKeys: [String] = []

    #if DEBUG
    public static let allowsPlainHTTP = true
    #else
    public static let allowsPlainHTTP = false
    #endif
}

/// The QR's signed claims.
public struct BindingPayload: Codable, Equatable, Sendable {
    public let v: Int
    public let iss: String
    public let aud: String
    public let tenant: String
    public let tenantName: String
    public let apiBase: String
    public let spki: String?
    public let ik: String
    public let jti: String
    public let iat: Int
    public let exp: Int
}

/// What this device keeps once bound (Keychain, JSON).
public struct HospitalBinding: Codable, Equatable, Sendable {
    public let tenant: String
    public let tenantName: String
    public let apiBase: String
    public let spki: String?
    public let ik: String
    public let pairedDeviceId: String
    public let boundAt: Date

    public init(tenant: String, tenantName: String, apiBase: String, spki: String?, ik: String, pairedDeviceId: String, boundAt: Date) {
        self.tenant = tenant
        self.tenantName = tenantName
        self.apiBase = apiBase
        self.spki = spki
        self.ik = ik
        self.pairedDeviceId = pairedDeviceId
        self.boundAt = boundAt
    }
}

/// Why a QR was refused, in words a person can act on.
public enum BindingError: Error, Equatable, LocalizedError, Sendable {
    case notABindingCode
    case malformed
    case badSignature
    case untrustedIssuer
    case differentIssuer
    case expired
    case insecureServer
    case missingPin
    case refused(String)

    public var errorDescription: String? {
        switch self {
        case .notABindingCode: "This QR is not a MedBrains hospital code."
        case .malformed: "This hospital code is damaged. Ask for a new one."
        case .badSignature: "This hospital code has been altered. Do not use it."
        case .untrustedIssuer: "This hospital code is not from a server this app trusts."
        case .differentIssuer: "This code is from a different server. Forget the current hospital first."
        case .expired: "This hospital code has expired. Ask for a new one."
        case .insecureServer: "This hospital code points to an unencrypted server."
        case .missingPin: "This hospital code has no server pin. Ask for a new one."
        case .refused(let message): message
        }
    }
}

/// A QR that passed every local check, ready to redeem.
public struct VerifiedBindingCode: Equatable, Sendable {
    public let token: String
    public let payload: BindingPayload
}

/// Local checks on a scanned QR — no network.
public struct BindingVerifier: Sendable {
    public var trustedIssuerKeys: [String]
    public var allowsPlainHTTP: Bool

    public init(trustedIssuerKeys: [String] = BindingContract.trustedIssuerKeys, allowsPlainHTTP: Bool = BindingContract.allowsPlainHTTP) {
        self.trustedIssuerKeys = trustedIssuerKeys
        self.allowsPlainHTTP = allowsPlainHTTP
    }

    public func verify(_ scanned: String, existing: HospitalBinding?, now: Date = Date()) throws -> VerifiedBindingCode {
        let text = scanned.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.hasPrefix(BindingContract.scheme) else { throw BindingError.notABindingCode }
        let token = String(text.dropFirst(BindingContract.scheme.count))
        let parts = token.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 3,
              let headerData = Base64URL.decode(parts[0]),
              let payloadData = Base64URL.decode(parts[1]),
              let signature = Base64URL.decode(parts[2]),
              let header = try? JSONDecoder().decode(Header.self, from: headerData),
              header.alg == BindingContract.algorithm, header.typ == BindingContract.type,
              let payload = try? JSONDecoder.medbrains.decode(BindingPayload.self, from: payloadData),
              payload.v == BindingContract.version, payload.aud == BindingContract.audience
        else { throw BindingError.malformed }
        guard let key = Self.publicKey(payload.ik) else { throw BindingError.malformed }
        guard key.isValidSignature(signature, for: Data("\(parts[0]).\(parts[1])".utf8)) else { throw BindingError.badSignature }
        try checkIssuer(payload.ik, existing: existing)
        let seconds = now.timeIntervalSince1970
        guard Double(payload.exp) + BindingContract.clockSkew >= seconds,
              Double(payload.iat) <= seconds + BindingContract.clockSkew
        else { throw BindingError.expired }
        try checkServer(payload)
        return VerifiedBindingCode(token: token, payload: payload)
    }

    /// The server's answer to our challenge, signed by the QR's own key.
    public static func isValidProof(_ proof: String, ik: String, jti: String, challenge: String) -> Bool {
        guard let key = publicKey(ik), let signature = Base64URL.decode(proof) else { return false }
        return key.isValidSignature(signature, for: Data("\(BindingContract.proofPrefix)\(jti):\(challenge)".utf8))
    }

    private func checkIssuer(_ ik: String, existing: HospitalBinding?) throws {
        if !trustedIssuerKeys.isEmpty {
            guard trustedIssuerKeys.contains(ik) else { throw BindingError.untrustedIssuer }
        } else if let existing, existing.ik != ik {
            throw BindingError.differentIssuer
        }
    }

    private func checkServer(_ payload: BindingPayload) throws {
        guard let url = URL(string: payload.apiBase), let scheme = url.scheme?.lowercased(), url.host != nil else {
            throw BindingError.malformed
        }
        switch scheme {
        case "https":
            guard let pin = payload.spki, !pin.isEmpty else { throw BindingError.missingPin }
        case "http":
            guard allowsPlainHTTP else { throw BindingError.insecureServer }
        default:
            throw BindingError.malformed
        }
    }

    private static func publicKey(_ ik: String) -> Curve25519.Signing.PublicKey? {
        guard let raw = Base64URL.decode(ik) else { return nil }
        return try? Curve25519.Signing.PublicKey(rawRepresentation: raw)
    }

    private struct Header: Decodable {
        let alg: String
        let typ: String?
    }
}

/// base64url without padding, as the JWS uses it.
public enum Base64URL {
    public static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    public static func decode(_ text: String) -> Data? {
        var s = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        s += String(repeating: "=", count: (4 - s.count % 4) % 4)
        return Data(base64Encoded: s)
    }
}
