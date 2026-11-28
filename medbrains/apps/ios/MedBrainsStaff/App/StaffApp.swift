import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The staff app: sign in, then one tab per module the signed-in role may
/// see, in registry order. Everything the shell does (secrets, bearer
/// client, gating) lives in MedBrainsKit so the patient, camp and vendor
/// apps reuse it unchanged.
@main
struct StaffApp: App {
    @State private var shell: StaffShell

    init() {
        CarbonType.register()
        _shell = State(initialValue: StaffShell())
    }

    var body: some Scene {
        WindowGroup {
            RootView(modules: StaffModules.registry, appCode: nil)
                .environment(shell.auth)
                .environment(shell)
                .environment(\.apiClient, shell.client)
                .tint(MedBrainsTheme.interactive)
                // A new hospital binding brings a new store: hydrate it too.
                .task(id: ObjectIdentifier(shell.auth)) { await shell.auth.hydrate() }
        }
    }
}

/// The client and session for whichever hospital this app is bound to. A
/// signed hospital QR changes the server, so binding rebuilds both — the old
/// client must never carry a request to the new hospital or back.
@MainActor
@Observable
final class StaffShell {
    static let surface = "Mobile-Staff"
    static let clientVariant = "staff"

    let secrets = SecretStore(service: "com.medbrains.staff")
    private(set) var binding: HospitalBinding?
    private(set) var client: ApiClient
    private(set) var auth: AuthStore

    init() {
        let binding = try? secrets.readBinding()
        let client = Self.makeClient(binding: binding, secrets: secrets)
        self.binding = binding
        self.client = client
        auth = AuthStore(client: client, secrets: secrets)
    }

    var binder: HospitalBinder { HospitalBinder(secrets: secrets) }

    /// Adopt a fresh binding: its hospital is the one sign-in starts from.
    func bound(to binding: HospitalBinding) {
        auth.rememberHospital(binding.tenant)
        rebuild(binding)
    }

    /// "Forget this hospital": back to typing a code, on the default server.
    func forget() {
        try? secrets.deleteBinding()
        auth.forgetHospital()
        rebuild(nil)
    }

    private func rebuild(_ binding: HospitalBinding?) {
        self.binding = binding
        client = Self.makeClient(binding: binding, secrets: secrets)
        auth = AuthStore(client: client, secrets: secrets)
    }

    private static func makeClient(binding: HospitalBinding?, secrets: SecretStore) -> ApiClient {
        ApiClient(
            baseURL: AppConfig.baseURL(binding: binding),
            variant: clientVariant,
            secrets: secrets,
            session: SPKIPinningDelegate.session(pin: binding?.spki)
        )
    }
}

/// Where the hospital lives. `-baseURL` on launch overrides in Debug builds
/// only (simulator runs and UI tests); then the hospital this app is bound to;
/// else the local dev server, which an unbound shipped app cannot reach anyway.
enum AppConfig {
    static let devServer = URL(string: "http://127.0.0.1:3000")!

    /// The server for this launch, given the hospital the device is bound to.
    static func baseURL(binding: HospitalBinding?) -> URL {
        chooseServerURL(
            debugOverride: debugBaseURL(), boundApiBase: binding?.apiBase, buildDefault: nil)
            ?? devServer
    }

    /// The `-baseURL` launch argument, read in Debug builds only.
    private static func debugBaseURL() -> String? {
        #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            guard let i = args.firstIndex(of: "-baseURL"), i + 1 < args.count else { return nil }
            return args[i + 1]
        #else
            return nil
        #endif
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
