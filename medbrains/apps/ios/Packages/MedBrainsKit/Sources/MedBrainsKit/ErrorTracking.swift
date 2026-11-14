import CryptoKit
import Foundation
import Sentry

/// Crash and error reports, to the hospital's own Rustrak through its server.
/// Off unless the server says it is on. The phone never talks to the DSN host
/// (a hospital's Rustrak listens on 127.0.0.1): sentry-cocoa has no `tunnel`
/// option, so it is started with a DSN on the hospital server, whose tunnel
/// runs the Rust patient-data scrubber before forwarding to the ios project.
/// Mirrors apps/web/src/lib/error-tracking.ts.

/// `GET /api/public/error-tracking/config?app=ios`, before sign-in.
public struct ErrorTrackingConfig: Decodable, Sendable, Equatable {
    public let enabled: Bool
    public let dsn: String?
    public let environment: String?
    public let tunnelDsnPath: String?

    /// Builds a config by hand; the tests use it, the app decodes one.
    public init(enabled: Bool, dsn: String?, environment: String?, tunnelDsnPath: String?) {
        self.enabled = enabled
        self.dsn = dsn
        self.environment = environment
        self.tunnelDsnPath = tunnelDsnPath
    }

    /// The DSN the SDK starts with: on the hospital server, never the real
    /// DSN host. Nil — tracking off — unless the server named a project and a
    /// tunnel path and the server URL has a scheme and host.
    public func tunnelDSN(serverBase: URL) -> String? {
        guard enabled, dsn != nil, let path = tunnelDsnPath,
              let scheme = serverBase.scheme, let host = serverBase.host(percentEncoded: false)
        else { return nil }
        let port = serverBase.port.map { ":\($0)" } ?? ""
        return "\(scheme)://medbrains@\(host)\(port)\(path)"
    }
}

/// Starts, stops and tags the SDK. Main-actor state: the last identity seen,
/// applied once the SDK starts, since sign-in can finish before the config.
@MainActor
public enum ErrorTracking {
    private static var identity: TenantIdentity?

    /// Fetch the hospital's config and start the SDK on its tunnel — or stop
    /// it, for a hospital that has it off. A failed fetch is off.
    public static func configure(client: ApiClient) async {
        let config: ErrorTrackingConfig? = try? await client.request(.get, "/api/public/error-tracking/config?app=ios")
        guard let dsn = config?.tunnelDSN(serverBase: client.baseURL) else {
            if SentrySDK.isEnabled { SentrySDK.close() }
            return
        }
        SentrySDK.start { apply($0, dsn: dsn, environment: config?.environment) }
        setUser(identity)
    }

    /// Only a hash of the user id, the tenant and the role — never a name or email.
    public static func setUser(_ who: TenantIdentity?) {
        identity = who
        guard SentrySDK.isEnabled else { return }
        guard let who else {
            SentrySDK.setUser(nil)
            SentrySDK.configureScope { $0.removeTag(key: "tenant_id"); $0.removeTag(key: "role") }
            return
        }
        SentrySDK.setUser(User(userId: ErrorTrackingScrub.hashUserId(who.userId)))
        SentrySDK.configureScope { scope in
            scope.setTag(value: who.tenantId, key: "tenant_id")
            scope.setTag(value: who.role ?? "none", key: "role")
        }
    }

    /// Options that collect nothing about the person, the screen or the request.
    static func apply(_ options: Options, dsn: String, environment: String?) {
        options.dsn = dsn
        options.releaseName = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        if let environment { options.environment = environment }
        options.sendDefaultPii = false
        // No tracing or profiling: the tunnel keeps no spans, the server traces requests.
        options.tracesSampleRate = nil
        options.enableAutoPerformanceTracing = false
        options.enableCaptureFailedRequests = false
        #if canImport(UIKit)
        // A screen of a ward list is patient data: no pictures, no replays.
        options.attachScreenshot = false
        options.attachViewHierarchy = false
        options.sessionReplay.sessionSampleRate = 0
        options.sessionReplay.onErrorSampleRate = 0
        options.enableUserInteractionTracing = false
        #endif
        options.enableNetworkBreadcrumbs = true
        options.swiftAsyncStacktraces = true
        options.beforeBreadcrumb = ErrorTrackingScrub.breadcrumb
        options.beforeSend = ErrorTrackingScrub.event
    }
}

/// What the phone strips before a report leaves. Shape only, like the web's
/// error-tracking-scrub.ts: the server tunnel redacts names, UHIDs and phones
/// in text. This removes what has no reason to leave at all.
public enum ErrorTrackingScrub {
    /// Breadcrumb fields that say what kind of request or navigation it was.
    static let keptData: Set<String> = ["method", "status_code", "url", "from", "to"]
    /// Typed text and console lines can both hold patient data.
    static let droppedCategories: Set<String> = ["console", "ui.input"]

    /// A URL or path with no query or fragment, and record ids replaced by `:id`.
    public static func url(_ raw: String) -> String {
        let bare = String(raw.prefix { $0 != "?" && $0 != "#" })
        let pathStart = bare.range(of: "://").map { bare[$0.upperBound...].firstIndex(of: "/") } ?? bare.startIndex
        guard let pathStart else { return bare }
        let path = bare[pathStart...].split(separator: "/", omittingEmptySubsequences: false)
            .map { isRecordId($0) ? ":id" : String($0) }
            .joined(separator: "/")
        return bare[..<pathStart] + path
    }

    /// A path segment that is a UUID or holds four digits in a row.
    static func isRecordId(_ segment: Substring) -> Bool {
        UUID(uuidString: String(segment)) != nil || segment.range(of: "[0-9]{4,}", options: .regularExpression) != nil
    }

    /// Drop console and typed-text crumbs, `ui.*` messages (selectors carry
    /// element text), and every data field but the request's shape.
    public static func breadcrumb(_ crumb: Breadcrumb) -> Breadcrumb? {
        if droppedCategories.contains(crumb.category) { return nil }
        if crumb.category.hasPrefix("ui.") { crumb.message = nil }
        for (key, value) in crumb.data ?? [:] {
            let kept = keptData.contains(key) ? (value as? String).map(url) ?? value : nil
            crumb.setData(value: kept, key: key)
        }
        return crumb
    }

    /// The request reduced to method and scrubbed URL, the user to the id
    /// hash, extras, server name and device name removed.
    public static func event(_ event: Event) -> Event? {
        if let request = event.request {
            let kept = SentryRequest()
            kept.method = request.method
            kept.url = request.url.map(url)
            event.request = kept
        }
        event.user = event.user?.userId.map { User(userId: $0) }
        event.extra = nil
        event.serverName = nil
        event.context?["device"]?["name"] = nil
        event.breadcrumbs = event.breadcrumbs?.compactMap(breadcrumb)
        return event
    }

    /// The id a report carries for a user: the same hash the web and server use.
    public static func hashUserId(_ userId: String) -> String {
        SHA256.hash(data: Data(userId.utf8)).map { String(format: "%02x", $0) }.joined().prefix(32).description
    }
}
