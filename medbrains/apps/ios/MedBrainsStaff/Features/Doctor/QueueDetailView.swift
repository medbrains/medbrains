import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One token's call / serve / complete state machine on the unified queue.
/// All three transitions are one act on one queue and take one permission,
/// `opd.token.manage`, which is what the server checks. The consultation is
/// deliberately gated on `opd.visit.update` instead: writing a note and
/// moving a token are different acts. A recall IS a call: it restamps
/// `called_at`, which is what the boards sort and announce on.
struct QueueDetailView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    @State var token: WorklistToken
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        let canWorkQueue = auth.identity?.can("opd.token.manage") ?? false
        let canRecord = auth.identity?.can("opd.visit.update") ?? false
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Queue", title: token.displayName, subtitle: "UHID \(token.uhid ?? "—") · Token \(token.number)")
                CarbonTile(tone: tokenTone(token.status)) {
                    Eyebrow("Status")
                    Text(token.status).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    Text("Last action: \(ServerTime.short(token.calledAt ?? token.createdAt))").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                    HStack(spacing: 8) {
                        CarbonTag("token \(token.number)", mono: true)
                        CarbonTag(token.priority, tone: .info, mono: true)
                    }
                }
                .padding(.horizontal, 16)
                if let error { CarbonNotification(kind: .error, title: "Action failed", message: error).padding(.horizontal, 16) }
                VStack(spacing: 8) {
                    if token.status == "waiting", canWorkQueue {
                        Button("Call patient") { Task { await run { try await $0.call(token.id) } } }.buttonStyle(.carbonPrimary).disabled(busy)
                            .accessibilityIdentifier("queue-call-patient")
                    }
                    if token.status == "called", canWorkQueue {
                        Button("Patient is in") { Task { await run { try await $0.serve(token.id) } } }.buttonStyle(.carbonPrimary).disabled(busy)
                            .accessibilityIdentifier("queue-patient-is-in")
                        Button("Recall") { Task { await run { try await $0.call(token.id) } } }.buttonStyle(.carbonTertiary).disabled(busy)
                            .accessibilityLabel("Call this token again").accessibilityIdentifier("queue-recall-patient")
                        Button("No-show") { Task { await run { try await $0.noShow(token.id) } } }.buttonStyle(.carbonTertiary).disabled(busy)
                            .accessibilityLabel("Mark this patient as not present").accessibilityIdentifier("queue-no-show")
                    }
                    if token.status == "serving", canWorkQueue {
                        Button("Mark complete") { Task { await run { try await $0.complete(token.id) } } }.buttonStyle(.carbonPrimary).disabled(busy)
                            .accessibilityIdentifier("queue-mark-complete")
                    }
                    if canRecord {
                        NavigationLink(value: DoctorRoute.consultation(token)) {
                            HStack { Text("Consultation"); Spacer(); Image(systemName: "arrow.right") }
                        }
                        .buttonStyle(.carbonTertiary).disabled(busy)
                        .accessibilityLabel("Open the consultation for this patient").accessibilityIdentifier("queue-open-consultation")
                    }
                    Button("Back to queue") { dismiss() }.buttonStyle(.carbonGhost).disabled(busy).accessibilityIdentifier("screen-back")
                }
                .padding(.horizontal, 16)
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Token \(token.number)")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-queue-detail")
    }

    private func run(_ op: (DoctorApi) async throws -> ModuleToken) async {
        guard let client else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let next = try await op(DoctorApi(client: client))
            token.status = next.status
            token.calledAt = next.calledAt ?? token.calledAt
            token.counterLabel = next.counterLabel ?? token.counterLabel
        } catch {
            self.error = (error as? ApiError)?.message ?? "Could not reach the hospital server."
        }
    }
}
