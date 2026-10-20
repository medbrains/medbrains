import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// A share the registration screen starts from: the verification the server
/// recorded from it, whose profile fills the form.
struct ShareStart: Hashable {
    let shareId: String
    let step: AbhaVerificationStep
}

enum ScanShareRoute: Hashable {
    case compare(shareId: String, step: AbhaVerificationStep, patientId: String, uhid: String?)
    case find(AbdmProfileShare, registering: Bool)
    case register(ShareStart)
    case patient(PatientSummary)
}

/// Scan & Share: patients who scanned a counter's QR with their ABHA app
/// today, with the token they were given. The desk opens the patient the
/// ABHA already belongs to, registers a new one from the shared profile
/// (warned first when they look already registered), finds one registered
/// before ABHA and links them, compares and links, or dismisses. Mirrors
/// the web's `front-office/scan-share-tab.tsx`.
struct ScanShareHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @Environment(\.scenePhase) private var scenePhase
    @State private var session = ReceptionSession()
    @State private var queue = Remote<[AbdmProfileShare]>()
    @State private var counter: String?
    @State private var route: ScanShareRoute?
    @State private var busy = false
    @State private var notice: String?
    @State private var failure: String?

    private var who: TenantIdentity? { auth.identity }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("ABDM Scan & Share")
                    Text("Shared at the counters today. Refreshes every \(Int(ScanShare.refreshSeconds)) seconds while open.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16).padding(.bottom, 12)
                if let notice { CarbonNotification(kind: .info, title: "Note", message: notice).padding(.horizontal, 16).accessibilityIdentifier("scan-share-notice") }
                if let failure { CarbonNotification(kind: .error, title: "Not done", message: failure).padding(.horizontal, 16).accessibilityIdentifier("scan-share-failure") }
                if let stale = queue.staleSince {
                    CarbonNotification(kind: .warning, title: "Not refreshed", message: "Showing the queue as of \(stale.formatted(date: .omitted, time: .shortened)); the last refresh failed.").padding(.horizontal, 16)
                }
                let counters = counterOptions
                if counters.count > 1 {
                    CarbonPicker("Counter", options: counters, selection: $counter, placeholder: "All counters").padding(16)
                        .accessibilityIdentifier("scan-share-counter")
                }
                RemoteContentView(id: "scan-share", state: queue.state, unavailableTitle: "Couldn't load Scan & Share", unavailableMessage: "This does not mean nobody has shared — the queue failed to load.", isEmpty: { filtered($0).isEmpty }, emptyTitle: "Nobody has shared their ABHA at the counters today", emptyMessage: "A patient who scans a counter's QR appears here with their token.", retry: { Task { await reload() } }) { rows in
                    LazyVStack(spacing: 1) {
                        ForEach(filtered(rows)) { share in
                            ScanShareRow(share: share, busy: busy, actions: actions(for: share))
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .refreshable { await reload() }
        .accessibilityIdentifier("module-home-scan-share")
        // Polls only while this screen is on top and the app is in front:
        // the task dies when a record is pushed over it or the app leaves.
        .task(id: scenePhase) {
            guard scenePhase == .active, let client else { return }
            let api = ScanShareApi(client: client)
            await queue.poll(every: ScanShare.refreshSeconds) { try await api.queue() }
        }
        .task {
            guard let client, who?.canRegisterWithAbha ?? false, session.departments.isEmpty else { return }
            await session.load(ReceptionApi(client: client), identity: who)
        }
        .navigationDestination(item: $route) { destination($0).environment(session) }
        .navigationDestination(for: ReceptionRoute.self) { ReceptionDestination(route: $0).environment(session) }
    }

    private var counterOptions: [CarbonPicker<String>.Option] {
        var seen: [String: String] = [:]
        for s in queue.value ?? [] { if let id = s.stationId { seen[id] = s.counterName ?? "Counter" } }
        return seen.map { CarbonPicker<String>.Option(id: $0.key, label: $0.value) }.sorted { $0.label < $1.label }
    }

    private func filtered(_ rows: [AbdmProfileShare]) -> [AbdmProfileShare] {
        counter.map { c in rows.filter { $0.stationId == c } } ?? rows
    }

    @ViewBuilder
    private func destination(_ route: ScanShareRoute) -> some View {
        switch route {
        case .compare(let shareId, let step, let patientId, let uhid):
            ScanShareCompareView(shareId: shareId, step: step, patientId: patientId, uhid: uhid) { patient in
                notice = "The ABHA is linked to \(patient.uhid)."
                self.route = .patient(patient)
                Task { await reload() }
            }
        case .find(let share, let registering):
            ScanShareFindView(share: share, registering: registering,
                              onPick: { id, uhid in Task { await use(share, .compare, picked: id, pickedUhid: uhid) } },
                              onRegister: { Task { await use(share, .register) } })
        case .register(let start): RegisterPatientView(share: start)
        case .patient(let p): ReceptionPatientView(patient: p)
        }
    }

    private func actions(for s: AbdmProfileShare) -> [ScanShareRow.Action] {
        guard ScanShare.isActionable(s.status), let who else { return [] }
        var out: [ScanShareRow.Action] = []
        if s.patientId != nil {
            if who.can(AbdmPermission.findPatient) { out.append(.init(id: "open", label: "Open patient", primary: true) { Task { await open(s) } }) }
            if who.canCompareShare { out.append(.init(id: "compare", label: "Compare and link") { Task { await use(s, .compare) } }) }
        } else {
            let hasNumber = s.abhaNumber != nil
            if who.canRegisterWithAbha { out.append(.init(id: "register", label: "Register", primary: true, enabled: hasNumber) { Task { await registerOrWarn(s) } }) }
            if who.canCompareShare { out.append(.init(id: "find", label: "Find existing patient", enabled: hasNumber) { route = .find(s, registering: false) }) }
        }
        out.append(.init(id: "dismiss", label: "Dismiss", ghost: true) { Task { await dismiss(s) } })
        return out
    }

    private func reload() async {
        guard let client else { return }
        await queue.load { try await ScanShareApi(client: client).queue() }
    }

    /// Runs one desk action, naming what went wrong instead of failing quietly.
    private func act(_ op: () async throws -> Void) async {
        busy = true
        notice = nil
        failure = nil
        defer { busy = false }
        do { try await op() } catch let e as ApiError { failure = e.message } catch { failure = "Could not reach the hospital server." }
    }

    private func open(_ s: AbdmProfileShare) async {
        guard let client, let patientId = s.patientId else { return }
        await act {
            _ = try await ScanShareApi(client: client).complete(s.id, patientId: patientId)
            route = .patient(try await ReceptionApi(client: client).patient(patientId, uhid: s.patientUhid))
        }
        await reload()
    }

    /// The share as a verified ABHA, then wherever it leads: its own
    /// patient's comparison, or a registration filled from it.
    private func use(_ s: AbdmProfileShare, _ intent: ScanShare.Intent, picked: String? = nil, pickedUhid: String? = nil) async {
        guard let client else { return }
        await act {
            let step = try await ScanShareApi(client: client).verification(s.id)
            switch ScanShare.next(intent: intent, sharePatientId: s.patientId, alreadyLinked: step.alreadyLinked, picked: picked) {
            case .compare(let patientId, let note)?:
                // The UHID the desk's lookup finds the record by, from whichever source named it.
                let uhid = patientId == s.patientId ? s.patientUhid : patientId == step.alreadyLinked?.patientId ? step.alreadyLinked?.uhid : pickedUhid
                route = .compare(shareId: s.id, step: step, patientId: patientId, uhid: uhid)
                notice = note
            case .register?: route = .register(ShareStart(shareId: s.id, step: step))
            case nil: break
            }
        }
    }

    /// A registration that is really a returning patient makes a second
    /// UHID, so Register checks first; a check that could not run opens the
    /// search too — an outage must not read as "nobody matches".
    private func registerOrWarn(_ s: AbdmProfileShare) async {
        guard let client else { return }
        if who?.canMatchPatients ?? false {
            let q = ScanShare.matchQuery(s.profile)
            let found = try? await ReceptionApi(client: client).matchPatients(MatchQuery(firstName: q.firstName, lastName: q.lastName, dateOfBirth: q.dateOfBirth, phone: q.phone))
            if found.map({ !ScanShare.likelyDuplicates(s.profile, $0.map(\.asMatch)).isEmpty }) ?? true {
                route = .find(s, registering: true)
                return
            }
        }
        await use(s, .register)
    }

    private func dismiss(_ s: AbdmProfileShare) async {
        guard let client else { return }
        await act { _ = try await ScanShareApi(client: client).dismiss(s.id) }
        await reload()
    }
}

/// One share: the token the patient holds, who they are, their ABHA, and
/// whether a record here already carries it.
private struct ScanShareRow: View {
    struct Action: Identifiable {
        let id: String
        let label: String
        var primary = false
        var ghost = false
        var enabled = true
        let run: () -> Void
    }

    let share: AbdmProfileShare
    let busy: Bool
    let actions: [Action]

    var body: some View {
        let status = ScanShare.status(share.status)
        CarbonTile {
            HStack(alignment: .firstTextBaseline) {
                Text(share.tokenNumber ?? "—").font(CarbonType.heading04).foregroundStyle(MedBrainsTheme.ink)
                    .accessibilityLabel("Token \(share.tokenNumber ?? "none")")
                Spacer()
                CarbonTag(status.label, tone: tone(status.tone))
            }
            Text(ScanShare.name(share.profile)).font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
            Text(ScanShare.ageAndGender(share.profile, today: Date())).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
            Text([share.abhaAddress, share.abhaNumber].compactMap { $0 }.joined(separator: " · ")).font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
            HStack(spacing: 8) {
                if let id = share.patientId {
                    CarbonTag(share.patientUhid ?? "Matched", tone: .success, mono: true).accessibilityLabel("Matched to \(share.patientUhid ?? id)")
                } else {
                    CarbonTag("New", tone: .neutral)
                }
                if let counter = share.counterName { Text(counter).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary) }
            }
            ForEach(actions) { a in
                Button(a.label, action: a.run)
                    .buttonStyle(ButtonStyleChoice(primary: a.primary, ghost: a.ghost))
                    .disabled(busy || !a.enabled)
                    .accessibilityIdentifier("share-\(a.id)-\(share.id)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("share-row-\(share.id)")
    }

    private func tone(_ t: ScanShare.Tone) -> CarbonTone {
        switch t {
        case .primary: .info
        case .success: .success
        case .warning: .warning
        case .neutral: .neutral
        }
    }
}

/// The row's three button weights: one primary, the rest tertiary, Dismiss ghost.
private struct ButtonStyleChoice: ButtonStyle {
    let primary: Bool
    let ghost: Bool

    func makeBody(configuration: Configuration) -> some View {
        if primary { CarbonPrimaryButtonStyle().makeBody(configuration: configuration) }
        else if ghost { CarbonGhostButtonStyle().makeBody(configuration: configuration) }
        else { CarbonTertiaryButtonStyle().makeBody(configuration: configuration) }
    }
}
