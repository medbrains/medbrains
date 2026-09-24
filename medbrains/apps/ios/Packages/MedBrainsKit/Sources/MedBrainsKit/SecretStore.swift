import Foundation
import Security

/// Keys the shell keeps in the Keychain. Mirrors mobile-shell's SECRET_KEYS.
public enum SecretKey: String, Sendable {
    case jwt = "medbrains.jwt"
    case refreshToken = "medbrains.refresh_token"
    case nodeSecret = "medbrains.node_secret"
    case campKey = "medbrains.camp_key"
}

/// Keychain-backed secrets, `WhenUnlockedThisDeviceOnly`: readable only while
/// the device is unlocked and never included in a backup. The React Native
/// shell stored the JWT with exactly this accessibility; a token that lives
/// for weeks on hardware that gets lost or lent must not be easier to reach.
public struct SecretStore: Sendable {
    public let service: String

    public init(service: String = "com.medbrains") {
        self.service = service
    }

    public func read(_ key: SecretKey) throws -> String? {
        var query = base(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = out as? Data else { throw SecretStoreError(status: status) }
        return String(decoding: data, as: UTF8.self)
    }

    public func write(_ key: SecretKey, _ value: String) throws {
        let data = Data(value.utf8)
        var query = base(key)
        let update: [String: Any] = [kSecValueData as String: data]
        var status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(query as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw SecretStoreError(status: status) }
    }

    public func delete(_ key: SecretKey) throws {
        let status = SecItemDelete(base(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw SecretStoreError(status: status) }
    }

    private func base(_ key: SecretKey) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
    }
}

public struct SecretStoreError: Error, Sendable {
    public let status: OSStatus
}
