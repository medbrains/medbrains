import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// A booking as the desk sees it. The list answer flattens the appointment
/// with the patient's and doctor's names.
struct AppointmentSummary: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let patientId: String
    let doctorId: String
    let departmentId: String
    let appointmentDate: String
    let slotStart: String
    let slotEnd: String
    var status: String
    var tokenNumber: Int? = nil
    let reason: String?
    var encounterId: String? = nil
    var patientName: String? = nil
    var doctorName: String? = nil
    /// The server's own answer: the check-in and no-show calls hop to the
    /// patient and refuse without access. Offering a button it will refuse
    /// teaches the desk that the screen lies.
    var canManage: Bool = true

    var time: String { String(slotStart.prefix(5)) }
}

/// What `check-in`, `no-show` and `book` answer: the appointment row itself,
/// without the names and the permission the list adds. Decoding those replies
/// as list rows failed, and a failed decode reads on screen as an outage.
struct AppointmentRecord: Decodable, Hashable, Sendable {
    let id: String
    let doctorId: String
    let appointmentDate: String
    let slotStart: String
    let status: String
    var tokenNumber: Int? = nil
    var encounterId: String? = nil

    var time: String { String(slotStart.prefix(5)) }
}

struct AvailableSlot: Decodable, Hashable, Identifiable, Sendable {
    let startTime: String
    let endTime: String
    let bookedCount: Int
    let maxPatients: Int
    let isAvailable: Bool
    var id: String { startTime }
    var time: String { String(startTime.prefix(5)) }
}

struct BookBody: Encodable {
    let patientId: String
    let doctorId: String
    let departmentId: String
    let appointmentDate: String
    let slotStart: String
    let slotEnd: String
    let appointmentType: String
}

extension ReceptionApi {
    func appointments(on date: String) async throws -> [AppointmentSummary] { try await client.request(.get, "/api/opd/appointments?date=\(date)") }
    func checkIn(_ id: String) async throws -> AppointmentRecord { try await client.request(.put, "/api/opd/appointments/\(id)/check-in") }
    func noShow(_ id: String) async throws -> AppointmentRecord { try await client.request(.put, "/api/opd/appointments/\(id)/no-show") }
    func slots(doctorId: String, date: String) async throws -> [AvailableSlot] { try await client.request(.get, "/api/opd/doctors/\(doctorId)/slots?date=\(date)") }
    func book(_ body: BookBody) async throws -> AppointmentRecord { try await client.request(.post, "/api/opd/appointments", body: body) }
}

enum DeskClock {
    static func iso(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }
    static func time(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "HH:mm:ss"; return f.string(from: date)
    }
}

