import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Registration, step by step, as the shared core defines it: the catalogue
/// says which fields each step has and which are on screen, the core's rules
/// say what is wrong, and the core builds the request. This screen only draws
/// and sends. "Check and register" runs the duplicate check first and never
/// creates silently — a match is confirmed, a check that could not run is
/// said out loud, and what happened is written into the record.
struct RegisterPatientView: View {
    @Environment(\.apiClient) private var client
    @Environment(ReceptionSession.self) private var session
    @Environment(\.calendar) private var calendar
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var draft = RegistrationDraftValues()
    /// 0…3 are the catalogue's steps; the last is Review.
    @State private var stepIndex = 0
    @State private var shown: [RegistrationProblem] = []
    @State private var failure: String?
    @State private var busy = false
    @State private var candidates: [MatchCandidate]?
    @State private var checkUnavailable = false
    @State private var registered: PatientSummary?
    @State private var visit: VisitStarted?

    private let catalogue = RegistrationCatalogue.shared
    private var stepCount: Int { catalogue.steps.count + 1 }
    private var onReview: Bool { stepIndex == catalogue.steps.count }
    private var stepTitle: String { onReview ? "Review" : catalogue.steps[stepIndex].title }
    private var lists: OptionLists {
        OptionLists(
            departments: session.departments.map { CatalogueOption(value: $0.id, label: $0.name) },
            doctors: session.doctors.map { CatalogueOption(value: $0.id, label: $0.fullName) }
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    CarbonPageHeader(eyebrow: "Reception", title: "Register a patient", subtitle: "Step \(stepIndex + 1) of \(stepCount) · \(stepTitle)")
                        .accessibilityIdentifier("register-step-title")
                    ProgressView(value: Double(stepIndex + 1), total: Double(stepCount)).tint(MedBrainsTheme.interactive)
                    if let registered {
                        RegisteredCard(patient: registered, onNext: nextWalkIn)
                    } else {
                        stepContent
                    }
                }
                .padding(16)
            }
            // A new step opens at its top, never where the last one was scrolled to.
            .id(stepIndex)
            // A refused step shows the first field to fix, not wherever the desk was.
            .onChange(of: shown.first?.field) { _, field in
                if let field { withAnimation(reduceMotion ? nil : .default) { reader.scrollTo(field, anchor: .top) } }
            }
            }
            if registered == nil { bottomBar }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Register").navigationBarTitleDisplayMode(.inline)
        // A container: without it the screen's id overwrites the step buttons' own.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("screen-register-patient")
        .onAppear(perform: takeDeskContext)
        .sheet(isPresented: Binding(get: { candidates != nil }, set: { if !$0 { candidates = nil } })) {
            DuplicateSheet(candidates: candidates ?? [], onRegisterAnyway: { matched in
                candidates = nil
                Task { await create(duplicateCheck: "overridden", matchedUhid: matched) }
            })
            .environment(session)
        }
        .navigationDestination(item: $visit) { v in
            if let registered {
                TokenIssuedView(patient: registered, visit: v, departmentName: session.departmentName(draft["department_id"]) ?? "the clinic")
                    .environment(session)
            }
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        let visible = draft.visible
        if onReview {
            RegistrationReview(draft: draft, lists: lists, visible: visible, onEdit: { stepIndex = $0 })
        } else {
            ForEach(catalogue.fields(in: catalogue.steps[stepIndex].step).filter { visible.contains($0.id) }) { field in
                CatalogueFieldView(field: field, draft: draft, lists: lists, error: shown.first { $0.field == field.id }?.message)
                    .id(field.id)
            }
        }
        if checkUnavailable {
            CarbonNotification(kind: .warning, title: "Duplicate check unavailable", message: "Nobody was compared. Registering now may give this person a second UHID; the record will say the check did not run.")
        }
        if let failure { CarbonNotification(kind: .error, title: "Not registered", message: failure) }
    }

    private var bottomBar: some View {
        HStack(spacing: 8) {
            if stepIndex > 0 {
                Button("Back") { shown = []; stepIndex -= 1 }.buttonStyle(.carbonTertiary).accessibilityIdentifier("register-step-back")
            }
            if onReview {
                Button { Task { await checkAndRegister() } } label: {
                    HStack { Text(checkUnavailable ? "Register unverified" : "Check and register"); Spacer(); Image(systemName: "arrow.right") }
                }
                .buttonStyle(.carbonPrimary).disabled(busy).accessibilityIdentifier("register-submit")
            } else {
                Button { next() } label: { HStack { Text("Next"); Spacer(); Image(systemName: "arrow.right") } }
                    .buttonStyle(.carbonPrimary).accessibilityIdentifier("register-step-next")
            }
        }
        .padding(16)
        .background(MedBrainsTheme.canvas)
    }

    /// The problems on screen in `step` (nil: every step).
    private func problems(in step: String?) -> [RegistrationProblem] {
        let visible = draft.visible
        let ids = Set(catalogue.fields.filter { step == nil || $0.step == step }.map(\.id))
        return draft.problems.filter { ids.contains($0.field) && visible.contains($0.field) }
    }

    private func next() {
        shown = problems(in: catalogue.steps[stepIndex].step)
        if let first = shown.first {
            UIAccessibility.post(notification: .announcement, argument: first.message)
            return
        }
        stepIndex += 1
    }

    /// The desk's department and consultant, kept between walk-ins.
    private func takeDeskContext() {
        if draft["department_id"].isEmpty, let dept = session.departmentId { draft["department_id"] = dept }
        if draft["consultant_id"].isEmpty, let doc = session.consultantId { draft["consultant_id"] = doc }
    }

    /// Every step's rules first; then the match; then the sheet, the warning, or the create.
    private func checkAndRegister() async {
        let all = problems(in: nil)
        if let first = all.first, let step = catalogue.field(first.field)?.step, let index = catalogue.steps.firstIndex(where: { $0.step == step }) {
            shown = all
            stepIndex = index
            return
        }
        guard let client else { return }
        failure = nil
        if checkUnavailable { await create(duplicateCheck: "unverified", matchedUhid: nil); return }
        busy = true
        defer { busy = false }
        let query = MatchQuery(firstName: draft["first_name"], lastName: draft["last_name"], dateOfBirth: draft["date_of_birth"].isEmpty ? nil : draft["date_of_birth"], phone: draft["phone"])
        let found = draft.isOn("is_unknown_patient") ? [] : try? await ReceptionApi(client: client).matchPatients(query)
        switch registrationAction(checkUnavailable: found == nil, matches: UInt32(found?.count ?? 0)) {
        case "confirm": candidates = found
        case "proceed_unverified": checkUnavailable = true
        default: await create(duplicateCheck: "none", matchedUhid: nil)
        }
    }

    private func create(duplicateCheck: String, matchedUhid: String?) async {
        guard let client, let request = JSONValue(parsing: draft.request(year: calendar.component(.year, from: Date()))) else { return }
        busy = true
        defer { busy = false }
        // How this registration was checked, so a second UHID is never silent.
        let audit: JSONValue = .object([
            "source": .string("mobile_staff"), "duplicate_check": .string(duplicateCheck),
            "matched_uhid": matchedUhid.map(JSONValue.string) ?? .null,
        ])
        let attributes = (request["attributes"] ?? .object([:])).setting("mobile_registration", to: audit)
        do {
            let api = ReceptionApi(client: client)
            let patient = try await api.createPatient(request.setting("attributes", to: attributes))
            registered = patient
            session.departmentId = draft["department_id"].isEmpty ? session.departmentId : draft["department_id"]
            session.consultantId = draft["consultant_id"].isEmpty ? nil : draft["consultant_id"]
            UIAccessibility.post(notification: .announcement, argument: "Registered. UHID \(patient.uhid)")
            if draft.isOn("create_opd_visit"), !draft["department_id"].isEmpty {
                visit = try await api.startVisit(StartVisitBody(
                    patientId: patient.id, departmentId: draft["department_id"],
                    doctorId: draft["consultant_id"].isEmpty ? nil : draft["consultant_id"],
                    chiefComplaint: draft["initial_diagnosis_text"].isEmpty ? nil : draft["initial_diagnosis_text"],
                    visitType: "walk_in"
                ))
            }
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was registered."
        }
    }

    /// The person is cleared; the desk stays.
    private func nextWalkIn() {
        registered = nil
        checkUnavailable = false
        shown = []
        failure = nil
        draft.clearPerson()
        stepIndex = 0
        takeDeskContext()
    }
}

