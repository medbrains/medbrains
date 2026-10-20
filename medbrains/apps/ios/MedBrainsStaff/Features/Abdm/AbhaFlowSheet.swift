import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// "Verify ABHA" or "Create ABHA", in a sheet over the screen that asked —
/// registration or a patient's record — so closing it (Back) leaves that
/// screen exactly as it was. Nothing typed here outlives the sheet.
struct AbhaFlowSheet: View {
    enum Mode: String, Identifiable {
        case verify, create
        var id: String { rawValue }
    }

    let mode: Mode
    /// The patient's details as they are now, for the side-by-side check.
    let ours: OurDetails
    /// The mobile on the form, offered for a new ABHA.
    var mobile = ""
    /// "Use for this registration" or "Link to this patient".
    let confirmLabel: String
    /// Answers a failure to show, or nil when done (the sheet then closes).
    let onConfirm: @MainActor (AbhaConfirmation) async -> String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch mode {
                    case .verify: AbhaVerifyFlow(ours: ours, confirmLabel: confirmLabel, onConfirm: confirm)
                    case .create: AbhaCreateFlow(ours: ours, mobile: mobile, confirmLabel: confirmLabel, onConfirm: confirm)
                    }
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(MedBrainsTheme.canvas)
            .navigationTitle(mode == .verify ? "Verify ABHA" : "Create ABHA").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.accessibilityIdentifier("abha-close") } }
            .accessibilityIdentifier("abha-\(mode.rawValue)-sheet")
        }
    }

    private func confirm(_ c: AbhaConfirmation) async -> String? {
        let failure = await onConfirm(c)
        if failure == nil { dismiss() }
        return failure
    }
}

/// Find the person's ABHA by number, mobile or address; they read out the
/// OTP ABDM sends them; the desk compares and chooses.
private struct AbhaVerifyFlow: View {
    let ours: OurDetails
    let confirmLabel: String
    let onConfirm: @MainActor (AbhaConfirmation) async -> String?
    @Environment(\.apiClient) private var client
    @State private var flow = AbhaFlowState()
    @State private var method = AbhaVerifyMethod.abhaNumber
    @State private var via = AbhaOtpVia.aadhaar
    @State private var value = ""
    @State private var chosen: String?
    @State private var tried = false
    @FocusState private var focused: Bool

    var body: some View {
        AbhaFailureNote(message: flow.failure)
        switch flow.step?.stageKind {
        case nil: lookup
        case .otpSent?: otpStep
        case .chooseAccount?: accounts
        default:
            if let step = flow.step, let profile = step.profile {
                AbhaVerifiedSection(step: step, profile: profile, ours: ours, confirmLabel: confirmLabel, onConfirm: onConfirm)
            }
        }
    }

    private var lookup: some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker("Find the ABHA by", selection: $method) {
                ForEach(AbhaVerifyMethod.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented).accessibilityIdentifier("abha-method")
            CarbonField(method == .abhaAddress ? "ABHA address (e.g. priya.v@abdm)" : method == .mobile ? "Mobile number" : "ABHA number (14 digits)", error: tried ? Abha.lookupProblem(method, value) : nil, isFocused: focused) {
                TextField(method.label, text: $value).keyboardType(method == .abhaAddress ? .emailAddress : .numberPad)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().focused($focused)
                    .accessibilityIdentifier("abha-lookup-value")
            }
            if method != .mobile {
                Text("Send the OTP to").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                Picker("Send the OTP to", selection: $via) {
                    Text("Aadhaar mobile").tag(AbhaOtpVia.aadhaar)
                    Text("ABHA mobile").tag(AbhaOtpVia.abdm)
                }
                .pickerStyle(.segmented).accessibilityIdentifier("abha-otp-via")
            }
            Button {
                tried = true
                guard Abha.lookupProblem(method, value) == nil, let client else { return }
                Task { await flow.run { try await AbhaApi(client: client).start(method, value: value, via: via) } }
            } label: { HStack { Text("Send OTP"); Spacer(); Image(systemName: "arrow.right") } }
                .buttonStyle(.carbonPrimary).disabled(flow.busy).accessibilityIdentifier("abha-send-otp")
        }
    }

    private var otpStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(flow.step?.message ?? "ABDM has sent the patient an OTP.").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            AbhaOtpField(otp: $flow.otp)
            Button {
                guard let client, let id = flow.step?.id else { return }
                Task { await flow.run { try await AbhaApi(client: client).submitOtp(id, otp: flow.otp) } }
            } label: { HStack { Text("Verify"); Spacer(); Image(systemName: "checkmark") } }
                .buttonStyle(.carbonPrimary).disabled(flow.busy || flow.otp.count != Abha.otpLength).accessibilityIdentifier("abha-verify-otp")
            Button(Abha.resendLabel(wait: flow.wait)) {
                guard let client, let id = flow.step?.id else { return }
                Task { await flow.run { try await AbhaApi(client: client).resend(id) } }
            }
            .buttonStyle(.carbonGhost).disabled(flow.busy || flow.wait > 0).accessibilityIdentifier("abha-resend")
        }
        .task(id: flow.sent) { await flow.countDown() }
    }

    private var accounts: some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonSectionTitle("Several ABHAs use this mobile — which is the patient's?")
            ForEach(flow.step?.accounts ?? [], id: \.abhaNumber) { a in
                Button { chosen = a.abhaNumber } label: {
                    CarbonRow("\(a.name ?? "Unnamed") · \(a.abhaNumber)", detail: [a.abhaAddress, a.gender, a.yearOfBirth].compactMap { $0 }.joined(separator: " · ")) {
                        Image(systemName: chosen == a.abhaNumber ? "largecircle.fill.circle" : "circle").foregroundStyle(MedBrainsTheme.interactive)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(chosen == a.abhaNumber ? .isSelected : [])
                .accessibilityIdentifier("abha-account-\(a.abhaNumber)")
            }
            Button("Continue") {
                guard let client, let id = flow.step?.id, let chosen else { return }
                Task { await flow.run { try await AbhaApi(client: client).chooseAccount(id, abhaNumber: chosen) } }
            }
            .buttonStyle(.carbonPrimary).disabled(chosen == nil || flow.busy).accessibilityIdentifier("abha-account-continue")
        }
    }
}

