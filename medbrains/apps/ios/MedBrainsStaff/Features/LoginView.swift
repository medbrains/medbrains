import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Sign-in on the Carbon grid: eyebrow, a light heading-05, two Field-01
/// inputs with the return key advancing username → password → submit, an
/// inline error that says what to do, one full-width primary action with
/// its glyph on the right. Layout is still the platform's (safe areas,
/// keyboard avoidance, Dynamic Type); Carbon owns colour, type and shape.
struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @State private var username = ""
    @State private var password = ""
    @State private var isSigningIn = false
    @FocusState private var focus: Field?

    private enum Field { case username, password }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                BrandWordmark()
                    .padding(.top, 48)
                Text("Sign in")
                    .font(CarbonType.heading05)
                    .foregroundStyle(MedBrainsTheme.ink)
                    .padding(.top, 8)
                Text("Use the account your hospital gave you.")
                    .font(CarbonType.body)
                    .foregroundStyle(MedBrainsTheme.inkSecondary)
                    .padding(.top, 8)
                    .padding(.bottom, 40)

                VStack(alignment: .leading, spacing: 24) {
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
                            .onSubmit { Task { await submit() } }
                            .accessibilityIdentifier("Password")
                    }
                }

                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        Text(isSigningIn ? "Signing in…" : "Sign in")
                        Spacer()
                        if isSigningIn {
                            ProgressView().tint(MedBrainsTheme.inkInverse)
                        } else {
                            Image(systemName: "arrow.right")
                        }
                    }
                }
                .buttonStyle(.carbonPrimary)
                .disabled(username.isEmpty || password.isEmpty || isSigningIn)
                .accessibilityIdentifier("signIn")
                .padding(.top, 32)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(MedBrainsTheme.canvas)
        .onAppear { focus = .username }
    }

    private func submit() async {
        guard !username.isEmpty, !password.isEmpty else { return }
        isSigningIn = true
        defer { isSigningIn = false }
        _ = await auth.signIn(username: username, password: password)
    }
}
