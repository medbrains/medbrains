import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

enum SecurityRoute: Hashable {
    case report
    case incident(SecurityIncidentRow)
    case tagAlerts
    case bandMatch
}

enum SecurityDesk: String, CaseIterable, Identifiable {
    case gate, inside, incidents
    var id: String { rawValue }
    var label: String {
        switch self {
        case .gate: "Gate scan"
        case .inside: "Inside now"
        case .incidents: "Incidents"
        }
    }
}

/// The gate guard's phone: check a pass, see who is inside, report what
/// happened on the round, answer a Code Pink. Each desk is present only when
/// the role may read it, so a desk it cannot read never fetches.
struct SecurityHomeView: View {
    @Environment(AuthStore.self) private var auth
    @State private var desk: SecurityDesk?

    private var desks: [SecurityDesk] {
        let me = auth.identity
        return SecurityDesk.allCases.filter { d in
            switch d {
            case .gate: me?.can(SecurityPermission.verifyPass) ?? false
            case .inside: (me?.can(SecurityPermission.listVisitors) ?? false) && (me?.can(SecurityPermission.listPasses) ?? false)
            case .incidents: me?.can(SecurityPermission.listIncidents) ?? false
            }
        }
    }

    var body: some View {
        let shown = desk ?? desks.first
        VStack(alignment: .leading, spacing: 0) {
            CarbonPageHeader(eyebrow: "Security", title: "Gate and rounds", subtitle: "The server checks every pass. Never let anyone in on a guess.")
            CodePinkEntry()
            if desks.count > 1 {
                Picker("Desk", selection: Binding(get: { shown ?? .gate }, set: { desk = $0 })) {
                    ForEach(desks) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
                .accessibilityIdentifier("security-desk")
            }
            switch shown {
            case .gate?: GateScanDesk()
            case .inside?: InsideNowDesk()
            case .incidents?: IncidentsDesk()
            case nil: Spacer()
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationDestination(for: SecurityRoute.self) { route in
            switch route {
            case .report: ReportIncidentView()
            case .incident(let row): IncidentDetailView(incident: row)
            case .tagAlerts: TagAlertsView()
            case .bandMatch: BandMatchView()
            }
        }
        .accessibilityIdentifier("screen-security")
    }
}

/// S1: camera on the pass, the verdict in a sheet, then the next visitor.
struct GateScanDesk: View {
    @State private var resumeKey = 0
    @State private var scanned: ScannedPass?

    var body: some View {
        ScrollView {
            BarcodeScannerView(title: "Scan the visitor's pass", hint: "Hold the QR on the pass to the camera. Or type the pass number.", resumeKey: resumeKey) { code in
                scanned = ScannedPass(code: code)
            }
        }
        .sheet(item: $scanned, onDismiss: { resumeKey += 1 }) { pass in
            PassVerdictSheet(code: pass.code) { scanned = nil }
                .presentationDetents([.medium, .large])
        }
    }
}

struct ScannedPass: Identifiable {
    let id = UUID()
    let code: String
}

/// S2: everyone checked in on a pass and not yet out, overdue first.
struct InsideNowDesk: View {
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[InsideRow]>()
    @State private var opened: ScannedPass?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                StaleBanner(since: remote.staleSince, what: "who is inside")
                RemoteContentView(
                    id: "security-inside",
                    state: remote.state,
                    unavailableTitle: "Couldn't load who is inside",
                    unavailableMessage: "This is not an empty building. Try again in a moment.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "Nobody is checked in on a pass",
                    emptyMessage: "Visitors appear here when the gate records their entry.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(spacing: 0) {
                        ForEach(rows) { row in
                            Button { if let number = row.passNumber { opened = ScannedPass(code: number) } } label: {
                                CarbonRow(row.name, detail: row.detail) {
                                    if row.isOverdue { CarbonTag("Overdue", tone: .warning) }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("security-inside-\(row.passId)")
                        }
                    }
                }
            }
        }
        .task {
            guard let client else { return }
            await remote.poll(every: SecurityRefresh.queue) { try await InsideRow.fetch(client) }
        }
        .sheet(item: $opened, onDismiss: { Task { await load() } }) { pass in
            PassVerdictSheet(code: pass.code) { opened = nil }
                .presentationDetents([.medium, .large])
        }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await InsideRow.fetch(client) }
    }
}

/// One visitor inside: the open log joined to its pass and the visitor's name.
struct InsideRow: Identifiable, Sendable {
    let passId: String
    let passNumber: String?
    let name: String
    let detail: String
    let isOverdue: Bool
    var id: String { passId }

    /// Three lists joined by id in memory: one round trip each, never one per row.
    static func fetch(_ client: ApiClient) async throws -> [InsideRow] {
        let api = SecurityApi(client: client)
        async let logs = api.openVisits()
        async let passes = api.activePasses()
        async let visitors = ReceptionApi(client: client).visitors()
        let (open, active, people) = try await (logs, passes, visitors)
        let byPass = Dictionary(active.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let names = Dictionary(people.map { ($0.id, $0.visitorName) }, uniquingKeysWith: { a, _ in a })
        let now = ServerTime.format(Date())
        let rows = open.map { log -> InsideRow in
            guard let pass = byPass[log.passId] else {
                return InsideRow(passId: log.passId, passNumber: nil, name: "A pass no longer active", detail: "In since \(ServerTime.short(log.checkInAt))", isOverdue: true)
            }
            let overdue = passState(status: pass.status, validUntil: pass.validUntil, now: now) == "overdue"
            let bed = pass.bedNumber.map { " · bed \($0)" } ?? ""
            return InsideRow(passId: pass.id, passNumber: pass.passNumber, name: names[pass.registrationId] ?? "Visitor", detail: "\(pass.passNumber)\(bed) · in since \(ServerTime.short(log.checkInAt))", isOverdue: overdue)
        }
        return rows.sorted { $0.isOverdue && !$1.isOverdue }
    }
}

/// A refresh failed: the list still shows, and says how old it is.
struct StaleBanner: View {
    let since: Date?
    let what: String

    var body: some View {
        if let since {
            CarbonNotification(kind: .warning, title: "Couldn't refresh", message: "Showing \(what) as of \(since.formatted(date: .omitted, time: .shortened)).")
                .padding(.horizontal, 16)
                .accessibilityIdentifier("security-stale")
        }
    }
}
