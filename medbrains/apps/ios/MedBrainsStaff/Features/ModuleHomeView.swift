import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One tab per permitted module, in registry order, so each role lands on
/// its own work. System TabView + NavigationStack only: on iPad the tab bar
/// adapts to a sidebar, and on iPhone Duo the bars move to the side without
/// a line of code here.
struct ModuleHomeView: View {
    let modules: [AppModule]
    /// The surface code that narrows the registry, or nil for the staff app,
    /// which shows every module the role may see (as its RN shell did).
    let appCode: String?
    @Environment(AuthStore.self) private var auth
    @State private var selection: String?

    private var visible: [AppModule] {
        let scoped = appCode.map(modules.forApp) ?? modules
        return scoped.accessible(to: auth.identity)
    }

    var body: some View {
        if visible.isEmpty {
            ContentUnavailableView {
                Label("Nothing assigned to you here", systemImage: "person.crop.circle.badge.questionmark")
            } description: {
                Text("Your role has no module on this app. Ask an administrator, or sign in on the right app.")
            } actions: {
                Button("Sign out") { Task { await auth.signOut() } }
            }
            .accessibilityIdentifier("nothing-assigned")
        } else {
            TabView(selection: $selection) {
                ForEach(visible) { module in
                    NavigationStack {
                        module.home()
                            .navigationTitle(module.displayName)
                            .toolbar {
                                ToolbarItem(placement: .topBarTrailing) {
                                    Menu {
                                        if let who = auth.identity {
                                            Text(who.fullName)
                                            Text(who.role ?? "").foregroundStyle(.secondary)
                                        }
                                        Button("Sign out", role: .destructive) { Task { await auth.signOut() } }
                                    } label: {
                                        Label("Account", systemImage: "person.crop.circle")
                                    }
                                }
                            }
                    }
                    .tabItem { Label(module.displayName, systemImage: module.symbol) }
                    .tag(Optional(module.id))
                }
            }
            .onAppear {
                if selection == nil { selection = LaunchArguments.module ?? visible.first?.id }
            }
        }
    }
}

/// `-module nurse` on launch opens that tab: the hook screenshot runs and
/// UI tests drive, invisible to a person.
enum LaunchArguments {
    static var module: String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-module"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
}

/// A module home not yet converted: says so, and shows what the role will get.
struct PlaceholderModuleHome: View {
    let module: AppModule
    let phase: Int

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow("Converting in phase \(phase)")
                    Text("\(module.displayName) keeps running on the current app until this screen lands natively.")
                        .font(CarbonType.body)
                        .foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(MedBrainsTheme.surface)
                .overlay(alignment: .leading) { Rectangle().fill(MedBrainsTheme.interactive).frame(width: 3) }
                .padding(16)

                CarbonSectionTitle("Surfaces")
                ForEach(module.appCodes, id: \.self) { CarbonRow($0, mono: true) }
                CarbonSectionTitle("Requires")
                ForEach(module.requiredPermissions, id: \.self) { CarbonRow($0, mono: true) }
            }
        }
        .background(MedBrainsTheme.canvas)
    }
}
