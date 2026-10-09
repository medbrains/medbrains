import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One call: the visit, the queue entry and the token come back together.
/// Department and consultant are prefilled from the patient's last visit,
/// else from the desk.
struct StartVisitView: View {
    @Environment(\.apiClient) private var client
    @Environment(ReceptionSession.self) private var session
    let patient: PatientSummary
    @State private var departmentId: String?
    @State private var doctorId: String?
    @State private var complaint = ""
    @State private var failure: String?
    @State private var busy = false
    @State private var started: VisitStarted?
    @State private var last: LastVisitState = .loading
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Start visit", title: patient.fullName, subtitle: patient.identifiers)
                lastVisitRow
                CarbonPicker("Department", options: session.departments.map { .init(id: $0.id, label: $0.name) }, selection: $departmentId, placeholder: "Choose a department", error: failure == nil || departmentId != nil ? nil : "Choose a department")
                    .accessibilityIdentifier("picker-department")
                CarbonPicker("Consultant", options: session.doctors.map { .init(id: $0.id, label: $0.fullName) }, selection: $doctorId, placeholder: "Any consultant")
                    .accessibilityIdentifier("picker-consultant")
                CarbonField("Chief complaint (optional)", isFocused: focused) {
                    TextField("Why they are here", text: $complaint, axis: .vertical).lineLimit(2...4).focused($focused).accessibilityIdentifier("field-chief_complaint")
                }
                if let failure { CarbonNotification(kind: .error, title: "No token issued", message: failure) }
                Button { Task { await start() } } label: { HStack { Text("Start visit and issue token"); Spacer(); Image(systemName: "arrow.right") } }
                    .buttonStyle(.carbonPrimary).disabled(busy || departmentId == nil)
                    .accessibilityIdentifier("start-visit-submit")
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Start visit").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-start-visit")
        .onAppear { if departmentId == nil { departmentId = session.departmentId; doctorId = session.consultantId } }
        .task { await loadLastVisit() }
        .navigationDestination(item: $started) { v in
            TokenIssuedView(patient: patient, visit: v, departmentName: session.departmentName(departmentId) ?? "the clinic")
                .environment(session)
        }
    }

    @ViewBuilder private var lastVisitRow: some View {
        switch last {
        case .loading: EmptyView()
        case .none: CarbonRow("Last visit", detail: "First OPD visit")
        case .found(let visit):
            CarbonRow("Last visit", detail: visit.doctorName != nil && visit.doctorId == nil ? visit.summary + " — no longer taking patients" : visit.summary)
                .accessibilityIdentifier("last-visit")
        case .failed: CarbonRow("Last visit", detail: "Could not be loaded; choose the doctor yourself")
        }
    }

    /// Send them back to the doctor who saw them, unless the desk has
    /// already changed the pickers.
    private func loadLastVisit() async {
        guard let client else { return }
        do {
            guard let visit = try await ReceptionApi(client: client).lastVisit(patient.id) else { last = .none; return }
            last = .found(visit)
            guard departmentId == session.departmentId, doctorId == session.consultantId else { return }
            if let dept = visit.departmentId, session.departments.contains(where: { $0.id == dept }) { departmentId = dept }
            if let doctor = visit.doctorId, session.doctors.contains(where: { $0.id == doctor }) { doctorId = doctor }
        } catch {
            last = .failed
        }
    }

    private func start() async {
        guard let client, let departmentId else { return }
        busy = true
        defer { busy = false }
        failure = nil
        session.departmentId = departmentId
        session.consultantId = doctorId
        let body = StartVisitBody(patientId: patient.id, departmentId: departmentId, doctorId: doctorId, chiefComplaint: complaint.isEmpty ? nil : complaint, visitType: "walk_in")
        do {
            started = try await ReceptionApi(client: client).startVisit(body)
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. No visit was started."
        }
    }
}

private enum LastVisitState { case loading, none, found(LastVisit), failed }

/// The token in display type, and the sentence the desk says. Announced,
/// not only shown. Pushed by an item destination, so its own onward moves are
/// programmatic too — a value link from inside an item destination does not
/// push.
struct TokenIssuedView: View {
    // Handed on explicitly: a destination presented from here takes its
    // environment from the navigation stack, which is above the module's session.
    @Environment(ReceptionSession.self) private var session
    let patient: PatientSummary
    let visit: VisitStarted
    let departmentName: String
    @State private var showBoard = false
    @State private var showFind = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonTile(tone: .info) {
                    Eyebrow("Token")
                    // Verbatim: a token is a number read out, not a quantity — never "1,003".
                    Text(verbatim: String(visit.queue.tokenNumber)).font(CarbonType.display).foregroundStyle(MedBrainsTheme.ink)
                        .accessibilityIdentifier("token-number")
                    Text(verbatim: "Tell them token \(visit.queue.tokenNumber) for \(departmentName).").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                }
                CarbonRow(patient.fullName, detail: patient.identifiers)
                CarbonRow("Status", detail: visit.queue.status)
                Button { showBoard = true } label: { HStack { Text("Queue board"); Spacer(); Image(systemName: "arrow.right") } }
                    .buttonStyle(.carbonPrimary).accessibilityIdentifier("token-board")
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Token issued").navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { showFind = true }.accessibilityIdentifier("token-done") } }
        .navigationDestination(isPresented: $showBoard) { ReceptionQueueBoardView().environment(session) }
        .navigationDestination(isPresented: $showFind) { FindPatientView() }
        .accessibilityIdentifier("screen-token-issued")
        .onAppear { UIAccessibility.post(notification: .announcement, argument: "Token \(visit.queue.tokenNumber) issued for \(patient.fullName). They are now waiting.") }
    }
}
