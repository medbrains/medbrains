import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The server's answer about one pass, in words a guard reads at arm's
/// length: let in or not, who it was issued to, where it opens. Nothing is
/// cached — a revoked pass must never read as valid from a phone's memory.
struct PassVerdictSheet: View {
    let code: String
    let onDone: () -> Void
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var outcome = Outcome.checking
    /// The pass's id and whether it is inside, once looked up for recording.
    @State private var presence: Presence?
    @State private var working = false
    @State private var failure: String?
    @State private var recorded: String?

    enum Outcome {
        case checking
        case verdict(PassVerdict)
        case noSuchPass
        case unreachable
    }

    struct Presence { let passId: String; let inside: Bool }

    private var canRecord: Bool { auth.identity?.canAny(SecurityPermission.recordVisits) ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch outcome {
                case .checking:
                    ProgressView("Checking \(code)…").frame(maxWidth: .infinity).padding(32)
                case .noSuchPass:
                    band("No such pass — do not let in", detail: "Nothing on record carries \(code).", tone: .danger)
                case .unreachable:
                    band("Couldn't check this pass", detail: "Do not read this as valid — check the paper pass and the ward.", tone: .warning)
                    Button("Try again") { Task { await check() } }.buttonStyle(.carbonTertiary)
                case .verdict(let pass):
                    verdict(pass)
                }
                if let recorded {
                    CarbonNotification(kind: .success, title: recorded, message: "Read back from the hospital server.")
                        .accessibilityIdentifier("security-recorded")
                }
                if let failure {
                    CarbonNotification(kind: .error, title: "Not recorded", message: failure)
                        .accessibilityIdentifier("security-record-error")
                }
                Button("Scan next", action: onDone)
                    .buttonStyle(.carbonTertiary)
                    .accessibilityIdentifier("security-scan-next")
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("security-verdict")
        .task { await check() }
    }

    private func band(_ headline: String, detail: String?, tone: CarbonTone) -> some View {
        CarbonTile(tone: tone) {
            Label(headline, systemImage: tone == .success ? "checkmark.shield.fill" : "xmark.shield.fill")
                .font(CarbonType.heading04)
                .foregroundStyle(MedBrainsTheme.ink)
                .accessibilityIdentifier("security-verdict-band")
            if let detail { Text(detail).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink) }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func verdict(_ pass: PassVerdict) -> some View {
        band(pass.headline, detail: pass.revokedReason.map { "Reason: \($0)" }, tone: pass.valid ? .success : .danger)
        if let url = pass.photoUrl.flatMap({ URL(string: $0) }), url.scheme?.hasPrefix("http") == true {
            AsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }
                .frame(maxHeight: 160)
                .accessibilityLabel("Photo of \(pass.visitorName)")
        }
        VStack(spacing: 0) {
            CarbonRow(pass.visitorName, detail: [pass.relationship, pass.category].compactMap { $0 }.joined(separator: " · "))
            if let idType = pass.idType {
                CarbonRow("ID", detail: "\(idType) ending \(pass.idNumber.map { String($0.suffix(4)) } ?? "—")")
            }
            CarbonRow("Ward", detail: [pass.wardName, pass.bedNumber.map { "bed \($0)" }].compactMap { $0 }.joined(separator: " · ").nonEmpty ?? "Not named on the pass")
            CarbonRow("Valid until", detail: ServerTime.short(pass.validUntil))
            CarbonRow("Pass", detail: pass.passNumber, mono: true)
        }
        if canRecord, let presence {
            if presence.inside {
                Button(working ? "Recording…" : "Record exit") { Task { await record(presence.passId, entering: false) } }
                    .buttonStyle(.carbonPrimary).disabled(working)
                    .accessibilityIdentifier("security-record-exit")
            } else if pass.valid {
                Button(working ? "Recording…" : "Record entry") { Task { await record(presence.passId, entering: true) } }
                    .buttonStyle(.carbonPrimary).disabled(working)
                    .accessibilityIdentifier("security-record-entry")
            }
        }
    }

    private func check() async {
        guard let client else { return }
        outcome = .checking
        do {
            let pass = try await SecurityApi(client: client).scan(code)
            outcome = .verdict(pass)
            if canRecord { presence = try? await locate(pass.passNumber, client) }
        } catch let e as ApiError where e.status == 404 {
            outcome = .noSuchPass
        } catch {
            outcome = .unreachable
        }
    }

    /// The scan does not return the pass id, so it is found among active passes.
    // ponytail: two extra reads per scan; drop them once the scan answers with the id and whether the holder is inside.
    private func locate(_ number: String, _ client: ApiClient) async throws -> Presence? {
        let api = SecurityApi(client: client)
        async let passes = api.activePasses()
        async let open = api.openVisits()
        let (active, visits) = try await (passes, open)
        guard let pass = active.first(where: { $0.passNumber.caseInsensitiveCompare(number) == .orderedSame }) else { return nil }
        return Presence(passId: pass.id, inside: visits.contains { $0.passId == pass.id })
    }

    private func record(_ passId: String, entering: Bool) async {
        guard let client else { return }
        working = true
        defer { working = false }
        failure = nil
        recorded = nil
        do {
            let desk = ReceptionApi(client: client)
            _ = entering ? try await desk.checkInVisitor(passId) : try await desk.checkOutVisitor(passId)
            await check()
            recorded = entering ? "Entry recorded" : "Exit recorded"
        } catch {
            failure = securityWriteFailure(error)
        }
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
