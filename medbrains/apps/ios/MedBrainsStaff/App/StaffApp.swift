import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The staff app: sign in, then one tab per module the signed-in role may
/// see, in registry order. Everything the shell does (secrets, bearer
/// client, gating) lives in MedBrainsKit so the patient, camp and vendor
/// apps reuse it unchanged.
@main
struct StaffApp: App {
    @State private var auth: AuthStore
    private let client: ApiClient

    init() {
        CarbonType.register()
        let secrets = SecretStore(service: "com.medbrains.staff")
        let client = ApiClient(baseURL: AppConfig.baseURL, variant: "staff", secrets: secrets)
        self.client = client
        _auth = State(initialValue: AuthStore(client: client, secrets: secrets))
    }

    var body: some Scene {
        WindowGroup {
            RootView(modules: StaffModules.registry, appCode: nil)
                .environment(auth)
                .environment(\.apiClient, client)
                .tint(MedBrainsTheme.interactive)
                .task { await auth.hydrate() }
        }
    }
}

/// Where the hospital lives. `-baseURL` on launch overrides (simulator runs
/// and UI tests); the default is the local dev server.
enum AppConfig {
    static var baseURL: URL {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-baseURL"), i + 1 < args.count, let url = URL(string: args[i + 1]) {
            return url
        }
        return URL(string: "http://127.0.0.1:3000")!
    }
}

private struct ApiClientKey: EnvironmentKey {
    static let defaultValue: ApiClient? = nil
}

extension EnvironmentValues {
    var apiClient: ApiClient? {
        get { self[ApiClientKey.self] }
        set { self[ApiClientKey.self] = newValue }
    }
}

struct RootView: View {
    let modules: [AppModule]
    let appCode: String?
    @Environment(AuthStore.self) private var auth

    var body: some View {
        if auth.isHydrating {
            ProgressView("Opening MedBrains")
                .accessibilityLabel("Opening MedBrains")
        } else if auth.identity == nil {
            LoginView()
        } else {
            ModuleHomeView(modules: modules, appCode: appCode)
                .overlay { EmergencyFlashOverlay() }
        }
    }
}
