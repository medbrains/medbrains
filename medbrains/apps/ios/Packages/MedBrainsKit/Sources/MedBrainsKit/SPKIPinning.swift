import CryptoKit
import Foundation
import Security

/// Pins TLS to one server key: the SHA-256 of the leaf certificate's
/// SubjectPublicKeyInfo, base64 (the `sha256/` format OkHttp and HPKP use).
/// The system trust evaluation still has to pass; the pin narrows it to the
/// one key the hospital's QR named, so a mis-issued certificate is refused.
public final class SPKIPinningDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
    private let pin: String

    public init(pin: String) {
        self.pin = pin
    }

    /// A session pinned to `pin`; with no pin (a plain-HTTP dev server) the shared one.
    public static func session(pin: String?) -> URLSession {
        guard let pin, !pin.isEmpty else { return .shared }
        return URLSession(configuration: .ephemeral, delegate: SPKIPinningDelegate(pin: pin), delegateQueue: nil)
    }

    public func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              SecTrustEvaluateWithError(trust, nil),
              let leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first,
              let key = SecCertificateCopyKey(leaf),
              Self.spkiHash(of: key) == pin
        else { return (.cancelAuthenticationChallenge, nil) }
        return (.useCredential, URLCredential(trust: trust))
    }

    /// base64(SHA-256(SPKI DER)) for the key types hospital servers use.
    static func spkiHash(of key: SecKey) -> String? {
        guard let attributes = SecKeyCopyAttributes(key) as? [CFString: Any],
              let type = attributes[kSecAttrKeyType] as? String,
              let bits = attributes[kSecAttrKeySizeInBits] as? Int,
              let header = SPKIHeader.for(type: type, bits: bits),
              let raw = SecKeyCopyExternalRepresentation(key, nil) as Data?
        else { return nil }
        return Data(SHA256.hash(data: header + raw)).base64EncodedString()
    }
}

/// ASN.1 prefixes that turn SecKey's raw export into SubjectPublicKeyInfo DER.
enum SPKIHeader {
    static let ecP256: [UInt8] = [0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01, 0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00]
    static let ecP384: [UInt8] = [0x30, 0x76, 0x30, 0x10, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01, 0x06, 0x05, 0x2B, 0x81, 0x04, 0x00, 0x22, 0x03, 0x62, 0x00]
    static let rsa2048: [UInt8] = [0x30, 0x82, 0x01, 0x22, 0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x82, 0x01, 0x0F, 0x00]
    static let rsa4096: [UInt8] = [0x30, 0x82, 0x02, 0x22, 0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x82, 0x02, 0x0F, 0x00]

    static func `for`(type: String, bits: Int) -> Data? {
        let ec = kSecAttrKeyTypeECSECPrimeRandom as String
        let rsa = kSecAttrKeyTypeRSA as String
        let known: [String: [UInt8]] = ["\(ec)/256": ecP256, "\(ec)/384": ecP384, "\(rsa)/2048": rsa2048, "\(rsa)/4096": rsa4096]
        return known["\(type)/\(bits)"].map { Data($0) }
    }
}
