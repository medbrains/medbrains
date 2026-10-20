import MedBrainsKit
import MedBrainsUI
import SwiftUI
import UIKit

/// What a finished verification hands back: the proof's id, what ABDM
/// holds, and the details the desk chose to take from it.
struct AbhaConfirmation: Sendable {
    let verificationId: String
    let profile: AbhaVerifiedProfile
    let apply: Set<AbhaField>
}

/// One ABHA conversation with ABDM, step by step: the current step, the OTP
/// being typed, the resend pause, and what went wrong. Verify and Create
/// both run on it; neither keeps anything once the sheet closes.
@MainActor
@Observable
final class AbhaFlowState {
    var step: AbhaVerificationStep?
    var otp = ""
    var failure: String?
    var busy = false
    /// Seconds before ABDM will send another OTP.
    var wait = 0
    /// Bumped on every step, so the resend countdown restarts.
    private(set) var sent = 0

    func run(_ op: () async throws -> AbhaVerificationStep) async {
        busy = true
        failure = nil
        defer { busy = false }
        do {
            let next = try await op()
            otp = ""
            step = next
            wait = next.resendAfterSeconds ?? 0
            sent += 1
            UIAccessibility.post(notification: .screenChanged, argument: next.message)
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server."
        }
    }

    /// Counts the resend pause down, one second at a time, for as long as
    /// the step is on screen; the task dies with the view.
    func countDown() async {
        while wait > 0 {
            try? await Task.sleep(for: .seconds(1))
            if Task.isCancelled { return }
            wait -= 1
        }
    }
}

/// The OTP ABDM sent, as the person reads it out: digits only, six at most.
struct AbhaOtpField: View {
    @Binding var otp: String
    var id = "abha-otp"
    @FocusState private var focused: Bool

    var body: some View {
        CarbonField("OTP", helper: "Ask the patient to read it out.", isFocused: focused) {
            TextField("6 digits", text: Binding(get: { otp }, set: { otp = Abha.otpInput($0) }))
                .keyboardType(.numberPad).textContentType(.oneTimeCode).focused($focused)
                .accessibilityIdentifier(id)
        }
        .onAppear { focused = true }
    }
}

/// ABDM refused or could not be reached: said in ABDM's words.
struct AbhaFailureNote: View {
    let message: String?
    var body: some View {
        if let message { CarbonNotification(kind: .error, title: "ABDM said no", message: message).accessibilityIdentifier("abha-failure") }
    }
}

/// ABHA's details beside ours. Where they differ the desk chooses which to
/// keep — a local spelling may be deliberate; ABHA's comes from Aadhaar.
struct AbhaCompareView: View {
    let profile: AbhaVerifiedProfile
    let ours: OurDetails
    @Binding var apply: Set<AbhaField>
    var oursLabel = "On our form"

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                if let photo = profile.photo.flatMap({ Data(base64Encoded: $0) }).flatMap(UIImage.init(data:)) {
                    Image(uiImage: photo).resizable().scaledToFill().frame(width: 72, height: 88).clipped()
                        .accessibilityLabel("Photo on the ABHA, to confirm this is the patient")
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(profile.abhaNumber).font(CarbonType.code).foregroundStyle(MedBrainsTheme.ink).accessibilityIdentifier("abha-verified-number")
                    if let address = profile.abhaAddress { Text(address).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink) }
                    Text((profile.kycVerified ? "KYC verified with Aadhaar" : "Not KYC verified") + (profile.mobileMasked.map { " · mobile \($0)" } ?? ""))
                        .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
            }
            ForEach(Abha.compareRows(profile, ours: ours), id: \.field) { row in
                CarbonTile(tone: row.differs ? .warning : .neutral) {
                    Eyebrow(row.label)
                    Text("On ABHA: \(row.abha.isEmpty ? "—" : row.abha)").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                    Text("\(oursLabel): \(row.ours.isEmpty ? "—" : row.ours)").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                    if row.differs {
                        Picker("Which \(row.label.lowercased()) to keep", selection: keep(row.field)) {
                            Text("Keep ABHA's").tag(true)
                            Text("Keep ours").tag(false)
                        }
                        .pickerStyle(.segmented)
                        .accessibilityIdentifier("abha-keep-\(row.field.rawValue)")
                    } else {
                        Label(row.matches ? "Matches" : "Ours kept", systemImage: "checkmark").font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("abha-compare-\(row.field.rawValue)")
            }
        }
    }

    private func keep(_ field: AbhaField) -> Binding<Bool> {
        Binding(get: { apply.contains(field) }, set: { useAbha in
            if useAbha { apply.insert(field) } else { apply.remove(field) }
        })
    }
}

/// The ABHA card or its QR as ABDM renders it, with the system share sheet —
/// which prints, AirDrops or sends it to the patient's phone.
struct AbhaImageSheet: View {
    enum Kind: String, Identifiable {
        case card, qr
        var id: String { rawValue }
        var title: String { self == .card ? "ABHA card" : "ABHA QR" }
    }

    let kind: Kind
    let verificationId: String
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    @State private var image = Remote<Data>()

    var body: some View {
        NavigationStack {
            ScrollView {
                RemoteContentView(id: "abha-\(kind.rawValue)", state: image.state, unavailableTitle: "Couldn't load the \(kind.title)", unavailableMessage: "ABDM did not send it. Verify the ABHA again if the session has ended.", isEmpty: { UIImage(data: $0) == nil }, emptyTitle: "Nothing to show", emptyMessage: "ABDM sent no picture.", retry: { Task { await load() } }) { data in
                    if let ui = UIImage(data: data) {
                        let picture = Image(uiImage: ui)
                        VStack(spacing: 16) {
                            picture.resizable().scaledToFit().accessibilityLabel(kind.title)
                            ShareLink(item: picture, preview: SharePreview(kind.title, image: picture)) {
                                Label("Print or share", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(.carbonPrimary).accessibilityIdentifier("abha-image-share")
                        }
                        .padding(16)
                    }
                }
            }
            .background(MedBrainsTheme.canvas)
            .navigationTitle(kind.title).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .task { await load() }
        }
    }

    private func load() async {
        guard let client else { return }
        let api = AbhaApi(client: client)
        await image.load { [kind, verificationId] in kind == .card ? try await api.card(verificationId) : try await api.qr(verificationId) }
    }
}
