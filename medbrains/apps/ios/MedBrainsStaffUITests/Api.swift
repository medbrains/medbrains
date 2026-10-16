import Foundation
import XCTest

/// The backend, from a test: identities provisioned per run through the real
/// API (never a static credential), data seeded the way the desk would seed
/// it, and every outcome read back — the assertion is what the record says,
/// not what the screen looked like. Mirrors apps/web/e2e/helpers.
final class Api {
    static let backend = URL(string: ProcessInfo.processInfo.environment["MEDBRAINS_BASE_URL"] ?? "http://127.0.0.1:3000")!
    /// A phone number the OPD queue cannot mistake for another run's.
    static let runId = String(Int(Date().timeIntervalSince1970) % 1_000_000)
    /// Every provisioned identity gets its own suffix: one run signs in as several nurses.
    private static var serial = 0

    private(set) var token: String?
    private let client = "mobile-staff"

    struct Identity { let id: String; let role: String; let username: String; let password: String }
    struct Admission { let id: String; let encounterId: String; let patientId: String; let uhid: String; let patientName: String }

    @discardableResult
    func call(_ method: String, _ path: String, _ body: Any? = nil, token override: String?? = nil) -> (Int, Any?) {
        var req = URLRequest(url: URL(string: path, relativeTo: Self.backend)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(client, forHTTPHeaderField: "X-MedBrains-Client")
        let auth: String? = override ?? token
        if let auth { req.setValue("Bearer \(auth)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try? JSONSerialization.data(withJSONObject: body) }
        let done = DispatchSemaphore(value: 0)
        var status = 0
        var json: Any?
        URLSession.shared.dataTask(with: req) { data, resp, _ in
            status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) }
            done.signal()
        }.resume()
        done.wait()
        return (status, json)
    }

    func obj(_ method: String, _ path: String, _ body: Any? = nil) -> [String: Any] { (call(method, path, body).1 as? [String: Any]) ?? [:] }
    func list(_ path: String) -> [[String: Any]] {
        let (_, json) = call("GET", path)
        if let rows = json as? [[String: Any]] { return rows }
        if let page = json as? [String: Any] { for key in ["admissions", "calls", "rows", "data", "items", "patients"] { if let rows = page[key] as? [[String: Any]] { return rows } } }
        return []
    }

    static func admin() -> Api {
        let api = Api()
        let (_, body) = api.call("POST", "/api/auth/login", ["username": "admin", "password": "admin123"])
        api.token = (body as? [String: Any])?["token"] as? String
        XCTAssertNotNil(api.token, "admin signs in through the real API")
        return api
    }

    static func signIn(_ username: String, _ password: String) -> Api {
        let api = Api()
        let (_, body) = api.call("POST", "/api/auth/login", ["username": username, "password": password])
        api.token = (body as? [String: Any])?["token"] as? String
        return api
    }

    // MARK: identities

    private static let clinicalRoles: Set<String> = ["doctor", "nurse"]

    /// `e2e_<role>_<run>` with the department real staff have, as the web suite does.
    func provision(_ role: String) -> Identity {
        Self.serial += 1
        let username = "e2e_\(role.replacingOccurrences(of: "_", with: ""))_\(Self.runId)\(Self.serial)"
        let password = "E2eTemp#\(Self.runId)Aa9"
        var payload: [String: Any] = ["username": username, "email": "\(username)@e2e.medbrains.localhost", "password": password, "full_name": "E2E \(role) \(Self.runId)", "role": role]
        if Self.clinicalRoles.contains(role), let dept = firstDepartmentId() { payload["department_ids"] = [dept] }
        if role == "doctor" { payload["specialization"] = "General Medicine"; payload["medical_registration_number"] = "E2E-\(Self.runId)"; payload["qualification"] = "MBBS" }
        let (status, body) = call("POST", "/api/setup/users", payload)
        let id = (body as? [String: Any])?["id"] as? String ?? ""
        XCTAssertTrue((200..<300).contains(status), "provisioning \(role) failed: \(status)")
        return Identity(id: id, role: role, username: username, password: password)
    }

    /// Deactivated, not deleted: an account that outlives its test is an account somebody logs into.
    func retire(_ who: Identity?) {
        guard let who else { return }
        call("DELETE", "/api/setup/users/\(who.id)")
    }

    /// An arrest another run left open covers every screen with the flash; a
    /// nurse suite starts from a quiet floor and says so in the record.
    func endOpenCodeBlues() {
        for row in list("/api/nurse/code-blue?active_only=true") {
            if let id = row["id"] as? String { endCodeBlue(id) }
        }
    }

    func firstDepartmentId() -> String? {
        let rows = list("/api/setup/departments")
        return (rows.first { ($0["code"] as? String) == "GEN-MEDICINE" } ?? rows.first)?["id"] as? String
    }

    // MARK: seeds

    func patient(_ last: String, phone: String? = nil) -> [String: Any] {
        obj("POST", "/api/patients", ["first_name": "Seeded", "last_name": "\(last)\(Self.runId)", "gender": "female", "phone": phone ?? "98\(String(Self.runId).padding(toLength: 8, withPad: "0", startingAt: 0))", "date_of_birth": "1988-05-05", "is_dob_estimated": false, "registration_type": "new", "registration_source": "walk_in", "is_medico_legal": false, "is_vip": false])
    }

    /// An admitted patient in the clinical department, so a scoped nurse or doctor sees them.
    func admission(_ last: String) -> Admission? {
        let p = patient(last)
        guard let patientId = p["id"] as? String, let dept = firstDepartmentId() else { return nil }
        let doctors = list("/api/setup/doctors")
        let body: [String: Any] = ["patient_id": patientId, "admitting_doctor_id": doctors.first?["id"] as Any, "department_id": dept, "admission_type": "elective"]
        let created = obj("POST", "/api/ipd/admissions", body)
        guard let adm = created["admission"] as? [String: Any], let id = adm["id"] as? String, let enc = adm["encounter_id"] as? String else { return nil }
        return Admission(id: id, encounterId: enc, patientId: patientId, uhid: p["uhid"] as? String ?? "", patientName: "Seeded \(last)\(Self.runId)")
    }

    func marDose(_ admissionId: String, drug: String, highAlert: Bool, minutesFromNow: Int) -> String? {
        let when = ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double(minutesFromNow) * 60))
        return obj("POST", "/api/ipd/admissions/\(admissionId)/mar", ["drug_name": drug, "dose": "1 tab", "route": "oral", "frequency": "once", "scheduled_at": when, "is_high_alert": highAlert])["id"] as? String
    }

    func nurseCall(_ a: Admission, type: String = "pain_management", notes: String) -> String? {
        obj("POST", "/api/bedside/\(a.id)/nurse-request", ["patient_id": a.patientId, "request_type": type, "priority": "high", "notes": notes])["id"] as? String
    }

    func codeBlue(_ a: Admission, location: String) -> String? {
        obj("POST", "/api/nurse/code-blue", ["patient_id": a.patientId, "encounter_id": a.encounterId, "location": location])["id"] as? String
    }
    func endCodeBlue(_ id: String) { call("PUT", "/api/nurse/code-blue/\(id)/end", ["outcome": "rosc", "notes": "e2e"]) }

    /// The group every seeded transfusion uses: O-positive donor and patient, compatible by rule.
    static let seedBloodGroup = "o_positive"

    /// The five statutory TTI markers, all non-reactive: nothing is released otherwise.
    static let ttiMarkers = ["hiv", "hbsag", "hcv", "syphilis", "malaria"]

    /// A unit on the blood bank's record, screened and released for issue —
    /// the server refuses to hang a bag it has no record of.
    func bloodUnit(bag: String) -> String? {
        guard let donor = obj("POST", "/api/blood-bank/donors", ["donor_number": "E2E-D-\(bag)", "first_name": "E2E", "last_name": "Donor", "blood_group": Self.seedBloodGroup, "gender": "male", "date_of_birth": "1990-01-01"])["id"] as? String,
              let donation = obj("POST", "/api/blood-bank/donors/\(donor)/donations", ["bag_number": "E2E-DON-\(bag)", "volume_ml": 450, "weight_kg": 60, "hemoglobin_g_dl": 13.5, "systolic_bp": 120, "diastolic_bp": 80, "pulse": 72])["id"] as? String
        else { return nil }
        call("POST", "/api/blood-bank/donations/\(donation)/tti", ["results": Self.ttiMarkers.map { ["marker": $0, "result": "non_reactive"] }])
        guard let unit = obj("POST", "/api/blood-bank/components", ["donation_id": donation, "component_type": "prbc", "bag_number": bag, "blood_group": Self.seedBloodGroup, "volume_ml": 350, "expiry_at": ISO8601DateFormatter().string(from: Date().addingTimeInterval(30 * 86_400))])["id"] as? String
        else { return nil }
        call("PUT", "/api/blood-bank/components/\(unit)/status", ["status": "available"])
        return unit
    }

    /// Group and hold: no transfusion without the patient's group on record.
    func recordBloodGroup(patientId: String) { call("PUT", "/api/patients/\(patientId)", ["blood_group": Self.seedBloodGroup]) }

    /// The bank's side: a compatible crossmatch for this patient and unit, then
    /// the issue — a bag is hung only once the bank has issued it to the patient.
    func issueUnit(_ unit: String, to patientId: String, secondNurseId: String) -> Bool {
        guard let me = obj("GET", "/api/auth/me")["id"] as? String,
              let xm = obj("POST", "/api/blood-bank/crossmatch", ["patient_id": patientId, "blood_group": Self.seedBloodGroup])["id"] as? String
        else { return false }
        call("PUT", "/api/blood-bank/crossmatch/\(xm)", ["status": "compatible", "result": "compatible", "component_id": unit])
        return call("POST", "/api/blood-bank/transfusions", ["patient_id": patientId, "component_id": unit, "patient_verified_by": me, "product_verified_by": secondNurseId]).0 == 200
    }

    func transfusion(_ a: Admission, secondNurseId: String) -> String? {
        let bag = "BAG-\(Self.runId)"
        guard let unit = bloodUnit(bag: bag) else { return nil }
        recordBloodGroup(patientId: a.patientId)
        guard issueUnit(unit, to: a.patientId, secondNurseId: secondNurseId) else { return nil }
        return obj("POST", "/api/ipd/admissions/\(a.id)/transfusions", ["product_type": "PRBC", "bag_number": bag, "blood_group": "O", "rh_factor": "positive", "volume_ml": 350, "expiry_date": "2027-01-01", "crossmatch_compatible": true, "consent_on_file": true, "product_verified_by_id": secondNurseId, "wristband_uhid": a.uhid])["id"] as? String
    }

    /// A waiting OPD token registered against `doctorId` as attending.
    func waitingVisit(doctorId: String, last: String) -> (patientId: String, encounterId: String)? {
        let p = patient(last)
        guard let patientId = p["id"] as? String, let dept = firstDepartmentId() else { return nil }
        let v = obj("POST", "/api/opd/encounters", ["patient_id": patientId, "department_id": dept, "doctor_id": doctorId])
        guard let enc = (v["encounter"] as? [String: Any])?["id"] as? String else { return nil }
        return (patientId, enc)
    }

    // MARK: front office

    func visitor(_ name: String) -> [String: Any] {
        obj("POST", "/api/front-office/visitors", ["visitor_name": "\(name)\(Self.runId)", "phone": "95\(Self.runId)", "relationship": "family", "purpose": "visiting", "category": "general"])
    }

    /// `hours` may be negative: that is how a pass whose hours already lapsed
    /// is made without waiting for the clock.
    func pass(_ registrationId: String, hours: Int = 4, bed: String? = nil) -> [String: Any] {
        var body: [String: Any] = ["registration_id": registrationId, "valid_hours": hours]
        if let bed { body["bed_number"] = bed }
        return obj("POST", "/api/front-office/passes", body)
    }

    func revokePass(_ id: String, reason: String) { call("PUT", "/api/front-office/passes/\(id)/revoke", ["reason": reason]) }
    func passes() -> [[String: Any]] { list("/api/front-office/passes") }
    func visitorLogs() -> [[String: Any]] { list("/api/front-office/visitor-logs") }
    func enquiry(_ said: String) -> [String: Any] {
        obj("POST", "/api/front-office/enquiries", ["caller_name": "Caller \(Self.runId)", "caller_phone": "94\(Self.runId)", "enquiry_type": "general", "response_text": said])
    }
    func enquiries() -> [[String: Any]] { list("/api/front-office/enquiries") }

    // MARK: read-backs

    func nurseRequests(_ admissionId: String) -> [[String: Any]] { list("/api/bedside/\(admissionId)/nurse-requests") }
    func mar(_ admissionId: String) -> [[String: Any]] { list("/api/ipd/admissions/\(admissionId)/mar") }
    func worklistToken(patientId: String) -> [String: Any]? { list("/api/tokens/worklist?module=opd&scope=department&scope_id=\(firstDepartmentId() ?? "")").first { ($0["patient_id"] as? String) == patientId } }
    /// A camp today started from "General camp": its four stations' counter ids, in route order.
    func campRoute(_ name: String) -> (campId: String, stations: [String]) {
        let today = ISO8601DateFormatter.string(from: Date(), timeZone: .current, formatOptions: [.withFullDate])
        let camp = obj("POST", "/api/camp/camps", ["name": "\(name) \(Self.runId)", "camp_type": "general_health", "scheduled_date": today, "organizing_department_id": firstDepartmentId().map { $0 as Any } ?? NSNull()])
        let campId = camp["id"] as? String ?? ""
        let (_, route) = call("POST", "/api/camp/camps/\(campId)/route-template", ["template": "general"])
        return (campId, ((route as? [[String: Any]]) ?? []).compactMap { $0["counter_id"] as? String })
    }
    func campQueue(_ station: String) -> [[String: Any]] { list("/api/tokens/worklist?module=camp&scope=counter&scope_id=\(station)") }
    /// The visit's case-sheet notes, in the order care happened.
    func notes(_ encounterId: String) -> [[String: Any]] { list("/api/encounters/\(encounterId)/clinical-notes") }
    /// One section's text on a note read from `notes`.
    func section(_ note: [String: Any]?, _ code: String) -> String? {
        ((note?["sections"] as? [[String: Any]])?.first { $0["code"] as? String == code })?["text"] as? String
    }
    func responders() -> [[String: Any]] { list("/api/nurse/code-blue/responders") }
}
