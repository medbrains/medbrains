import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Where the other-hospital records screens are, on any stack that links to them.
enum AbdmRoute: Hashable {
    case records(patientId: String, patientName: String)
    case record(id: String)
}

extension View {
    /// Registers the records screens on a module's stack (doctor, nurse).
    func abdmRecordsDestinations() -> some View {
        navigationDestination(for: AbdmRoute.self) { route in
            switch route {
            case .records(let id, let name): OtherHospitalRecordsView(patientId: id, patientName: name)
            case .record(let id): ReceivedRecordView(recordId: id)
            }
        }
    }
}

/// The patient's row into their records from other hospitals: shown only to
/// those who hold `abdm.consent.view`, and only for a known patient.
struct OtherHospitalRecordsLink: View {
    @Environment(AuthStore.self) private var auth
    let patientId: String?
    let patientName: String

    var body: some View {
        if let patientId, auth.identity?.can(AbdmRecords.Permission.view) ?? false {
            NavigationLink(value: AbdmRoute.records(patientId: patientId, patientName: patientName)) {
                CarbonRow("Records from other hospitals", detail: "Shared through ABDM with the patient's consent.") {
                    Image(systemName: "building.2").foregroundStyle(MedBrainsTheme.interactive).accessibilityHidden(true)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("open-other-hospital-records")
        }
    }
}

/// Patient → records from other hospitals (ABDM HIU): the consent requests
/// raised for them with what each state means, and the copies other
/// facilities sent, grouped by facility. Requesting needs
/// `abdm.consent.request`; a patient this person may not see reads as
/// "not available", never as "none".
struct OtherHospitalRecordsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    let patientId: String
    let patientName: String
    @State private var remote = Remote<AbdmRecords.PatientView>()
    @State private var action = QueueActionState()
    @State private var asking = false

    private var api: AbdmRecordsApi? { client.map(AbdmRecordsApi.init) }
    private var canRequest: Bool { auth.identity?.can(AbdmRecords.Permission.request) ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Other hospitals", title: patientName, subtitle: "Records held elsewhere, shared through ABDM with the patient's consent.")
                if remote.isNotAvailable {
                    CarbonNotification(kind: .warning, title: "Not available", message: "This patient's records from other hospitals are not available to you. This does not mean there are none.")
                        .padding(16)
                        .accessibilityIdentifier("abdm-records-not-available")
                } else {
                    RemoteContentView(
                        id: "abdm-records", state: remote.state,
                        unavailableTitle: "Could not load records from other hospitals",
                        unavailableMessage: "This does not mean there are none — the list failed to load.",
                        isEmpty: { _ in false }, emptyTitle: "", emptyMessage: "",
                        retry: { Task { await load() } }
                    ) { view in content(view) }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Other hospitals")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-abdm-records")
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $asking) {
            ConsentRequestForm(patientId: patientId) { await load() }
        }
    }

    @ViewBuilder
    private func content(_ view: AbdmRecords.PatientView) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let reason = view.blockedReason {
                CarbonNotification(kind: .warning, title: "Records cannot be requested", message: reason)
                    .padding(16)
                    .accessibilityIdentifier("abdm-blocked")
            }
            if AbdmRecords.canRaise(view, holdsRequest: canRequest) {
                Button { asking = true } label: { Label("Request records", systemImage: "plus") }
                    .buttonStyle(.carbonPrimary)
                    .padding(16)
                    .accessibilityIdentifier("abdm-request-records")
            }
            if let failure = action.failure {
                CarbonNotification(kind: .error, title: "Could not check the status", message: failure).padding(.horizontal, 16)
            } else if let toast = action.toast {
                CarbonNotification(kind: .info, title: toast, message: "").padding(.horizontal, 16).accessibilityIdentifier("abdm-toast")
            }
            CarbonSectionTitle("Requests")
            if view.requests.isEmpty {
                note("No request yet. Ask for the patient's records from other hospitals with \"Request records\".").accessibilityIdentifier("abdm-requests-empty")
            }
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(view.requests) { requestRow($0) }
            }
            CarbonSectionTitle("Records received")
            let erased = view.requests.map(AbdmRecords.erased).reduce(0, +)
            if erased > 0 {
                CarbonNotification(kind: .info, title: "\(erased) record\(erased == 1 ? "" : "s") erased", message: "A consent was withdrawn or ended, and the copies received under it were erased.")
                    .padding(.horizontal, 16)
                    .accessibilityIdentifier("abdm-erased")
            }
            if view.records.isEmpty {
                note("No records held. They appear here once the patient grants a request and the other hospital sends them, and are erased when the consent ends.")
                    .accessibilityIdentifier("abdm-records-empty")
            }
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(AbdmRecords.byFacility(view.records)) { group in
                    Eyebrow(group.name).padding(.horizontal, 16).padding(.top, 16)
                    ForEach(group.records) { record in
                        NavigationLink(value: AbdmRoute.record(id: record.id)) {
                            CarbonRow(record.title ?? record.careContextReference, detail: "\(ServerTime.dateOf(record.recordDate ?? record.receivedAt)) · held until \(ServerTime.dateOf(record.eraseAt))") {
                                CarbonTag(AbdmRecords.hiTypeLabel(record.hiType))
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("abdm-record-\(record.id)")
                    }
                }
            }
        }
    }

    private func requestRow(_ r: AbdmRecords.ConsentRequest) -> some View {
        let status = AbdmRecords.status(r.status)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(AbdmRecords.purposeLabel(r.purposeCode)).font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                Spacer(minLength: 8)
                CarbonTag(status.label, tone: CarbonTone(status.tone))
            }
            detail(r.hiTypes.map(AbdmRecords.hiTypeLabel).joined(separator: ", "))
            detail("\(ServerTime.dateOf(r.dateFrom)) – \(ServerTime.dateOf(r.dateTo)) · erase by \(ServerTime.dateOf(r.dataEraseAt))")
            Text(r.error ?? status.hint).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.ink)
            detail("Requested \(ServerTime.short(r.requestedAt)) by \(r.requesterName)")
            if r.recordsReceived > 0 { detail("\(r.recordsHeld) of \(r.recordsReceived) records held") }
            if AbdmRecords.isCheckable(r) {
                detail(r.statusCheckedAt.map { "Last checked \(ServerTime.short($0))" } ?? "Not checked with ABDM yet")
                if canRequest {
                    Button { Task { await check(r.id) } } label: { Label("Check status", systemImage: "arrow.clockwise") }
                        .buttonStyle(.carbonTertiary)
                        .disabled(action.busy)
                        .accessibilityIdentifier("abdm-check-\(r.id)")
                }
            }
        }
        .padding(16)
        .overlay(alignment: .bottom) { Rectangle().fill(MedBrainsTheme.hairline).frame(height: 1) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("abdm-request-\(r.id)")
    }

    private func detail(_ text: String) -> some View {
        Text(text).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
    }

    private func note(_ text: String) -> some View {
        Text(text).font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary).padding(.horizontal, 16)
    }

    /// Reads gate the fetch: without `abdm.consent.view` nothing is asked.
    private func load() async {
        guard let api, auth.identity?.can(AbdmRecords.Permission.view) ?? false else { return }
        await remote.load { try await api.patientView(patientId) }
    }

    private func check(_ id: String) async {
        guard let api else { return }
        await action.run(unreachable: "Could not reach the hospital server.") {
            let row = try await api.checkStatus(id)
            return "Status checked with ABDM: \(AbdmRecords.status(row.status).label)"
        }
        // The list reloads either way: the answer may have arrived meanwhile.
        await load()
    }
}
