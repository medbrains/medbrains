import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Sign-in on the Carbon grid, in the hospital's own terms: first which
/// hospital (its code, remembered on this device), then how that hospital
/// signs in — username and password when it accepts them. Layout is the
/// platform's (safe areas, keyboard avoidance, Dynamic Type); Carbon owns
/// colour, type and shape.
struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @State private var hospitalCode = ""
    @State private var hospital: SignInOptions?
    @State private var lookupProblem: String?
    @State private var isLooking = false
    @State private var username = ""
    @State private var password = ""
    @State private var isSigningIn = false
    /// Passwords off at this hospital: its break-glass administrator may still.
    @State private var breakGlass = false
    @FocusState private var focus: Field?

    private enum Field { case hospitalCode, username, password }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                BrandWordmark()
                    .padding(.top, 48)
                Text("Sign in")
                    .font(CarbonType.heading05)
                    .foregroundStyle(MedBrainsTheme.ink)
                    .padding(.top, 8)
                Text(hospital?.name ?? "Start with your hospital.")
                    .font(CarbonType.body)
                    .foregroundStyle(MedBrainsTheme.inkSecondary)
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                    .accessibilityIdentifier("hospitalName")
                if let hospital { credentials(for: hospital) } else { hospitalStep }
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(MedBrainsTheme.canvas)
        .task {
            // A code that signed in here before opens that hospital directly.
            guard hospital == nil, !auth.rememberedHospitalCode.isEmpty else { focus = .hospitalCode; return }
            hospitalCode = auth.rememberedHospitalCode
            await lookUp()
        }
    }

    private var hospitalStep: some View {
        VStack(alignment: .leading, spacing: 24) {
            CarbonField("Hospital code", helper: "The code your hospital gave you.", error: lookupProblem, isFocused: focus == .hospitalCode) {
                TextField("Hospital code", text: $hospitalCode)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .submitLabel(.continue)
                    .focused($focus, equals: .hospitalCode)
                    .onSubmit { Task { await lookUp() } }
                    .accessibilityIdentifier("Hospital code")
            }
            primaryButton(isLooking ? "Checking…" : "Continue", busy: isLooking, id: "hospitalContinue") { await lookUp() }
                .disabled(hospitalCode.trimmingCharacters(in: .whitespaces).isEmpty || isLooking)
        }
    }

    @ViewBuilder
    private func credentials(for hospital: SignInOptions) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            if hospital.password || breakGlass {
                CarbonField("Username or email", isFocused: focus == .username) {
                    TextField("Username or email", text: $username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .submitLabel(.next)
                        .focused($focus, equals: .username)
                        .onSubmit { focus = .password }
                        .accessibilityIdentifier("Username or email")
                }
                CarbonField("Password", error: auth.lastError, isFocused: focus == .password) {
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .focused($focus, equals: .password)
                        .onSubmit { Task { await signIn(hospital) } }
                        .accessibilityIdentifier("Password")
                }
                primaryButton(isSigningIn ? "Signing in…" : "Sign in", busy: isSigningIn, id: "signIn") { await signIn(hospital) }
                    .disabled(username.isEmpty || password.isEmpty || isSigningIn)
            } else {
                CarbonNotification(
                    kind: .info,
                    title: "\(hospital.name) signs in with \(hospital.providers.first?.name ?? "single sign-on")",
                    message: hospital.providers.isEmpty
                        ? "Sign-in isn't set up for this hospital yet. Ask your IT desk."
                        : "That sign-in isn't in this app yet. Use \(hospital.name)'s web address, or ask your IT desk."
                )
                Button("Administrator? Use a password") { breakGlass = true; focus = .username }
                    .buttonStyle(.carbonGhost)
                    .accessibilityIdentifier("breakGlass")
            }
            Button("Not \(hospital.name)? Change hospital") {
                auth.forgetHospital()
                self.hospital = nil
                breakGlass = false
                focus = .hospitalCode
            }
            .buttonStyle(.carbonGhost)
            .accessibilityIdentifier("changeHospital")
        }
        .onAppear { focus = .username }
    }

    private func primaryButton(_ title: String, busy: Bool, id: String, action: @escaping () async -> Void) -> some View {
        Button { Task { await action() } } label: {
            HStack {
                Text(title)
                Spacer()
                if busy { ProgressView().tint(MedBrainsTheme.inkInverse) } else { Image(systemName: "arrow.right") }
            }
        }
        .buttonStyle(.carbonPrimary)
        .accessibilityIdentifier(id)
        .padding(.top, 8)
    }

    private func lookUp() async {
        isLooking = true
        defer { isLooking = false }
        switch await auth.lookUpHospital(hospitalCode) {
        case .found(let options):
            lookupProblem = nil
            hospital = options
        case .unknown:
            lookupProblem = "No hospital uses the code \"\(hospitalCode.trimmingCharacters(in: .whitespaces))\". Check it with your IT desk."
        case .failed(let message):
            lookupProblem = "\(message) This is a connection problem, not a wrong code."
        }
    }

    private func signIn(_ hospital: SignInOptions) async {
        guard !username.isEmpty, !password.isEmpty else { return }
        isSigningIn = true
        defer { isSigningIn = false }
        _ = await auth.signIn(username: username, password: password, hospitalCode: hospital.code)
    }
}
