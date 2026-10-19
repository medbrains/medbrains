import Foundation
import MedBrainsKit
import MedBrainsUI
import SwiftUI

// The patient's privacy controls (DPDP Act s.6(4), s.11-14): the notice in
// their language and the purposes they agree to — changeable here as easily
// as at the desk — what the hospital holds about them, and their requests.
// The notice text is `packages/privacy/dpdp-notice.json`, the same file the
// web reads; the server checks the version.

/// The notice, as bundled.
struct DpdpNotice: Decodable, Sendable {
    struct Text: Decodable, Sendable {
        let language: String
        let collected: String
        let purposesIntro: String
        let purposes: [String: String]
        let rights: String
    }

    let version: String
    let purposes: [String]
    let languages: [String: Text]

    /// Read once; a missing or malformed file is a build defect, so the screen
    /// says the notice is unavailable rather than inventing one.
    static let bundled: DpdpNotice? = {
        guard let url = Bundle.main.url(forResource: "dpdp-notice", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(DpdpNotice.self, from: data)
    }()
}

/// Languages in the order the notice offers them.
private let noticeLanguages = ["en", "hi", "ta"]
private let defaultLanguage = "en"

/// What a patient can ask for, in their words.
private let requestKinds: [(id: String, label: String)] = [
    ("access", "See what the hospital holds"),
    ("correction", "Correct or complete my data"),
    ("erasure", "Erase my data"),
    ("nominee", "Name a nominee"),
    ("grievance", "Make a privacy complaint"),
]
private let requestLabel = Dictionary(uniqueKeysWithValues: requestKinds.map { ($0.id, $0.label) })
/// What the downloaded record is called wherever the patient saves it.
private let exportFileName = "my-health-record.json"
/// Shorter than this is not yet a request anyone can act on (the server agrees).
private let minimumDetails = 5

struct PrivacyView: View {
    @Environment(\.portalApi) private var portal
    @State private var remote = Remote<PortalPrivacy>()
    @State private var language: String?
    @State private var choices: Set<String>?
    @State private var saving = false
    @State private var asking = false
    @State private var outcome: (kind: CarbonNotification<EmptyView>.Kind, title: String, message: String)?
    @State private var exporting = false
    /// The downloaded record, written to a temporary file the share sheet can hand on.
    @State private var exported: URL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Privacy", title: "Your privacy", subtitle: "How the hospital may use your information, and your rights.")
                if let outcome {
                    CarbonNotification(kind: outcome.kind, title: outcome.title, message: outcome.message)
                        .padding(.horizontal, 16)
                        .accessibilityIdentifier("privacy-outcome")
                }
                RemoteContentView(id: "privacy", state: remote.state, unavailableTitle: "Couldn't load your privacy settings", unavailableMessage: "Try again in a moment.", isEmpty: { _ in false }, emptyTitle: "", emptyMessage: "", retry: { Task { await load() } }) { privacy in
                    // A container of its own, so the list's identifier stays on
                    // the list and each control keeps its own.
                    VStack(alignment: .leading, spacing: 16) {
                        consentSection(privacy)
                        heldSection(privacy.held)
                        requestsSection(privacy.requests)
                    }
                    .accessibilityElement(children: .contain)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-privacy")
        .sheet(isPresented: $asking) {
            NewPrivacyRequestSheet { kind, details, nominee in
                await send(kind: kind, details: details, nominee: nominee)
            }
        }
        .task { await load() }
    }

