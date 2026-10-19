import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// A share whose ABHA is on no patient here, for a person who may already be
/// registered (before ABHA): the likely matches by mobile, name and date of
/// birth, and a search. Picking one goes on to compare and link; registering
/// stays possible, after the warning. Mirrors `ScanShareFindDrawer`.
struct ScanShareFindView: View {
    let share: AbdmProfileShare
    /// The desk pressed Register and likely matches were found (or the check failed).
    let registering: Bool
    let onPick: (String) -> Void
    let onRegister: () -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var matches = Remote<[ShareCandidate]>()
    @State private var query = ""
    @State private var results = Remote<[PatientSummary]>()
    @State private var searched = false

    var body: some View {
        let who = auth.identity
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Scan & Share", title: "Find existing patient", subtitle: sharedBy)
                if who?.canMatchPatients ?? false {
                    RemoteContentView(id: "share-candidates", state: matches.state, unavailableTitle: "Could not check for existing patients", unavailableMessage: "Nobody has been compared — search below before registering.", isEmpty: \.isEmpty, emptyTitle: "No likely match", emptyMessage: "No patient here shares this name, mobile or date of birth.", retry: { Task { await loadMatches() } }) { ranked in
                        let likely = ranked.filter(\.isLikely)
                        if registering, !likely.isEmpty {
                            CarbonNotification(kind: .warning, title: "This may be an existing patient", message: "Registering again would give the same person a second UHID. Link instead if one of these is them.")
                                .accessibilityIdentifier("share-likely-warning")
                        }
                        LazyVStack(spacing: 1) {
                            ForEach(ranked.prefix(ScanShare.candidateLimit)) { c in
                                candidateRow(c)
                            }
                        }
                    }
                }
                if who?.can(AbdmPermission.findPatient) ?? false { search }
                if registering {
                    Button("Register new anyway", action: onRegister).buttonStyle(.carbonDanger).accessibilityIdentifier("share-register-anyway")
                }
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Find existing").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-share-find")
        .task { if who?.canMatchPatients ?? false { await loadMatches() } }
        .onAppear { if query.isEmpty { query = ScanShare.name(share.profile) } }
    }

    private var sharedBy: String {
        let p = share.profile
        return (["Shared by \(ScanShare.name(p))", p.mobile, p.dateOfBirth.map { "born \($0)" }] as [String?]).compactMap { $0 }.joined(separator: " · ")
    }

    private func candidateRow(_ c: ShareCandidate) -> some View {
        Button { onPick(c.match.id) } label: {
            CarbonRow("\(c.match.firstName) \(c.match.lastName)", detail: ([c.match.uhid, c.match.dateOfBirth, c.match.phone] as [String?]).compactMap { $0 }.joined(separator: " · ")) {
                VStack(alignment: .trailing, spacing: 4) {
                    HStack(spacing: 4) { ForEach(c.reasons, id: \.self) { CarbonTag($0, tone: .info) } }
                    Text(c.isLikely ? "Link instead" : "Compare and link").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.interactive)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("share-candidate-\(c.match.uhid)")
    }

    private var search: some View {
        VStack(alignment: .leading, spacing: 8) {
            CarbonField("Search by name, phone or UHID", isFocused: false) {
                TextField("Name, phone or UHID", text: $query).submitLabel(.search).onSubmit { Task { await runSearch() } }
                    .accessibilityIdentifier("share-search")
            }
            Button("Search") { Task { await runSearch() } }.buttonStyle(.carbonTertiary)
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityIdentifier("share-search-submit")
            if searched {
                RemoteContentView(id: "share-search", state: results.state, unavailableTitle: "Couldn't search", unavailableMessage: "The hospital server did not answer. Do not read this as \"not registered\".", isEmpty: \.isEmpty, emptyTitle: "No patient by that name, phone or UHID", emptyMessage: "Check the spelling, or register them.", retry: { Task { await runSearch() } }) { rows in
                    LazyVStack(spacing: 1) {
                        ForEach(rows) { p in
                            Button { onPick(p.id) } label: { CarbonRow(p.fullName, detail: p.identifiers) }
                                .buttonStyle(.plain).accessibilityIdentifier("share-search-row-\(p.id)")
                        }
                    }
                }
            }
        }
    }

    private func loadMatches() async {
        guard let client else { return }
        let q = ScanShare.matchQuery(share.profile)
        let profile = share.profile
        await matches.load {
            let found = try await ReceptionApi(client: client).matchPatients(MatchQuery(firstName: q.firstName, lastName: q.lastName, dateOfBirth: q.dateOfBirth, phone: q.phone))
            return ScanShare.rank(profile, found.map(\.asMatch))
        }
    }

    private func runSearch() async {
        guard let client else { return }
        searched = true
        let text = query.trimmingCharacters(in: .whitespaces)
        await results.load { try await ReceptionApi(client: client).searchPatients(text) }
    }
}

/// A shared ABHA profile beside the patient's record: where they differ the
/// desk chooses which to keep (ours until it says otherwise), then the ABHA
/// is linked through the verified path and the share marked dealt with.
struct ScanShareCompareView: View {
    let shareId: String
    let step: AbhaVerificationStep
    let patientId: String
    let onDone: (PatientSummary) -> Void

    @Environment(\.apiClient) private var client
    @State private var patient = Remote<PatientSummary>()
    @State private var apply: Set<AbhaField> = []
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Scan & Share", title: "Compare and link")
                RemoteContentView(id: "share-compare", state: patient.state, unavailableTitle: "Could not load the patient", unavailableMessage: "The record failed to load; nothing was changed.", isEmpty: { _ in false }, emptyTitle: "", emptyMessage: "", retry: { Task { await load() } }) { p in
                    VStack(alignment: .leading, spacing: 16) {
                        Text("\(p.uhid) · \(p.fullName)").font(CarbonType.code).foregroundStyle(MedBrainsTheme.ink).accessibilityIdentifier("share-compare-patient")
                        if let profile = step.profile {
                            let ours = OurDetails(firstName: p.firstName, middleName: p.middleName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, gender: p.gender)
                            if Abha.defaultApply(profile, ours: ours).isEmpty {
                                Text("The shared profile matches this record.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                            }
                            AbhaCompareView(profile: profile, ours: ours, apply: $apply, oursLabel: "On the record")
                        }
                        if let failure { CarbonNotification(kind: .error, title: "Could not link the ABHA", message: failure) }
                        Button { Task { await link(p) } } label: { HStack { Text("Link to this patient"); Spacer(); Image(systemName: "link") } }
                            .buttonStyle(.carbonPrimary).disabled(busy || step.profile == nil).accessibilityIdentifier("share-link")
                    }
                }
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Compare").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-share-compare")
        .task { await load() }
    }

    private func load() async {
        guard let client else { return }
        await patient.load { [patientId] in try await ReceptionApi(client: client).patient(patientId) }
    }

    private func link(_ p: PatientSummary) async {
        guard let client else { return }
        busy = true
        failure = nil
        defer { busy = false }
        do {
            try await AbhaApi(client: client).link(step.id, patientId: p.id, apply: apply)
            _ = try await ScanShareApi(client: client).complete(shareId, patientId: p.id)
            UIAccessibility.post(notification: .announcement, argument: "The ABHA is linked")
            onDone(p)
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was linked."
        }
    }
}
