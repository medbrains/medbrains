import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// The tone a severity reads in; the word is always in the tag too.
func severityTone(_ severity: String) -> CarbonTone {
    switch severity {
    case "critical", "high": .danger
    case "medium": .warning
    default: .neutral
    }
}

/// S3: the incident register, open ones first.
struct IncidentsDesk: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[SecurityIncidentRow]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if auth.identity?.can(SecurityPermission.createIncident) ?? false {
                    NavigationLink(value: SecurityRoute.report) {
                        HStack { Text("Report an incident"); Spacer(); Image(systemName: "plus") }
                    }
                    .buttonStyle(.carbonPrimary)
                    .padding(16)
                    .accessibilityIdentifier("security-incident-report")
                }
                StaleBanner(since: remote.staleSince, what: "incidents")
                RemoteContentView(
                    id: "security-incidents",
                    state: remote.state,
                    unavailableTitle: "Couldn't load incidents",
                    unavailableMessage: "This is not an empty register. Try again in a moment.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No incidents",
                    emptyMessage: "Incidents reported on rounds appear here.",
                    retry: { Task { await load() } }
                ) { rows in
                    LazyVStack(spacing: 0) {
                        ForEach(rows.sorted { $0.isOpen && !$1.isOpen }) { row in
                            NavigationLink(value: SecurityRoute.incident(row)) {
                                CarbonRow(row.categoryLabel, detail: "\(row.locationDescription ?? "No location") · \(ServerTime.short(row.occurredAt))") {
                                    CarbonTag(row.severity.capitalized, tone: severityTone(row.severity))
                                    if !row.isOpen { CarbonTag(row.status.capitalized) }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("security-incident-\(row.id)")
                        }
                    }
                }
            }
        }
        .task {
            guard let client else { return }
            await remote.poll(every: SecurityRefresh.queue) { try await SecurityApi(client: client).incidents() }
        }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await SecurityApi(client: client).incidents() }
    }
}

/// S4: what happened, how bad, where. Going Back discards it; nothing is
/// saved until the server answers.
struct ReportIncidentView: View {
    @Environment(\.apiClient) private var client
    @Environment(\.dismiss) private var dismiss
    @State private var category: String?
    @State private var severity = "medium"
    @State private var location = ""
    @State private var details = ""
    @State private var people = ""
    @State private var working = false
    @State private var failure: String?
    @FocusState private var focus: String?

    private var ready: Bool { category != nil && !details.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Security", title: "Report an incident", subtitle: "Say what happened, where, and who was involved.")
                CarbonPicker("What happened", options: IncidentCategory.all.map { .init(id: $0.id, label: $0.label) }, selection: $category, placeholder: "Choose a category")
                    .accessibilityIdentifier("picker-incident-category")
                Picker("How serious", selection: $severity) {
                    ForEach(IncidentSeverity.all, id: \.self) { Text($0.capitalized).tag($0) }
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("security-incident-severity")
                CarbonField("Where", isFocused: focus == "where") {
                    TextField("Ward, gate, corridor…", text: $location).focused($focus, equals: "where").accessibilityIdentifier("field-incident-location")
                }
                CarbonField("What happened", isFocused: focus == "what") {
                    TextField("Describe it", text: $details, axis: .vertical).lineLimit(3...6).focused($focus, equals: "what").accessibilityIdentifier("field-incident-description")
                }
                CarbonField("People involved (optional)", isFocused: focus == "who") {
                    TextField("Names or descriptions", text: $people).focused($focus, equals: "who").accessibilityIdentifier("field-incident-people")
                }
                if let failure {
                    CarbonNotification(kind: .error, title: "Not reported", message: failure).accessibilityIdentifier("security-incident-error")
                }
                Button(working ? "Reporting…" : "Report") { Task { await submit() } }
                    .buttonStyle(.carbonPrimary)
                    .disabled(working || !ready)
                    .accessibilityIdentifier("security-incident-submit")
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Report").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-security-report")
    }

