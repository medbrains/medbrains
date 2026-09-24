import MedBrainsKit
import MedBrainsUI
import SwiftUI

enum ReceptionRoute: Hashable {
    case register
    case find
    case patient(PatientSummary)
    case startVisit(PatientSummary)
    case tokenIssued(PatientSummary, VisitStarted, String)
    case board
    case appointments
    case book(PatientSummary)
    case visitors
    case registerVisitor
    case enquiries
    case logEnquiry
}

/// What survives between two walk-ins at the same desk: the department, the
/// consultant, where people are coming from. Never the person — the rule
/// lives in `medbrains-clinical-core` (`registration_carries_over`). Also the
/// pickers' rows, loaded once per session rather than once per patient.
@Observable
final class ReceptionSession {
    var departmentId: String?
    var consultantId: String?
    var source = "walk_in"
    var referredByName = ""
    var departments: [DepartmentRow] = []
    var doctors: [DoctorRow] = []

    func departmentName(_ id: String?) -> String? { departments.first { $0.id == id }?.name }
    func doctorName(_ id: String?) -> String? { doctors.first { $0.id == id }?.fullName }
}

/// One place that turns a route into a screen, so a stack opened inside a
/// sheet (the duplicate check's "Use this record") reaches the same screens
/// as the module's own stack.
struct ReceptionDestination: View {
    let route: ReceptionRoute
    var body: some View {
        switch route {
        case .register: RegisterPatientView()
        case .find: FindPatientView()
        case .patient(let p): ReceptionPatientView(patient: p)
        case .startVisit(let p): StartVisitView(patient: p)
        case .tokenIssued(let p, let v, let dept): TokenIssuedView(patient: p, visit: v, departmentName: dept)
        case .board: ReceptionQueueBoardView()
        case .appointments: AppointmentsTodayView()
        case .book(let p): BookAppointmentView(patient: p)
        case .visitors: VisitorDeskView()
        case .registerVisitor: RegisterVisitorView()
        case .enquiries: EnquiryDeskView()
        case .logEnquiry: LogEnquiryView()
        }
    }
}

/// The desk's front door: how many are waiting, then the three things a desk
/// does, in the order it does them. Each action is gated on its own
/// permission and absent without it — a `front_office_staff` sees the board
/// and nothing to register with, which is that role's grant, not a blank.
struct ReceptionHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var session = ReceptionSession()
    @State private var queue = Remote<[WorklistToken]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Module")
                    Text("Register, find, send to a clinic, call the floor.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                HStack(spacing: 1) {
                    StatTile(eyebrow: "Waiting", count: queue.value.map { $0.filter { $0.status == "waiting" }.count }, title: "OPD tokens waiting now")
                    StatTile(eyebrow: "Called", count: queue.value.map { $0.filter { $0.status == "called" }.count }, title: "Called, not yet in")
                }
                .padding(.horizontal, 16)
                CarbonSectionTitle("Actions")
                let who = auth.identity
                if !(who?.canAny(["patients.create", "patients.list", "patients.find", "opd.queue.list", "opd.appointment.list", "front_office.passes.list", "front_office.enquiry.list"]) ?? false) {
                    Text("Your role holds the reception module but none of its desk actions yet. Ask an administrator for one of its codes: patients, OPD queue, appointments, passes or enquiries.")
                        .font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary).padding(16)
                        .accessibilityIdentifier("reception-no-actions")
                }
                action("register", "Register a patient", "New walk-in: identity, safety flags, the desk's clinic.", "person.badge.plus", .register, allowed: who?.can("patients.create") ?? false)
                action("find", "Find a patient", "By UHID, name or phone, anywhere in the hospital.", "magnifyingglass", .find, allowed: who?.can("patients.find") ?? false)
                action("appointments", "Appointments today", "Check in the booked, mark the missing.", "calendar", .appointments, allowed: who?.can("opd.appointment.list") ?? false)
                action("queue", "Queue board", "Who is waiting, and one Call next for the floor.", "person.3.sequence", .board, allowed: who?.can("opd.queue.list") ?? false)
                action("visitors", "Visitor desk", "Passes, who is inside, and who is overdue.", "person.2.badge.key", .visitors, allowed: who?.can("front_office.passes.list") ?? false)
                action("enquiries", "Enquiry desk", "What was asked at the door, and the answer given.", "bubble.left.and.text.bubble.right", .enquiries, allowed: who?.can("front_office.enquiry.list") ?? false)
            }
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("module-home-reception")
        .environment(session)
        .navigationDestination(for: ReceptionRoute.self) { route in
            ReceptionDestination(route: route).environment(session)
        }
        .task {
            guard let client else { return }
            let api = ReceptionApi(client: client)
            async let d = try? api.departments()
            async let r = try? api.doctors()
            session.departments = await d ?? []
            session.doctors = await r ?? []
            if auth.identity?.can("opd.queue.list") ?? false {
                await queue.load { try await DoctorApi(client: client).listWorklist() }
            }
        }
    }

    @ViewBuilder
    private func action(_ id: String, _ label: String, _ detail: String, _ symbol: String, _ route: ReceptionRoute, allowed: Bool) -> some View {
        if allowed {
            NavigationLink(value: route) {
                CarbonRow(label, detail: detail) { Image(systemName: symbol).foregroundStyle(MedBrainsTheme.interactive) }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("module-action-\(id)")
        }
    }
}