/// Create an ABHA with the patient's Aadhaar: consent read out, Aadhaar OTP,
/// the mobile for the ABHA (its own OTP if not the Aadhaar one), an address.
/// If they already have one, ABDM answers with it.
private struct AbhaCreateFlow: View {
    let ours: OurDetails
    let mobile: String
    let confirmLabel: String
    let onConfirm: @MainActor (AbhaConfirmation) async -> String?
    @Environment(\.apiClient) private var client
    @State private var flow = AbhaFlowState()
    @State private var consent = false
    /// Held only while the first OTP is outstanding; never stored or logged.
    @State private var aadhaar = ""
    @State private var abhaMobile = ""
    @State private var address = ""
    @FocusState private var focused: Bool

    var body: some View {
        AbhaFailureNote(message: flow.failure)
        switch flow.step?.stageKind {
        case nil: consentStep
        case .otpSent?: aadhaarOtpStep
        case .mobileOtpSent?: mobileOtpStep
        case .chooseAddress?: addressStep
        default:
            if let step = flow.step, let profile = step.profile {
                AbhaVerifiedSection(step: step, profile: profile, ours: ours, confirmLabel: confirmLabel, onConfirm: onConfirm)
            }
        }
    }

    private func run(_ op: @escaping @Sendable (AbhaApi) async throws -> AbhaVerificationStep) {
        guard let client else { return }
        Task {
            await flow.run { try await op(AbhaApi(client: client)) }
            // Not needed past the first OTP: dropped as soon as it is used.
            if flow.step?.stageKind != .otpSent { aadhaar = "" }
        }
    }

