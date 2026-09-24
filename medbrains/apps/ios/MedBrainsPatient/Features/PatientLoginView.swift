import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Sign in with a code sent to the phone on the patient's record. Two
/// steps: the number, then the code. "I already have a code" skips the
/// request — a person who got the SMS a minute ago and reopened the app
/// must not be made to ask again, and asking again retires the code they
/// hold. The verified code becomes a portal session: no role, no
/// permissions, refused by every staff route.
struct PatientLoginView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.portalApi) private var portal
    @State private var phone = ""
    @State private var code = ""
    @State private var codeStep = false
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                BrandWordmark().padding(.top, 48)
                Text(codeStep ? "Enter your code" : "Sign in").font(CarbonType.heading05).foregroundStyle(MedBrainsTheme.ink).padding(.top, 8)
                Text(codeStep ? "We sent a 6-digit code to \(phone)." : "Use the phone number your hospital has for you.")
                    .font(CarbonType.body).foregroundStyle(MedBrainsTheme.inkSecondary).padding(.top, 8).padding(.bottom, 40)
                VStack(alignment: .leading, spacing: 24) {
                    if codeStep {
                        CarbonField("Sign-in code", error: error, isFocused: focus == "code") {
                            TextField("6 digits", text: $code)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .focused($focus, equals: "code")
                                .accessibilityIdentifier("code")
                        }
                    } else {
                        CarbonField("Phone number", error: error, isFocused: focus == "phone") {
                            TextField("Phone number", text: $phone)
                                .keyboardType(.phonePad)
                                .textContentType(.telephoneNumber)
                                .focused($focus, equals: "phone")
                                .submitLabel(.next)
                                .accessibilityIdentifier("phone")
                        }
                    }
                }
                VStack(spacing: 8) {
                    if codeStep {
                        Button { Task { await verify() } } label: { HStack { Text("Sign in"); Spacer(); Image(systemName: "arrow.right") } }
                            .buttonStyle(.carbonPrimary).disabled(busy || code.count < 6).accessibilityIdentifier("verify")
                        Button("Use a different number") { codeStep = false; code = ""; error = nil }
                            .buttonStyle(.carbonGhost).disabled(busy).accessibilityIdentifier("changePhone")
                    } else {
                        Button { Task { await request() } } label: { HStack { Text("Send me a code"); Spacer(); Image(systemName: "arrow.right") } }
                            .buttonStyle(.carbonPrimary).disabled(busy || phone.trimmingCharacters(in: .whitespaces).count < 6).accessibilityIdentifier("sendCode")
                        Button("I already have a code") { codeStep = true; error = nil; focus = "code" }
                            .buttonStyle(.carbonGhost).disabled(busy || phone.trimmingCharacters(in: .whitespaces).count < 6).accessibilityIdentifier("haveCode")
                    }
                }
                .padding(.top, 32)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(MedBrainsTheme.canvas)
        .onAppear { focus = "phone" }
        .accessibilityIdentifier("screen-patient-login")
    }

    private func request() async {
        guard let portal else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await portal.requestCode(tenantCode: AppConfig.hospitalCode, phone: phone.trimmingCharacters(in: .whitespaces))
            codeStep = true
            focus = "code"
        } catch is ApiError {
            self.error = "Could not send the code. Check the number and try again."
        } catch {
            self.error = "Could not reach the hospital server."
        }
    }

    private func verify() async {
        guard let portal else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let session = try await portal.verifyCode(tenantCode: AppConfig.hospitalCode, phone: phone.trimmingCharacters(in: .whitespaces), code: code)
            // A patient has neither role nor permissions; left empty so nothing mistakes this for staff.
            let who = TenantIdentity(tenantId: session.tenantId, userId: session.patientId, username: phone, fullName: "You", role: nil, permissions: [], departmentIds: [])
            try await auth.adopt(token: session.token, identity: who)
        } catch let e as ApiError where e.status == 401 || e.status == 400 || e.status == 403 {
            self.error = "That code did not work. Check it, or ask for a new one."
        } catch {
            self.error = "Could not reach the hospital server."
        }
    }
}
