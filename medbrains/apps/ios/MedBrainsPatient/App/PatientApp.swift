import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The patient app: a code sent to the phone on the patient's record, then
/// the hospital's record of them — and, only when the hospital licensed it,
/// the daily companion. Everything the shell does (secrets, bearer client,
/// 401 sign-out) is MedBrainsKit, shared with the staff app unchanged.
@main
struct PatientApp: App {
    @State private var auth: AuthStore
    private let client: ApiClient

    init() {
        CarbonType.register()
        let secrets = SecretStore(service: "com.medbrains.patient")
        let client = ApiClient(baseURL: AppConfig.baseURL, variant: "patient", secrets: secrets)
        self.client = client
        _auth = State(initialValue: AuthStore(client: client, secrets: secrets))
    }

    var body: some Scene {
        WindowGroup {
            PatientRootView()
                .environment(auth)
                .environment(\.portalApi, PortalApi(client: client))
                .tint(MedBrainsTheme.interactive)
                .task { await auth.hydrate() }
        }
    }
}

/// Where the hospital lives, and which hospital. The server is the one this
/// build was made for (`MB_SERVER_URL`, which a Release build refuses to go
/// without unless it is https). `-baseURL` and `-hospitalCode` on launch
/// override in Debug builds only: in a shipped app anything that can launch it
/// could otherwise point the patient's session at its own server.
enum AppConfig {
    /// The hospital server; a build that names none stops here rather than guess.
    static var baseURL: URL {
        let built = Bundle.main.object(forInfoDictionaryKey: "MBServerURL") as? String
        guard
            let url = chooseServerURL(
                debugOverride: debugArgument("-baseURL"), boundApiBase: nil, buildDefault: built)
        else { fatalError("This build names no server: set MB_SERVER_URL") }
        return url
    }
    /// The hospital's code: the seeded tenant unless a Debug launch names another.
    static var hospitalCode: String { debugArgument("-hospitalCode") ?? "DEFAULT" }

    /// The value after `name` in the launch arguments, read in Debug builds only.
    private static func debugArgument(_ name: String) -> String? {
        #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
            return args[i + 1]
        #else
            return nil
        #endif
    }
}

private struct PortalApiKey: EnvironmentKey {
    static let defaultValue: PortalApi? = nil
}

extension EnvironmentValues {
    var portalApi: PortalApi? {
        get { self[PortalApiKey.self] }
        set { self[PortalApiKey.self] = newValue }
    }
}

struct PatientRootView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        if auth.isHydrating {
            ProgressView("Opening MedBrains").accessibilityLabel("Opening MedBrains")
        } else if auth.identity == nil {
            PatientLoginView()
        } else {
            PatientHomeView()
        }
    }
}
