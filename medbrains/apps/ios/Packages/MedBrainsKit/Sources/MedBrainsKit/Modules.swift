import SwiftUI

/// A module a signed-in person may see. Mirrors mobile-shell's `Module`:
/// `requiredPermissions` are all needed, `requiredAnyPermissions` one of;
/// `appCodes` restricts the module to surfaces; order in the registry is
/// where a role lands on launch.
public struct AppModule: Identifiable, Sendable {
    public let id: String
    public let displayName: String
    public let symbol: String
    public let requiredPermissions: [String]
    public let requiredAnyPermissions: [String]
    public let appCodes: [String]
    public let home: @MainActor @Sendable () -> AnyView

    public init(
        id: String,
        displayName: String,
        symbol: String,
        requiredPermissions: [String],
        requiredAnyPermissions: [String] = [],
        appCodes: [String] = [],
        home: @escaping @MainActor @Sendable () -> AnyView
    ) {
        self.id = id
        self.displayName = displayName
        self.symbol = symbol
        self.requiredPermissions = requiredPermissions
        self.requiredAnyPermissions = requiredAnyPermissions
        self.appCodes = appCodes
        self.home = home
    }

    /// mobile-shell `userHasModuleAccess`, verbatim in intent: nobody signed in
    /// sees nothing; an ungated module is open; bypass roles see everything;
    /// otherwise every required code and, when listed, one of the any-of codes.
    public func isAccessible(to identity: TenantIdentity?) -> Bool {
        guard let identity else { return false }
        if requiredPermissions.isEmpty && requiredAnyPermissions.isEmpty { return true }
        if identity.isBypassRole { return true }
        let owned = Set(identity.permissions)
        let hasAll = requiredPermissions.allSatisfy(owned.contains)
        let hasAny = requiredAnyPermissions.isEmpty || requiredAnyPermissions.contains(where: owned.contains)
        return hasAll && hasAny
    }

    public func belongs(to appCode: String) -> Bool {
        appCodes.isEmpty || appCodes.contains(appCode)
    }
}

public extension Array where Element == AppModule {
    func accessible(to identity: TenantIdentity?) -> [AppModule] {
        filter { $0.isAccessible(to: identity) }
    }

    func forApp(_ appCode: String) -> [AppModule] {
        filter { $0.belongs(to: appCode) }
    }
}
