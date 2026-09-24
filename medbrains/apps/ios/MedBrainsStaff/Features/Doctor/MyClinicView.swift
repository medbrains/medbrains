import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// A doctor's own clinic for today, filtered by the signed-in doctor rather
/// than a picker, leading with the next patient because that is the question
/// being asked. Ordering and "what is next" come from the clinical core.
struct MyClinicView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[AppointmentRow]>()

    /// A day's clinic; more than this is a data problem, not a workload.
    private let maxRows = 100

    var body: some View {
        let raw = Array((remote.value ?? []).prefix(maxRows))
        let order = clinicOrder(startTimes: raw.map(\.startTime)).map { raw[Int($0)] }
        let nextIndex = clinicNextPatient(startTimes: raw.map(\.startTime), statuses: raw.map(\.status)).map { raw[Int($0)] }
        let remaining = clinicRemainingCount(statuses: raw.map(\.status))
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Clinic", title: "Today", subtitle: "Your appointments, earliest first.") {
                    if remaining > 0 { CarbonTag("\(remaining) left", tone: .info) }
                }
                RemoteContentView(
                    id: "my-clinic",
                    state: remote.state,
                    unavailableTitle: "Couldn't load your clinic",
                    unavailableMessage: "Today's list could not be loaded. Do not read this as a free day.",
                    isEmpty: \.isEmpty,
                    emptyTitle: "Nothing booked today",
                    emptyMessage: "No appointments on your list.",
                    retry: { Task { await load() } }
                ) { _ in
                    VStack(alignment: .leading, spacing: 0) {
                        VStack(alignment: .leading, spacing: 4) {
                            Eyebrow(nextIndex != nil ? "Next" : "Clinic finished")
                            Text(nextIndex.map { "\($0.startTime ?? "No time") · \($0.patientName ?? "Patient")" } ?? "Everyone has been seen")
                                .font(CarbonType.heading03).foregroundStyle(MedBrainsTheme.ink)
                        }
                        .padding(16)
                        ForEach(order) { a in
                            CarbonRow(a.patientName ?? "Patient", detail: (a.startTime ?? "No time set") + (a.reason.map { " · \($0)" } ?? "")) {
                                CarbonTag(a.status.replacingOccurrences(of: "_", with: " "), tone: clinicIsStillToCome(status: a.status) ? .info : .neutral)
                            }
                        }
                    }
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Today")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-my-clinic")
        .task { await load() }
    }

    private func load() async {
        guard let client, let me = auth.identity?.userId else { return }
        let today = Date().formatted(.iso8601.year().month().day())
        await remote.load { try await DoctorApi(client: client).listMyAppointments(doctorId: me, date: today) }
    }
}