    @ViewBuilder
    private func consentSection(_ privacy: PortalPrivacy) -> some View {
        let current = privacy.consent.history.first
        let lang = language ?? current?.noticeLanguage ?? defaultLanguage
        let chosen = choices ?? Set(current?.purposes ?? [])
        if let notice = DpdpNotice.bundled, let text = notice.languages[lang] {
            VStack(alignment: .leading, spacing: 8) {
                CarbonSectionTitle("What you agree to")
                Picker("Language", selection: Binding(get: { lang }, set: { language = $0 })) {
                    ForEach(noticeLanguages, id: \.self) { code in
                        Text(notice.languages[code]?.language ?? code).tag(code)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("privacy-language")
                Text(text.collected).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
                Text(text.purposesIntro).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                ForEach(notice.purposes, id: \.self) { purpose in
                    Toggle(text.purposes[purpose] ?? purpose, isOn: Binding(
                        get: { chosen.contains(purpose) },
                        set: { on in
                            var next = chosen
                            if on { next.insert(purpose) } else { next.remove(purpose) }
                            choices = next
                        }
                    ))
                    .font(CarbonType.bodyCompact)
                    .accessibilityIdentifier("purpose-\(purpose)")
                }
                Text(text.rights).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                Button(saving ? "Saving…" : "Save my choices") {
                    Task { await save(version: notice.version, language: lang, purposes: chosen) }
                }
                .buttonStyle(CarbonPrimaryButtonStyle())
                .disabled(choices == nil || saving)
                .accessibilityIdentifier("privacy-save")
            }
            .padding(.horizontal, 16)
        } else {
            CarbonNotification(kind: .error, title: "The privacy notice is unavailable", message: "Ask the hospital's front desk.")
                .padding(.horizontal, 16)
        }
    }

    private func heldSection(_ held: PatientDataSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CarbonSectionTitle("What the hospital holds about you")
            Group {
                if let exported {
                    ShareLink(item: exported) { Label("Share my record", systemImage: "square.and.arrow.up") }
                        .accessibilityIdentifier("privacy-share-export")
                } else {
                    Button(exporting ? "Preparing…" : "Download my data") { Task { await export() } }
                        .buttonStyle(CarbonGhostButtonStyle())
                        .disabled(exporting)
                        .accessibilityIdentifier("privacy-export")
                }
            }
            .padding(.horizontal, 16)
            ForEach(held.held.filter { $0.count > 0 }, id: \.category) { row in
                CarbonRow(row.category, detail: "\(row.count)")
            }
            CarbonRow("Staff who opened your record this year", detail: "\(held.staffWhoViewed)")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("privacy-held")
    }

    private func requestsSection(_ requests: [PrivacyRequestRow]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonSectionTitle("Your requests")
            if requests.isEmpty {
                Text("You have not made any requests.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    .padding(.horizontal, 16)
            }
            ForEach(requests) { request in
                CarbonRow(requestLabel[request.requestType] ?? request.requestType, detail: requestState(request))
            }
            Button("Make a request") { asking = true }
                .buttonStyle(CarbonGhostButtonStyle())
                .padding(.horizontal, 16)
                .accessibilityIdentifier("privacy-make-request")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("privacy-requests")
    }

    private func requestState(_ request: PrivacyRequestRow) -> String {
        switch request.status {
        case "open": return "Answer due by \(String(request.dueAt.prefix(10)))"
        case "completed": return "Done: \(request.decision ?? "")"
        default: return "Refused: \(request.decision ?? "")"
        }
    }

    private func load() async {
        guard let portal else { return }
        await remote.load { try await portal.privacy() }
    }

    private func export() async {
        guard let portal else { return }
        exporting = true
        defer { exporting = false }
        do {
            let data = try await portal.exportRecord()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(exportFileName)
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            exported = url
        } catch {
            outcome = (.error, "Your record didn't download", error.localizedDescription)
        }
    }

    private func save(version: String, language: String, purposes: Set<String>) async {
        guard let portal else { return }
        saving = true
        defer { saving = false }
        do {
            _ = try await portal.setConsent(DpdpConsentChoice(noticeVersion: version, noticeLanguage: language, purposes: purposes.sorted()))
            choices = nil
            outcome = (.success, "Your choices are saved", "You can change them here at any time.")
            await load()
        } catch {
            outcome = (.error, "Not saved", error.localizedDescription)
        }
    }

    private func send(kind: String, details: String, nominee: String?) async -> Bool {
        guard let portal else { return false }
        do {
            _ = try await portal.makePrivacyRequest(PrivacyRequestAsk(requestType: kind, details: details, nomineeName: nominee))
            outcome = (.success, "Request sent", "The hospital answers within 90 days.")
            await load()
            return true
        } catch {
            outcome = (.error, "Request not sent", error.localizedDescription)
            return false
        }
    }
}

/// The form a patient fills to make a request.
private struct NewPrivacyRequestSheet: View {
    let send: (String, String, String?) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var kind: String? = requestKinds.first?.id
    @State private var details = ""
    @State private var nominee = ""
    @State private var sending = false

    private var ready: Bool {
        details.trimmingCharacters(in: .whitespaces).count >= minimumDetails
            && (kind != "nominee" || !nominee.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                CarbonPicker("I want to", options: requestKinds.map { .init(id: $0.id, label: $0.label) }, selection: $kind)
                    .accessibilityIdentifier("request-kind")
                TextField("Tell us more", text: $details)
                    .accessibilityIdentifier("request-details")
                if kind == "nominee" {
                    TextField("Nominee's name", text: $nominee).accessibilityIdentifier("request-nominee")
                }
            }
            .navigationTitle("Make a request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        guard let kind else { return }
                        sending = true
                        Task {
                            let sent = await send(kind, details.trimmingCharacters(in: .whitespaces), kind == "nominee" ? nominee : nil)
                            sending = false
                            if sent { dismiss() }
                        }
                    }
                    .disabled(!ready || sending)
                    .accessibilityIdentifier("request-send")
                }
            }
        }
    }
}
