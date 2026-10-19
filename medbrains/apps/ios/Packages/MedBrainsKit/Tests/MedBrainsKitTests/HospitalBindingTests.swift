import CryptoKit
import Foundation
import XCTest
@testable import MedBrainsKit

/// A scanned hospital QR is trusted only when its signature, issuer, expiry and
/// server all check out — a QR that fails any of them never reaches the network.
final class HospitalBindingTests: XCTestCase {
    private let key = Curve25519.Signing.PrivateKey()
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private var ik: String { Base64URL.encode(key.publicKey.rawRepresentation) }
    private let releaseVerifier = BindingVerifier(trustedIssuerKeys: [], allowsPlainHTTP: false)

    private func payload(apiBase: String = "https://hims.example.in", spki: String? = "pin=", exp: Int? = nil, aud: String = "medbrains-app") -> [String: Any] {
        var p: [String: Any] = [
            "v": 1, "iss": apiBase, "aud": aud, "tenant": "AMH", "tenant_name": "AMH Hospital",
            "api_base": apiBase, "ik": ik, "jti": "nonce123", "iat": Int(now.timeIntervalSince1970) - 10,
            "exp": exp ?? Int(now.timeIntervalSince1970) + 3600,
        ]
        if let spki { p["spki"] = spki }
        return p
    }

    private func qr(_ claims: [String: Any], typ: String = "mb-binding+jws", signer: Curve25519.Signing.PrivateKey? = nil) throws -> String {
        let header = Base64URL.encode(try JSONSerialization.data(withJSONObject: ["alg": "EdDSA", "typ": typ, "kid": "k"]))
        let body = Base64URL.encode(try JSONSerialization.data(withJSONObject: claims))
        let signature = try (signer ?? key).signature(for: Data("\(header).\(body)".utf8))
        return "medbrains://bind?t=\(header).\(body).\(Base64URL.encode(signature))"
    }

    private func binding(ik: String) -> HospitalBinding {
        HospitalBinding(tenant: "AMH", tenantName: "AMH", apiBase: "https://hims.example.in", spki: "pin=", ik: ik, pairedDeviceId: "d", boundAt: now)
    }

    private func assertRefused(_ text: String, _ expected: BindingError, existing: HospitalBinding? = nil, verifier: BindingVerifier? = nil, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertThrowsError(try (verifier ?? releaseVerifier).verify(text, existing: existing, now: now), file: file, line: line) {
            XCTAssertEqual($0 as? BindingError, expected, file: file, line: line)
        }
    }

    func testAGenuineCodeIsReadIntoItsClaims() throws {
        let code = try releaseVerifier.verify(try qr(payload()), existing: nil, now: now)
        XCTAssertEqual(code.payload.tenant, "AMH")
        XCTAssertEqual(code.payload.tenantName, "AMH Hospital")
        XCTAssertEqual(code.payload.apiBase, "https://hims.example.in")
        XCTAssertEqual(code.payload.spki, "pin=")
        XCTAssertEqual(code.payload.jti, "nonce123")
    }

    func testAnAlteredPayloadIsRefused() throws {
        let genuine = try qr(payload())
        let parts = genuine.dropFirst(BindingContract.scheme.count).split(separator: ".").map(String.init)
        var claims = payload()
        claims["api_base"] = "https://attacker.example"
        let forged = Base64URL.encode(try JSONSerialization.data(withJSONObject: claims))
        assertRefused("\(BindingContract.scheme)\(parts[0]).\(forged).\(parts[2])", .badSignature)
    }

    func testAnythingButABindingCodeIsNotOne() {
        assertRefused("https://example.com", .notABindingCode)
        assertRefused("medbrains://bind?t=not.a.jws", .malformed)
    }

    func testTheWrongTypeOrAudienceIsRefused() throws {
        assertRefused(try qr(payload(), typ: "JWT"), .malformed)
        assertRefused(try qr(payload(aud: "someone-else")), .malformed)
    }

    func testAnExpiredCodeIsRefused() throws {
        assertRefused(try qr(payload(exp: Int(now.timeIntervalSince1970) - 120)), .expired)
    }

    func testAnotherServersKeyIsRefusedOnceBound() throws {
        let other = Base64URL.encode(Curve25519.Signing.PrivateKey().publicKey.rawRepresentation)
        assertRefused(try qr(payload()), .differentIssuer, existing: binding(ik: other))
        XCTAssertNoThrow(try releaseVerifier.verify(try qr(payload()), existing: binding(ik: ik), now: now))
    }

    func testABuildPinnedTrustRootRefusesAnyOtherKey() throws {
        let other = Base64URL.encode(Curve25519.Signing.PrivateKey().publicKey.rawRepresentation)
        assertRefused(try qr(payload()), .untrustedIssuer, verifier: BindingVerifier(trustedIssuerKeys: [other], allowsPlainHTTP: false))
        XCTAssertNoThrow(try BindingVerifier(trustedIssuerKeys: [ik], allowsPlainHTTP: false).verify(try qr(payload()), existing: nil, now: now))
    }

    func testPlainHTTPOnlyInDebugAndHTTPSNeedsAPin() throws {
        let http = try qr(payload(apiBase: "http://10.0.0.5:3000", spki: nil))
        assertRefused(http, .insecureServer)
        XCTAssertNoThrow(try BindingVerifier(trustedIssuerKeys: [], allowsPlainHTTP: true).verify(http, existing: nil, now: now))
        assertRefused(try qr(payload(spki: nil)), .missingPin)
    }

    func testTheServerProvesItHoldsTheKey() throws {
        let challenge = Base64URL.encode(HospitalBinder.randomBytes(32))
        let proof = Base64URL.encode(try key.signature(for: Data("mb-binding-proof:v1:nonce123:\(challenge)".utf8)))
        XCTAssertTrue(BindingVerifier.isValidProof(proof, ik: ik, jti: "nonce123", challenge: challenge))
        XCTAssertFalse(BindingVerifier.isValidProof(proof, ik: ik, jti: "nonce123", challenge: "other"))
        let impostor = Base64URL.encode(try Curve25519.Signing.PrivateKey().signature(for: Data("mb-binding-proof:v1:nonce123:\(challenge)".utf8)))
        XCTAssertFalse(BindingVerifier.isValidProof(impostor, ik: ik, jti: "nonce123", challenge: challenge))
    }

    func testTheRedeemRequestSpeaksSnakeCase() throws {
        let json = try JSONEncoder.medbrains.encode(RedeemRequest(token: "t", deviceLabel: "d", appVariant: "Mobile-Staff", publicKeyPem: "p", challenge: "c"))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: json) as? [String: String])
        XCTAssertEqual(Set(object.keys), ["token", "device_label", "app_variant", "public_key_pem", "challenge"])
    }

    func testThePinIsTheSPKIHashOfTheServerKey() throws {
        let server = P256.Signing.PrivateKey().publicKey
        let attributes: [CFString: Any] = [kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom, kSecAttrKeyClass: kSecAttrKeyClassPublic]
        let secKey = try XCTUnwrap(SecKeyCreateWithData(server.x963Representation as CFData, attributes as CFDictionary, nil))
        XCTAssertEqual(SPKIPinningDelegate.spkiHash(of: secKey), Data(SHA256.hash(data: server.derRepresentation)).base64EncodedString())
    }
}
