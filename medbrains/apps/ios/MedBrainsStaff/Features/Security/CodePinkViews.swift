import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// S6 entry, above every desk: a red banner while any tag alert is open,
/// polled every 15 s for as long as the Security tab is on screen. A role
/// that may not read tag alerts never asks; one that may only match bands
/// still gets the way in.
struct CodePinkEntry: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var alerts = Remote<[TagAlertRow]>()

    private var canList: Bool { auth.identity?.can(SecurityPermission.listTagAlerts) ?? false }
    private var canMatch: Bool { auth.identity?.can(SecurityPermission.verifyBandMatch) ?? false }
    private var unavailable: Bool {
        if case .failed = alerts.state { return true }
        return false
    }

    var body: some View {
        Group {
            if canList, let open = alerts.value, !open.isEmpty {
                NavigationLink(value: SecurityRoute.tagAlerts) {
                    CarbonNotification(kind: .error, title: "Code Pink — \(open.count) tag alert\(open.count == 1 ? "" : "s") open", message: "Tap to see where, and to resolve.")
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("security-code-pink-banner")
            } else if canList, unavailable {
                CarbonNotification(kind: .warning, title: "Tag alerts unavailable", message: "Do not read this as no Code Pink. Check with the control room.")
            } else if canList || canMatch {
                NavigationLink(value: canList ? SecurityRoute.tagAlerts : SecurityRoute.bandMatch) {
                    CarbonRow(canList ? "Tag alerts and band match" : "Mother and baby band match", detail: canList ? "No tag alert open" : nil)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("security-code-pink-link")
            }
        }
        .padding(.horizontal, 16)
        .task {
            guard canList, let client else { return }
            await alerts.poll(every: SecurityRefresh.alarm) { try await SecurityApi(client: client).openTagAlerts() }
        }
    }
}

/// The open tag alerts: what fired, where, when; resolved with a reason.
struct TagAlertsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var alerts = Remote<[TagAlertRow]>()
    @State private var resolving: TagAlertRow?
    @State private var failure: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Code Pink", title: "Tag alerts", subtitle: "An infant or patient tag left its zone or was tampered with.")
                if auth.identity?.can(SecurityPermission.verifyBandMatch) ?? false {
                    NavigationLink(value: SecurityRoute.bandMatch) {
                        HStack { Text("Check a mother and baby band match"); Spacer(); Image(systemName: "qrcode.viewfinder") }
                    }
                    .buttonStyle(.carbonPrimary)
                    .padding(16)
                    .accessibilityIdentifier("security-band-match")
                }
                if let failure { CarbonNotification(kind: .error, title: "Not resolved", message: failure).padding(.horizontal, 16) }
                StaleBanner(since: alerts.staleSince, what: "tag alerts")
                if auth.identity?.can(SecurityPermission.listTagAlerts) ?? false {
                    RemoteContentView(
                        id: "security-tag-alerts",
                        state: alerts.state,
                        unavailableTitle: "Couldn't load tag alerts",
                        unavailableMessage: "Do not read this as no Code Pink. Check with the control room.",
                        isEmpty: \.isEmpty,
                        emptyTitle: "No tag alert open",
                        emptyMessage: "Exits and tampering from infant and patient tags appear here.",
                        retry: { Task { await load() } }
                    ) { rows in
                        LazyVStack(spacing: 0) {
                            ForEach(rows) { row in alertRow(row) }
                        }
                    }
                    .task {
                        guard let client else { return }
                        await alerts.poll(every: SecurityRefresh.alarm) { try await SecurityApi(client: client).openTagAlerts() }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Tag alerts").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-security-tag-alerts")
        .sheet(item: $resolving) { row in
            ResolveAlertSheet(alert: row) { notes, falseAlarm in
                resolving = nil
                Task { await resolve(row, notes: notes, falseAlarm: falseAlarm) }
            }
        }
    }

    @ViewBuilder
    private func alertRow(_ row: TagAlertRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonRow(row.alertLabel, detail: "\(row.locationDescription ?? "Location not reported") · \(ServerTime.short(row.triggeredAt))") {
                CarbonTag("Open", tone: .danger)
            }
            if auth.identity?.can(SecurityPermission.resolveTagAlert) ?? false {
                Button("Resolve") { resolving = row }
                    .buttonStyle(.carbonTertiary)
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier("security-tag-alert-resolve-\(row.id)")
            }
        }
        .padding(.bottom, 8)
        .accessibilityIdentifier("security-tag-alert-\(row.id)")
    }

    private func load() async {
        guard let client else { return }
        await alerts.load { try await SecurityApi(client: client).openTagAlerts() }
    }

    private func resolve(_ row: TagAlertRow, notes: String, falseAlarm: Bool) async {
        guard let client else { return }
        failure = nil
        do {
            _ = try await SecurityApi(client: client).resolveTagAlert(row.id, notes: notes, falseAlarm: falseAlarm)
            await load()
        } catch {
            failure = securityWriteFailure(error)
        }
    }
}