/// The UHID in display type, then the identifiers the desk reads back.
private struct RegisteredCard: View {
    @Environment(ReceptionSession.self) private var session
    let patient: PatientSummary
    let onNext: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            CarbonTile(tone: .success) {
                Eyebrow("Registered")
                Text(patient.uhid).font(CarbonType.display).foregroundStyle(MedBrainsTheme.ink).accessibilityIdentifier("registered-uhid")
                Text(patient.fullName).font(CarbonType.heading03).foregroundStyle(MedBrainsTheme.ink)
                Text("\(patient.dateOfBirth ?? "DOB unknown")\(patient.isDobEstimated == true ? " (estimated)" : "") · \(patient.phone)").font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
                HStack(spacing: 8) {
                    if patient.isMedicoLegal == true { CarbonTag("MLC \(patient.mlcNumber ?? "")", tone: .danger) }
                    if patient.isVip == true { CarbonTag("VIP", tone: .info) }
                }
            }
            NavigationLink(value: ReceptionRoute.startVisit(patient)) {
                HStack { Text("Start visit"); Spacer(); Image(systemName: "arrow.right") }
            }
            .buttonStyle(.carbonPrimary).accessibilityIdentifier("register-start-visit")
            Button("Next walk-in", action: onNext).buttonStyle(.carbonTertiary).accessibilityIdentifier("register-next")
        }
        .padding(16)
    }
}

/// The possible duplicates, each openable; below them the way past, which
/// says what it does. Never a blank confirm.
private struct DuplicateSheet: View {
    let candidates: [MatchCandidate]
    let onRegisterAnyway: (String?) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    CarbonPageHeader(eyebrow: "Possible duplicate", title: "\(candidates.count) existing record\(candidates.count == 1 ? "" : "s") match", subtitle: "A second UHID splits allergies, history and results across two records. Use the existing record if it is the same person.")
                    ForEach(candidates) { c in
                        NavigationLink(value: ReceptionRoute.patient(c.asSummary)) {
                            CarbonRow("\(c.firstName) \(c.lastName)", detail: "\(c.uhid) · \(c.dateOfBirth ?? "DOB unknown") · \(c.phone)") {
                                Text("Use this record").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.interactive)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("duplicate-use-\(c.uhid)")
                    }
                    Button("Register as new anyway") { onRegisterAnyway(candidates.first?.uhid) }
                        .buttonStyle(.carbonDanger).accessibilityIdentifier("duplicate-register-anyway")
                }
                .padding(16)
            }
            .background(MedBrainsTheme.canvas)
            .accessibilityIdentifier("duplicate-sheet")
            .navigationDestination(for: ReceptionRoute.self) { route in ReceptionDestination(route: route) }
        }
    }
}
