import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// Where the doctor module's screens are. Mirrors apps/mobile-staff/src/modules/doctor.tsx.
enum DoctorRoute: Hashable {
    case queue
    case queueDetail(WorklistToken)
    case consultation(WorklistToken)
    case ipdRounds
    case roundDetail(AdmissionRow)
    case myClinic
}

/// The doctor's front door: the queue count, then the actions the role
/// holds. "Start consultation" goes through the queue on purpose — a
/// consultation is written against a patient, and the queue is where the
/// doctor picks one.
struct DoctorHomeView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var queue = Remote<[WorklistToken]>()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow("Module")
                    Text("Consultations, prescriptions, clinical notes.").font(CarbonType.bodyCompact).foregroundStyle(MedBrainsTheme.inkSecondary)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                HStack(spacing: 1) {
                    StatTile(eyebrow: "Queue", count: queue.value.map { $0.filter { $0.status == "waiting" }.count }, title: "OPD queue (today)")
                    StatTile(eyebrow: "Vitals", count: nil, title: "Pending review")
                }
                .padding(.horizontal, 16)
                CarbonSectionTitle("Actions")
                let who = auth.identity
                action("queue", "OPD queue", "Call next, view tokens, mark consult complete.", "person.3.sequence", .queue, allowed: who?.can("opd.queue.list") ?? false)
                action("visit", "Start consultation", "Pick a patient from the queue and record the SOAP note.", "square.and.pencil", .queue, allowed: who?.can("opd.visit.update") ?? false)
                action("ipd-rounds", "IPD rounds", "Ward patients with mini EMR review context.", "bed.double", .ipdRounds, allowed: who?.can("ipd.admissions.list") ?? false)
                action("appointments", "Appointments", "View today's schedule and reschedule.", "calendar", .myClinic, allowed: who?.can("opd.appointment.list") ?? false)
            }
        }
        .background(MedBrainsTheme.canvas)
        .accessibilityIdentifier("module-home-doctor")
        .navigationDestination(for: DoctorRoute.self) { route in
            switch route {
            case .queue: QueueListView()
            case .queueDetail(let t): QueueDetailView(token: t)
            case .consultation(let t): ConsultationView(token: t)
            case .ipdRounds: IpdRoundsView()
            case .roundDetail(let a): IpdRoundDetailView(admission: a)
            case .myClinic: MyClinicView()
            }
        }
        .task {
            guard let client else { return }
            await queue.load { try await DoctorApi(client: client).listWorklist() }
        }
    }

    @ViewBuilder
    private func action(_ id: String, _ label: String, _ detail: String, _ symbol: String, _ route: DoctorRoute, allowed: Bool) -> some View {
        if allowed {
            NavigationLink(value: route) {
                CarbonRow(label, detail: detail) { Image(systemName: symbol).foregroundStyle(MedBrainsTheme.interactive) }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("module-action-\(id)")
        }
    }
}

func tokenTone(_ status: String) -> CarbonTone {
    switch status {
    case "waiting": .warning
    case "called", "serving": .info
    case "completed": .success
    default: .neutral
    }
}