/// Resolving says why: the next shift reads the reason, not a cleared flag.
private struct ResolveAlertSheet: View {
    let alert: TagAlertRow
    let onResolve: (String, Bool) -> Void
    @State private var notes = ""
    @State private var falseAlarm = false
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    CarbonPageHeader(eyebrow: "Resolve", title: alert.alertLabel, subtitle: alert.locationDescription)
                    CarbonField("What was found", isFocused: focused) {
                        TextField("Baby with mother, tag reattached…", text: $notes, axis: .vertical).lineLimit(2...4).focused($focused)
                            .accessibilityIdentifier("field-tag-alert-notes")
                    }
                    Toggle("It was a false alarm", isOn: $falseAlarm).accessibilityIdentifier("tag-alert-false-alarm")
                    Button("Resolve the alert") { onResolve(notes.trimmingCharacters(in: .whitespaces), falseAlarm) }
                        .buttonStyle(.carbonDanger)
                        .disabled(notes.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("security-tag-alert-resolve-submit")
                }
                .padding(16)
            }
            .background(MedBrainsTheme.canvas)
        }
        .onAppear { focused = true }
    }
}

/// Baby's band, then mother's band; the server compares and answers.
struct BandMatchView: View {
    @Environment(\.apiClient) private var client
    @State private var infant: String?
    @State private var resumeKey = 0
    @State private var result: (matched: Bool, message: String)?
    @State private var working = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Code Pink", title: "Band match", subtitle: "Never hand a baby over unless the two bands match.")
                if let result {
                    CarbonTile(tone: result.matched ? .success : .danger) {
                        Label(result.matched ? "Bands match" : "Do not hand over", systemImage: result.matched ? "checkmark.shield.fill" : "xmark.shield.fill")
                            .font(CarbonType.heading04).foregroundStyle(MedBrainsTheme.ink)
                        Text(result.message).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("security-band-result")
                    Button("Check another pair") { infant = nil; self.result = nil; resumeKey += 1 }
                        .buttonStyle(.carbonTertiary)
                } else if working {
                    ProgressView("Checking the bands…").frame(maxWidth: .infinity).padding(32)
                } else if let infant {
                    CarbonRow("Baby's band", detail: infant, mono: true)
                    BarcodeScannerView(title: "Now the mother's band", hint: "Scan or type the mother's band.", resumeKey: resumeKey) { mother in
                        Task { await check(infant: infant, mother: mother) }
                    }
                } else {
                    BarcodeScannerView(title: "Scan the baby's band", hint: "Scan or type the tag on the baby's band.", resumeKey: resumeKey) { code in
                        infant = code
                        resumeKey += 1
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Band match").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-security-band-match")
    }

    private func check(infant: String, mother: String) async {
        guard let client else { return }
        working = true
        defer { working = false }
        do {
            _ = try await SecurityApi(client: client).verifyBandMatch(infant: infant, mother: mother)
            result = (true, "The baby may go with this mother.")
        } catch let e as ApiError where e.status == 403 {
            result = (false, "You no longer have access to this — ask your administrator.")
        } catch let e as ApiError {
            result = (false, e.message)
        } catch {
            result = (false, "Couldn't check the bands. Do not hand the baby over until it is checked.")
        }
    }
}