    private func submit() async {
        guard let client, let category else { return }
        working = true
        defer { working = false }
        failure = nil
        let who = people.trimmingCharacters(in: .whitespaces)
        do {
            _ = try await SecurityApi(client: client).report(NewIncidentBody(
                category: category,
                severity: severity,
                locationDescription: location.trimmingCharacters(in: .whitespaces).isEmpty ? nil : location.trimmingCharacters(in: .whitespaces),
                description: details.trimmingCharacters(in: .whitespaces),
                personsInvolved: who.isEmpty ? nil : [who]
            ))
            dismiss()
        } catch {
            // The typed values stay: a refusal must not cost the guard the report.
            failure = securityWriteFailure(error)
        }
    }
}

/// S5: the incident and its timeline; a note, and resolving it, for those
/// who may update the register.
struct IncidentDetailView: View {
    let incident: SecurityIncidentRow
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var timeline = Remote<[IncidentUpdateRow]>()
    @State private var note = ""
    @State private var status: String?
    @State private var working = false
    @State private var failure: String?
    @State private var confirming = false

    private var canUpdate: Bool { auth.identity?.can(SecurityPermission.updateIncident) ?? false }
    private var currentStatus: String { status ?? incident.status }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: incident.incidentNumber, title: incident.categoryLabel, subtitle: incident.locationDescription) {
                    CarbonTag(incident.severity.capitalized, tone: severityTone(incident.severity))
                }
                CarbonRow("Status", detail: currentStatus.capitalized)
                CarbonRow("Occurred", detail: ServerTime.short(incident.occurredAt))
                Text(incident.description).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink).padding(.horizontal, 16)
                if let failure {
                    CarbonNotification(kind: .error, title: "Not saved", message: failure).padding(.horizontal, 16)
                }
                if canUpdate {
                    VStack(alignment: .leading, spacing: 8) {
                        CarbonField("Add an update", isFocused: false) {
                            TextField("What has happened since", text: $note, axis: .vertical).accessibilityIdentifier("field-incident-update")
                        }
                        Button(working ? "Saving…" : "Add update") { Task { await addNote() } }
                            .buttonStyle(.carbonPrimary)
                            .disabled(working || note.trimmingCharacters(in: .whitespaces).isEmpty)
                            .accessibilityIdentifier("security-incident-add-update")
                        if currentStatus == "reported" || currentStatus == "investigating" {
                            Button("Mark resolved") { confirming = true }
                                .buttonStyle(.carbonTertiary)
                                .disabled(working)
                                .accessibilityIdentifier("security-incident-resolve")
                        }
                    }
                    .padding(.horizontal, 16)
                }
                CarbonSectionTitle("Timeline")
                RemoteContentView(
                    id: "security-incident-timeline",
                    state: timeline.state,
                    unavailableTitle: "Couldn't load the timeline",
                    unavailableMessage: "Updates may exist. Try again in a moment.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "No updates yet",
                    emptyMessage: "Notes added to this incident appear here, newest first.",
                    retry: { Task { await loadTimeline() } }
                ) { rows in
                    LazyVStack(spacing: 0) {
                        ForEach(rows) { row in
                            CarbonRow(row.description, detail: "\(row.updatedByName ?? "Someone") · \(ServerTime.short(row.createdAt))")
                                .accessibilityIdentifier("security-incident-update-\(row.id)")
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle(incident.incidentNumber).navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-security-incident")
        .task { await loadTimeline() }
        .confirmationDialog("Mark this incident resolved?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Mark resolved") { Task { await resolve() } }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func loadTimeline() async {
        guard let client else { return }
        await timeline.load { try await SecurityApi(client: client).updates(incident.id) }
    }

    private func addNote() async {
        await write { api in
            _ = try await api.addUpdate(incident.id, note.trimmingCharacters(in: .whitespaces))
            note = ""
        }
    }

    private func resolve() async {
        await write { api in status = try await api.resolveIncident(incident.id).status }
    }

    private func write(_ op: (SecurityApi) async throws -> Void) async {
        guard let client else { return }
        working = true
        defer { working = false }
        failure = nil
        do {
            try await op(SecurityApi(client: client))
            await loadTimeline()
        } catch {
            failure = securityWriteFailure(error)
        }
    }
}