/// Today's bookings in time order. A row offers only what the core says the
/// server will accept; check-in is the server's own path and issues the
/// token, which the row then shows.
struct AppointmentsTodayView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.apiClient) private var client
    @State private var remote = Remote<[AppointmentSummary]>()
    @State private var busyId: String?
    @State private var failure: String?

    private var today: String { DeskClock.iso(Date()) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Appointments today", subtitle: today)
                if let failure { CarbonNotification(kind: .error, title: "Not recorded", message: failure).padding(16) }
                RemoteContentView(id: "appointments", state: remote.state, unavailableTitle: "Couldn't load today's bookings", unavailableMessage: "The hospital server did not answer. Do not read this as a free day.", isEmpty: \.isEmpty, emptyTitle: "No appointments today", emptyMessage: "Nothing booked for today. Walk-ins go through Register.", retry: { Task { await load() } }) { rows in
                    LazyVStack(spacing: 1) {
                        ForEach(rows.sorted { $0.slotStart < $1.slotStart }) { a in
                            row(a)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Appointments").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-appointments")
        .task { await load() }
    }

    @ViewBuilder
    private func row(_ a: AppointmentSummary) -> some View {
        let allowed = (auth.identity?.can("opd.appointment.update") ?? false) && a.canManage
        let actions = allowed ? appointmentActions(status: a.status, isToday: a.appointmentDate == today) : []
        // The identifier belongs on this line, not on the enclosing stack: a
        // container's identifier is inherited by every child, which hides the
        // row's own buttons behind the row's id.
        VStack(alignment: .leading, spacing: 8) {
            CarbonRow("\(a.time) · \(a.patientName ?? "Unnamed patient")", detail: a.doctorName ?? "") {
                CarbonTag(a.status.replacingOccurrences(of: "_", with: " "), tone: tone(a.status))
            }
            .accessibilityIdentifier("appt-row-\(a.id)")
            if let n = a.tokenNumber, a.status == "checked_in" {
                Text("Token \(n)").font(CarbonType.heading02).foregroundStyle(MedBrainsTheme.ink)
                    .accessibilityIdentifier("appt-token-\(a.id)")
            }
            if !actions.isEmpty {
                HStack(spacing: 8) {
                    if actions.contains("check_in") {
                        Button("Check in") { Task { await act(a, checkIn: true) } }.buttonStyle(.carbonPrimary).disabled(busyId != nil)
                            .accessibilityIdentifier("appt-check-in-\(a.id)")
                    }
                    if actions.contains("no_show") {
                        Button("No-show") { Task { await act(a, checkIn: false) } }.buttonStyle(.carbonTertiary).disabled(busyId != nil)
                            .accessibilityIdentifier("appt-no-show-\(a.id)")
                    }
                }
                .padding(.bottom, 8)
            }
            if !a.canManage, auth.identity?.can("opd.appointment.update") ?? false {
                Text("Booked at another desk — this account cannot check them in.")
                    .font(CarbonType.helper).foregroundStyle(MedBrainsTheme.inkSecondary)
                    .padding(.bottom, 8)
                    .accessibilityIdentifier("appt-not-yours-\(a.id)")
            }
        }
    }

    private func tone(_ status: String) -> CarbonTone {
        switch status {
        case "checked_in", "in_consultation": .info
        case "completed": .success
        case "no_show", "cancelled": .danger
        default: .warning
        }
    }

    private func load() async {
        guard let client else { return }
        await remote.load { try await ReceptionApi(client: client).appointments(on: today) }
    }

    private func act(_ a: AppointmentSummary, checkIn: Bool) async {
        guard let client else { return }
        busyId = a.id
        defer { busyId = nil }
        failure = nil
        do {
            let api = ReceptionApi(client: client)
            let updated = checkIn ? try await api.checkIn(a.id) : try await api.noShow(a.id)
            if checkIn, let n = updated.tokenNumber { UIAccessibility.post(notification: .announcement, argument: "Checked in. Token \(n).") }
            await load()
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was recorded."
        }
    }
}

/// Doctor, date, then the day's slots the core says may be offered; one tap
/// picks, one confirms. The card that follows is what the desk reads back.
struct BookAppointmentView: View {
    @Environment(\.apiClient) private var client
    @Environment(ReceptionSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let patient: PatientSummary
    @State private var doctorId: String?
    @State private var departmentId: String?
    @State private var date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var slots = Remote<[AvailableSlot]>()
    @State private var chosen: AvailableSlot?
    @State private var busy = false
    @State private var failure: String?
    @State private var booked: AppointmentRecord?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                CarbonPageHeader(eyebrow: "Book appointment", title: patient.fullName, subtitle: patient.identifiers)
                if let booked {
                    CarbonTile(tone: .success) {
                        Eyebrow("Booked")
                        Text("\(booked.appointmentDate) at \(booked.time)").font(CarbonType.heading03).foregroundStyle(MedBrainsTheme.ink)
                            .accessibilityIdentifier("booked-card")
                        Text(session.doctorName(booked.doctorId) ?? "Consultant").font(CarbonType.body).foregroundStyle(MedBrainsTheme.ink)
                        Text(patient.identifiers).font(CarbonType.codeSmall).foregroundStyle(MedBrainsTheme.inkSecondary)
                    }
                    Button("Done") { dismiss() }.buttonStyle(.carbonPrimary).accessibilityIdentifier("booked-done")
                } else {
                    CarbonPicker("Doctor", options: session.doctors.map { .init(id: $0.id, label: $0.fullName) }, selection: $doctorId, placeholder: "Choose a doctor")
                        .accessibilityIdentifier("picker-doctor")
                    CarbonPicker("Department", options: session.departments.map { .init(id: $0.id, label: $0.name) }, selection: $departmentId, placeholder: "Choose a department")
                        .accessibilityIdentifier("picker-department")
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Date").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                        DatePicker("Date", selection: $date, in: Date()..., displayedComponents: .date).labelsHidden().accessibilityIdentifier("field-date")
                    }
                    if doctorId != nil {
                        RemoteContentView(id: "slots", state: slots.state, unavailableTitle: "Couldn't load the slots", unavailableMessage: "The hospital server did not answer.", isEmpty: \.isEmpty, emptyTitle: "No slots that day", emptyMessage: "Nothing left to offer on that date. Try another day.", retry: { Task { await loadSlots() } }) { rows in
                            let now = DeskClock.time(Date()), today = DeskClock.iso(Date()), day = DeskClock.iso(date)
                            let offered = rows.filter { slotIsBookable(date: day, startTime: $0.startTime, today: today, nowTime: now, isAvailable: $0.isAvailable) }
                            if offered.isEmpty {
                                Text("Every slot that day has passed or is full.").font(CarbonType.body).foregroundStyle(MedBrainsTheme.inkSecondary).accessibilityIdentifier("slots-none-offered")
                            }
                            LazyVStack(spacing: 1) {
                                ForEach(offered) { s in
                                    Button { chosen = s } label: {
                                        CarbonRow("\(s.time) – \(String(s.endTime.prefix(5)))", detail: "\(s.bookedCount) of \(s.maxPatients) booked") {
                                            if chosen?.id == s.id { CarbonTag("chosen", tone: .info) }
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityIdentifier("slot-\(s.startTime)")
                                }
                            }
                        }
                    }
                    if let failure { CarbonNotification(kind: .error, title: "Not booked", message: failure) }
                    Button { Task { await book() } } label: { HStack { Text(chosen.map { "Book \($0.time)" } ?? "Choose a slot"); Spacer(); Image(systemName: "arrow.right") } }
                        .buttonStyle(.carbonPrimary).disabled(busy || chosen == nil || doctorId == nil || departmentId == nil)
                        .accessibilityIdentifier("book-submit")
                }
            }
            .padding(16)
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Book").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-book-appointment")
        .onAppear { if doctorId == nil { doctorId = session.consultantId; departmentId = session.departmentId } }
        .task(id: "\(doctorId ?? "")|\(DeskClock.iso(date))") { await loadSlots() }
    }

    private func loadSlots() async {
        guard let client, let doctorId else { return }
        chosen = nil
        await slots.load { try await ReceptionApi(client: client).slots(doctorId: doctorId, date: DeskClock.iso(date)) }
    }

    private func book() async {
        guard let client, let doctorId, let departmentId, let chosen else { return }
        busy = true
        defer { busy = false }
        failure = nil
        do {
            booked = try await ReceptionApi(client: client).book(BookBody(patientId: patient.id, doctorId: doctorId, departmentId: departmentId, appointmentDate: DeskClock.iso(date), slotStart: chosen.startTime, slotEnd: chosen.endTime, appointmentType: "new_visit"))
            UIAccessibility.post(notification: .announcement, argument: "Booked \(DeskClock.iso(date)) at \(chosen.time).")
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was booked."
        }
    }
}