    private var consentStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            CarbonNotification(kind: .info, title: "Read this to the patient", message: "Your Aadhaar number will be used only to create your Ayushman Bharat Health Account (ABHA) with the National Health Authority. An OTP goes to the mobile linked to your Aadhaar. This hospital does not keep your Aadhaar number. Having an ABHA is your choice; you can be treated without one.")
            Toggle("The patient agrees to create their ABHA with Aadhaar", isOn: $consent).font(CarbonType.body).tint(MedBrainsTheme.interactive)
                .accessibilityIdentifier("abha-consent")
            CarbonField("Aadhaar number", helper: "12 digits. Sent to ABDM encrypted; not saved here.", isFocused: focused) {
                SecureField("12 digits", text: Binding(get: { aadhaar }, set: { aadhaar = Abha.aadhaarInput($0) }))
                    .keyboardType(.numberPad).textContentType(.none).privacySensitive().focused($focused)
                    .accessibilityIdentifier("abha-aadhaar")
            }
            Button { run { [aadhaar, consent] in try await $0.startEnrolment(aadhaar: aadhaar, consent: consent) } } label: {
                HStack { Text("Send OTP to the Aadhaar mobile"); Spacer(); Image(systemName: "arrow.right") }
            }
            .buttonStyle(.carbonPrimary).disabled(!consent || aadhaar.count != Abha.aadhaarLength || flow.busy).accessibilityIdentifier("abha-aadhaar-send")
        }
        .onAppear { if abhaMobile.isEmpty { abhaMobile = Abha.mobile(mobile) ?? "" } }
    }

    private var aadhaarOtpStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(flow.step?.message ?? "ABDM has sent an OTP to the Aadhaar mobile.").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            AbhaOtpField(otp: $flow.otp)
            CarbonField("Mobile for the ABHA", helper: "If this is not the Aadhaar-linked mobile, it gets its own OTP next.", isFocused: false) {
                TextField("10 digits", text: Binding(get: { abhaMobile }, set: { abhaMobile = Abha.mobileInput($0) })).keyboardType(.numberPad)
                    .accessibilityIdentifier("abha-mobile")
            }
            Button("Create ABHA") {
                guard let id = flow.step?.id else { return }
                run { [otp = flow.otp, abhaMobile] in try await $0.enrolmentOtp(id, otp: otp, mobile: abhaMobile) }
            }
            .buttonStyle(.carbonPrimary).disabled(flow.busy || flow.otp.count != Abha.otpLength || abhaMobile.count != Abha.mobileLength).accessibilityIdentifier("abha-create")
            Button("Send the OTP again") { run { [aadhaar, consent] in try await $0.startEnrolment(aadhaar: aadhaar, consent: consent) } }
                .buttonStyle(.carbonGhost).disabled(flow.busy || aadhaar.count != Abha.aadhaarLength)
        }
    }

    private var mobileOtpStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(flow.step?.message ?? "ABDM has sent an OTP to the new mobile.").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
            AbhaOtpField(otp: $flow.otp)
            Button("Verify mobile") {
                guard let id = flow.step?.id else { return }
                run { [otp = flow.otp] in try await $0.enrolmentMobileOtp(id, otp: otp) }
            }
            .buttonStyle(.carbonPrimary).disabled(flow.busy || flow.otp.count != Abha.otpLength).accessibilityIdentifier("abha-verify-mobile")
        }
    }

    private var addressStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            CarbonSectionTitle("Choose an ABHA address — the patient's easy-to-remember health ID")
            ForEach(flow.step?.suggestions ?? [], id: \.self) { s in
                Button { address = s } label: {
                    CarbonRow(s, mono: true) { Image(systemName: address == s ? "largecircle.fill.circle" : "circle").foregroundStyle(MedBrainsTheme.interactive) }
                }
                .buttonStyle(.plain).accessibilityAddTraits(address == s ? .isSelected : [])
            }
            CarbonField("Or type one", helper: "Letters, numbers, dot or underscore. ABDM adds the @ part.", error: address.isEmpty ? nil : Abha.addressProblem(address), isFocused: false) {
                TextField("priya.v", text: Binding(get: { address }, set: { address = $0.trimmingCharacters(in: .whitespaces) }))
                    .textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("abha-address")
            }
            Button("Create ABHA address") {
                guard let id = flow.step?.id else { return }
                run { [address] in try await $0.chooseAddress(id, address: address) }
            }
            .buttonStyle(.carbonPrimary).disabled(flow.busy || Abha.addressProblem(address) != nil).accessibilityIdentifier("abha-address-create")
        }
    }
}

/// The last step of Verify and Create: compare, the card, use it.
struct AbhaVerifiedSection: View {
    let step: AbhaVerificationStep
    let profile: AbhaVerifiedProfile
    let ours: OurDetails
    let confirmLabel: String
    let onConfirm: @MainActor (AbhaConfirmation) async -> String?
    /// Registration takes ABHA's where ours differs; an existing record keeps ours until chosen.
    var startWithAbha = true
    var oursLabel = "On our form"
    @State private var apply: Set<AbhaField>?
    @State private var image: AbhaImageSheet.Kind?
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        let chosen = apply ?? (startWithAbha ? Abha.defaultApply(profile, ours: ours) : [])
        VStack(alignment: .leading, spacing: 16) {
            if let message = step.message { Text(message).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary) }
            AbhaCompareView(profile: profile, ours: ours, apply: Binding(get: { chosen }, set: { apply = $0 }), oursLabel: oursLabel)
            HStack(spacing: 8) {
                Button("ABHA card") { image = .card }.buttonStyle(.carbonTertiary).accessibilityIdentifier("abha-show-card")
                Button("Show QR") { image = .qr }.buttonStyle(.carbonGhost).accessibilityIdentifier("abha-show-qr")
            }
            if let linked = step.alreadyLinked {
                CarbonNotification(kind: .warning, title: "This ABHA is already on another patient", message: "It belongs to \(linked.name) (\(linked.uhid)). Open that record instead of registering the patient again.")
                    .accessibilityIdentifier("abha-already-linked")
            } else {
                if let failure { CarbonNotification(kind: .error, title: "Not done", message: failure) }
                Button {
                    Task {
                        busy = true
                        failure = await onConfirm(AbhaConfirmation(verificationId: step.id, profile: profile, apply: chosen))
                        busy = false
                    }
                } label: { HStack { Text(confirmLabel); Spacer(); Image(systemName: "arrow.right") } }
                    .buttonStyle(.carbonPrimary).disabled(busy).accessibilityIdentifier("abha-confirm")
            }
        }
        .sheet(item: $image) { AbhaImageSheet(kind: $0, verificationId: step.id) }
    }
}
