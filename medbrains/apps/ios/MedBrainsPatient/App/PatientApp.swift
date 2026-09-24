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

/// Where the hospital lives, and which hospital. `-baseURL` and
/// `-hospitalCode` on launch override; the defaults are the local dev server
/// and its seeded tenant.
enum AppConfig {
    static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    static var baseURL: URL { URL(string: argument("-baseURL") ?? "http://127.0.0.1:3000")! }
    static var hospitalCode: String { argument("-hospitalCode") ?? "DEFAULT" }
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
