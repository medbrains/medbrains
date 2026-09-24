import MedBrainsCore
import MedBrainsKit
import MedBrainsUI
import SwiftUI

/// One screen, no sections to scroll through: the person, the safety flags,
/// and the desk. "Check and register" runs the duplicate check first and
/// never creates silently — a match is confirmed, a check that could not run
/// is said out loud, and what happened is written into the record.
struct RegisterPatientView: View {
    @Environment(\.apiClient) private var client
    @Environment(ReceptionSession.self) private var session
    @Environment(\.calendar) private var calendar

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var gender = "female"
    @State private var phone = ""
    @State private var dateOfBirth: Date?
    @State private var age = ""
    @State private var abha = ""
    @State private var isMedicoLegal = false
    @State private var mlcNumber = ""
    @State private var isVip = false

    @State private var problem: RegistrationProblem?
    @State private var failure: String?
    @State private var busy = false
    @State private var candidates: [MatchCandidate]?
    @State private var checkUnavailable = false
    @State private var registered: PatientSummary?
    @FocusState private var focus: String?

    var body: some View {
        @Bindable var session = session
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CarbonPageHeader(eyebrow: "Reception", title: "Register a patient", subtitle: "Two identifiers, a phone, and where they are going.")
                if let registered {
                    RegisteredCard(patient: registered, onNext: nextWalkIn)
                } else {
                    form(session: $session)
                }
            }
        }
        .background(MedBrainsTheme.canvas)
        .navigationTitle("Register").navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("screen-register-patient")
        .sheet(isPresented: Binding(get: { candidates != nil }, set: { if !$0 { candidates = nil } })) {
            DuplicateSheet(candidates: candidates ?? [], onRegisterAnyway: { matched in
                candidates = nil
                Task { await create(duplicateCheck: "overridden", matchedUhid: matched) }
            })
            .environment(session)
        }
    }

    @ViewBuilder
    private func form(session: Bindable<ReceptionSession>) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            CarbonSectionTitle("Person")
            CarbonField("First name", error: err("first_name"), isFocused: focus == "first_name") {
                TextField("First name", text: $firstName).textContentType(.givenName).focused($focus, equals: "first_name").accessibilityIdentifier("field-first_name")
            }
            CarbonField("Last name", error: err("last_name"), isFocused: focus == "last_name") {
                TextField("Last name", text: $lastName).textContentType(.familyName).focused($focus, equals: "last_name").accessibilityIdentifier("field-last_name")
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Gender").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                Picker("Gender", selection: $gender) {
                    Text("Female").tag("female"); Text("Male").tag("male"); Text("Other").tag("other"); Text("Unknown").tag("unknown")
                }
                .pickerStyle(.segmented).accessibilityIdentifier("field-gender")
            }
            CarbonField("Phone", error: err("phone"), isFocused: focus == "phone") {
                TextField("Phone", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber).focused($focus, equals: "phone").accessibilityIdentifier("field-phone")
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("Date of birth").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                DatePicker("Date of birth", selection: Binding(get: { dateOfBirth ?? Date() }, set: { dateOfBirth = $0 }), in: ...Date(), displayedComponents: .date)
                    .labelsHidden().accessibilityIdentifier("field-date_of_birth")
                if let e = err("date_of_birth") { Text(e).font(CarbonType.helper).foregroundStyle(MedBrainsTheme.danger) }
            }
            CarbonField("Or age in years, if they do not know the date", error: err("age_years"), isFocused: focus == "age") {
                TextField("Age", text: $age).keyboardType(.numberPad).focused($focus, equals: "age").accessibilityIdentifier("field-age")
            }
            CarbonField("ABHA number (optional)", error: err("abha_number"), isFocused: focus == "abha") {
                TextField("14 digits", text: $abha).keyboardType(.numberPad).focused($focus, equals: "abha").accessibilityIdentifier("field-abha_number")
            }

            CarbonSectionTitle("Safety")
            Toggle("Medico-legal case", isOn: $isMedicoLegal).font(CarbonType.body).accessibilityIdentifier("switch-mlc")
            if isMedicoLegal {
                CarbonField("MLC number", error: err("mlc_number"), isFocused: focus == "mlc") {
                    TextField("MLC number", text: $mlcNumber).focused($focus, equals: "mlc").accessibilityIdentifier("field-mlc_number")
                }
            }
            Toggle("VIP", isOn: $isVip).font(CarbonType.body).accessibilityIdentifier("switch-vip")

            CarbonSectionTitle("Desk — kept for the next walk-in")
            CarbonPicker("Department", options: session.wrappedValue.departments.map { .init(id: $0.id, label: $0.name) }, selection: session.departmentId, placeholder: "No department yet")
                .accessibilityIdentifier("picker-department")
            CarbonPicker("Consultant", options: session.wrappedValue.doctors.map { .init(id: $0.id, label: $0.fullName) }, selection: session.consultantId, placeholder: "Any consultant")
                .accessibilityIdentifier("picker-consultant")
            VStack(alignment: .leading, spacing: 8) {
                Text("Coming from").font(CarbonType.label).foregroundStyle(MedBrainsTheme.inkSecondary)
                Picker("Coming from", selection: session.source) { Text("Walk-in").tag("walk_in"); Text("Referral").tag("referral") }
                    .pickerStyle(.segmented).accessibilityIdentifier("field-source")
            }
            if session.wrappedValue.source == "referral" {
                CarbonField("Referred by", isFocused: focus == "referred") {
                    TextField("Doctor or facility", text: session.referredByName).focused($focus, equals: "referred").accessibilityIdentifier("field-referred_by_name")
                }
            }

            if checkUnavailable {
                CarbonNotification(kind: .warning, title: "Duplicate check unavailable", message: "Nobody was compared. Registering now may give this person a second UHID; the record will say the check did not run.")
            }
            if let failure { CarbonNotification(kind: .error, title: "Not registered", message: failure) }
            Button {
                Task { await checkAndRegister() }
            } label: {
                HStack { Text(checkUnavailable ? "Register unverified" : "Check and register"); Spacer(); Image(systemName: "arrow.right") }
            }
            .buttonStyle(.carbonPrimary).disabled(busy)
            .accessibilityIdentifier("register-submit")
        }
        .padding(16)
    }

    private func err(_ field: String) -> String? { problem?.field == field ? problem?.message : nil }

    private var draft: RegistrationDraft {
        RegistrationDraft(
            firstName: firstName, lastName: lastName, phone: phone,
            dateOfBirth: dateOfBirth.map(Self.iso) ?? "", ageYears: UInt32(age.trimmingCharacters(in: .whitespaces)),
            isMedicoLegal: isMedicoLegal, mlcNumber: mlcNumber, abhaNumber: abha
        )
    }

    private static func iso(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }

    /// The core rule stops the tap; then the match; then, depending on what
    /// it said, the sheet, the warning, or the create.
    private func checkAndRegister() async {
        problem = registrationProblem(draft: draft)
        guard problem == nil, let client else { return }
        failure = nil
        if checkUnavailable { await create(duplicateCheck: "unverified", matchedUhid: nil); return }
        busy = true
        defer { busy = false }
        let api = ReceptionApi(client: client)
        let found = try? await api.matchPatients(MatchQuery(firstName: firstName.trimmingCharacters(in: .whitespaces), lastName: lastName.trimmingCharacters(in: .whitespaces), dateOfBirth: dateOfBirth.map(Self.iso), phone: phone.trimmingCharacters(in: .whitespaces)))
        switch registrationAction(checkUnavailable: found == nil, matches: UInt32(found?.count ?? 0)) {
        case "confirm": candidates = found
        case "proceed_unverified": checkUnavailable = true
        default: await create(duplicateCheck: "none", matchedUhid: nil)
        }
    }

    private func create(duplicateCheck: String, matchedUhid: String?) async {
        guard let client else { return }
        busy = true
        defer { busy = false }
        let years = UInt32(age.trimmingCharacters(in: .whitespaces))
        let estimated = dateOfBirth == nil
        let dob = dateOfBirth.map(Self.iso) ?? estimatedDateOfBirth(ageYears: years ?? 0, todayYear: Int32(calendar.component(.year, from: Date())))
        let body = CreatePatientBody(
            firstName: firstName.trimmingCharacters(in: .whitespaces), lastName: lastName.trimmingCharacters(in: .whitespaces), gender: gender,
            phone: phone.trimmingCharacters(in: .whitespaces), dateOfBirth: dob, isDobEstimated: estimated,
            registrationType: "new", registrationSource: session.source,
            referredByName: session.source == "referral" && !session.referredByName.isEmpty ? session.referredByName : nil,
            departmentId: session.departmentId, consultantId: session.consultantId,
            abhaNumber: abha.isEmpty ? nil : abha.filter(\.isNumber),
            isMedicoLegal: isMedicoLegal, mlcNumber: isMedicoLegal ? mlcNumber : nil, isVip: isVip,
            attributes: .init(mobileRegistration: .init(source: session.source, duplicateCheck: duplicateCheck, matchedUhid: matchedUhid))
        )
        do {
            registered = try await ReceptionApi(client: client).createPatient(body)
            UIAccessibility.post(notification: .announcement, argument: "Registered. UHID \(registered?.uhid ?? "")")
        } catch let e as ApiError {
            failure = e.message
        } catch {
            failure = "Could not reach the hospital server. Nothing was registered."
        }
    }

    /// The person is cleared; the desk stays. Which is which is the core's call.
    private func nextWalkIn() {
        registered = nil
        checkUnavailable = false
        problem = nil
        for field in ["first_name", "last_name", "phone", "date_of_birth", "age_years", "abha_number", "is_medico_legal", "mlc_number", "is_vip"] where !registrationCarriesOver(field: field) {
            switch field {
            case "first_name": firstName = ""
            case "last_name": lastName = ""
            case "phone": phone = ""
            case "date_of_birth": dateOfBirth = nil
            case "age_years": age = ""
            case "abha_number": abha = ""
            case "is_medico_legal": isMedicoLegal = false
            case "mlc_number": mlcNumber = ""
            case "is_vip": isVip = false
            default: break
            }
        }
        gender = "female"
        focus = "first_name"
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
