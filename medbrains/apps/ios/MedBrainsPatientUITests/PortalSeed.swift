import Foundation
import XCTest

/// The hospital's side of the patient portal, from a test: the desk raises a
/// bill, the administrator licenses a module, and the record is read back so
/// the screen is judged against what the server holds. The sign-in code
/// itself cannot come from here — the server hashes it and hands the clear
/// text only to the SMS outbox — so `scripts/seed_portal_otp.sh` writes one
/// before the run.
final class PortalSeed {
    static let backend = URL(string: ProcessInfo.processInfo.environment["MEDBRAINS_BASE_URL"] ?? "http://127.0.0.1:3000")!
    static let runId = String(Int(Date().timeIntervalSince1970) % 1_000_000)
    private var token: String?
    /// Step-up is a cookie; URLSession won't send it back over plain http, so
    /// the seed carries it by hand, as a browser would.
    private var stepUpCookie: String?

    struct Invoice { let id: String; let number: String; let total: Double; let balance: Double }

    @discardableResult
    func call(_ method: String, _ path: String, _ body: Any? = nil) -> (Int, Any?) {
        var req = URLRequest(url: URL(string: path, relativeTo: Self.backend)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("mobile-staff", forHTTPHeaderField: "X-MedBrains-Client")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let stepUpCookie { req.setValue(stepUpCookie, forHTTPHeaderField: "Cookie") }
        if let body { req.httpBody = try? JSONSerialization.data(withJSONObject: body) }
        let done = DispatchSemaphore(value: 0)
        var status = 0
        var json: Any?
        URLSession.shared.dataTask(with: req) { data, resp, _ in
            status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if let set = (resp as? HTTPURLResponse)?.value(forHTTPHeaderField: "Set-Cookie"),
               let pair = set.split(separator: ";").first, pair.hasPrefix("step_up=") {
                self.stepUpCookie = String(pair)
            }
            json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) }
            done.signal()
        }.resume()
        done.wait()
        return (status, json)
    }

    func obj(_ method: String, _ path: String, _ body: Any? = nil) -> [String: Any] { (call(method, path, body).1 as? [String: Any]) ?? [:] }

    static func admin() -> PortalSeed {
        let seed = PortalSeed()
        let (_, body) = seed.call("POST", "/api/auth/login", ["username": "admin", "password": "admin123"])
        seed.token = (body as? [String: Any])?["token"] as? String
        XCTAssertNotNil(seed.token, "admin signs in through the real API")
        return seed
    }

    /// The patient whose phone the seeded code belongs to.
    func patientId(phone: String) -> String? {
        let (_, json) = call("GET", "/api/patients?search=\(phone)&per_page=5")
        let rows = ((json as? [String: Any])?["patients"] as? [[String: Any]]) ?? ((json as? [String: Any])?["data"] as? [[String: Any]]) ?? []
        return rows.first { ($0["phone"] as? String) == phone }?["id"] as? String
    }

    /// A patient registered this run with their own phone, so a code request
    /// for "a registered number" never spends the seeded code.
    func registeredPhone() -> String? {
        let phone = "97" + String(Self.runId).padding(toLength: 8, withPad: "0", startingAt: 0)
        let created = obj("POST", "/api/patients", ["first_name": "Portal", "last_name": "Seeded\(Self.runId)", "gender": "female", "phone": phone, "date_of_birth": "1988-05-05", "is_dob_estimated": false, "registration_type": "new", "registration_source": "walk_in", "is_medico_legal": false, "is_vip": false])
        return created["id"] == nil ? nil : phone
    }

    /// The purposes the patient currently agrees to (newest decision on the ledger), and who made it.
    func dpdpConsent(patientId: String) -> (purposes: [String], source: String?) {
        let history = (obj("GET", "/api/patients/\(patientId)/dpdp-consent")["history"] as? [[String: Any]]) ?? []
        return ((history.first?["purposes"] as? [String]) ?? [], history.first?["source"] as? String)
    }

    /// The patient's requests on the privacy officer's register, newest first.
    func privacyRequests(patientId: String) -> [[String: Any]] {
        (call("GET", "/api/privacy-requests?patient_id=\(patientId)").1 as? [[String: Any]]) ?? []
    }

    /// A consultation charge raised at the desk, unpaid: the bill the patient will see.
    func invoice(patientId: String, amount: Double) -> Invoice? {
        let (_, created) = call("POST", "/api/billing/invoices", ["patient_id": patientId, "notes": "native e2e \(Self.runId)"])
        guard let id = (created as? [String: Any])?["id"] as? String else { return nil }
        call("POST", "/api/billing/invoices/\(id)/items", [
            "charge_code": "CONSULT", "description": "Consultation (e2e \(Self.runId))", "source": "opd",
            "quantity": 1, "unit_price": String(format: "%.2f", amount), "tax_percent": "0",
        ])
        let (_, detail) = call("GET", "/api/billing/invoices/\(id)")
        guard let inv = (detail as? [String: Any])?["invoice"] as? [String: Any] else { return nil }
        return Invoice(
            id: id, number: (inv["invoice_number"] as? String) ?? "",
            // The detail carries paid and total; the portal derives what is owed the same way.
            total: Self.number(inv["total_amount"]), balance: Self.number(inv["total_amount"]) - Self.number(inv["paid_amount"])
        )
    }

    /// What the patient still owes across every invoice, summed on the server's numbers.
    func outstanding(patientId: String) -> Double {
        let (_, json) = call("GET", "/api/patients/\(patientId)/invoices")
        let rows = (json as? [[String: Any]]) ?? ((json as? [String: Any])?["data"] as? [[String: Any]]) ?? []
        return rows.reduce(0.0) { $0 + Self.number($1["balance"]) }
    }

    /// A prescription written at a visit and dispensed at the counter,
    /// of a drug the doctor approves refills of — what a refill is asked for.
    func dispensedPrescription(patientId: String) -> (id: String, drug: String)? {
        let (stepUp, _) = call("POST", "/api/auth/step-up", ["password": "admin123"])
        XCTAssertEqual(stepUp, 200, "step-up for prescribing")
        let departments = (call("GET", "/api/setup/departments").1 as? [[String: Any]]) ?? []
        guard let dept = departments.first(where: { ($0["code"] as? String) == "GEN-MEDICINE" })?["id"] else { XCTFail("GEN-MEDICINE"); return nil }
        let (visitStatus, visitBody) = call("POST", "/api/opd/encounters", ["patient_id": patientId, "department_id": dept])
        guard let encounter = (((visitBody as? [String: Any])?["encounter"]) as? [String: Any])?["id"] as? String else { XCTFail("visit \(visitStatus) \(String(describing: visitBody))"); return nil }
        let catalog = (call("GET", "/api/pharmacy/catalog").1 as? [[String: Any]]) ?? []
        guard let drug = catalog.first(where: {
            ($0["is_active"] as? Bool) == true && ($0["is_controlled"] as? Bool) == false
                && !["X", "H1", "NDPS"].contains(($0["drug_schedule"] as? String) ?? "")
                // Reserve antibiotics and non-formulary drugs need approvals the seed does not give.
                && ($0["aware_category"] as? String) != "reserve" && ($0["formulary_status"] as? String) != "non_formulary"
                && ($0["refill_policy"] as? String) == "doctor_approval" && Self.number($0["current_stock"]) >= 10
        }), let drugId = drug["id"] as? String, let name = drug["name"] as? String else { XCTFail("a stocked drug the doctor refills (\(catalog.count) in catalogue)"); return nil }
        let (rxStatus, rxBody) = call("POST", "/api/opd/encounters/\(encounter)/prescriptions", ["items": [[
            "drug_name": name, "catalog_item_id": drugId, "dosage": "1 tab", "frequency": "OD", "duration": "5 days", "route": "oral",
        ]]])
        let written = (rxBody as? [String: Any]) ?? [:]
        guard let rx = (written["prescription"] as? [String: Any])?["id"] as? String,
              let queued = written["pharmacy_rx_queue_id"] as? String else { XCTFail("prescription \(rxStatus) \(String(describing: rxBody))"); return nil }
        let (reviewStatus, _) = call("PUT", "/api/pharmacy/rx-queue/\(queued)/review", ["action": "approved"])
        XCTAssertEqual(reviewStatus, 200, "pharmacist approves")
        let orders = (obj("GET", "/api/pharmacy/orders?patient_id=\(patientId)")["orders"] as? [[String: Any]]) ?? []
        guard let order = orders.first(where: { ($0["prescription_id"] as? String) == rx })?["id"] as? String else { XCTFail("the approved order (\(orders.count) orders)"); return nil }
        let (dispensed, _) = call("PUT", "/api/pharmacy/orders/\(order)/dispense", ["unpaid_override_reason": "native e2e \(Self.runId) — paid at the counter"])
        XCTAssertEqual(dispensed, 200, "dispensed at the counter")
        return (rx, name)
    }

    /// Refill requests for `drug` waiting in the prescriber's sign-offs.
    func refillRequestsAwaiting(drug: String) -> Int {
        let rows = (call("GET", "/api/doctors/me/pending-signoffs").1 as? [[String: Any]]) ?? []
        return rows.filter { ($0["record_type"] as? String) == "refill_request" && (($0["summary"] as? String) ?? "").contains(drug) }.count
    }

    /// A pharmacy setting as the hospital holds it (nil when never set).
    func pharmacySetting(_ key: String) -> Any? {
        let rows = (call("GET", "/api/setup/settings?category=pharmacy").1 as? [[String: Any]]) ?? []
        return rows.first { ($0["key"] as? String) == key }?["value"]
    }

    /// The hospital changes a pharmacy setting, as its settings screen does.
    func setPharmacySetting(_ key: String, _ value: Any) {
        let (status, _) = call("PUT", "/api/setup/settings", ["category": "pharmacy", "key": key, "value": value])
        XCTAssertTrue((200..<300).contains(status), "pharmacy.\(key) → \(value)")
    }

    /// The hospital licenses (or drops) a module for every patient at once.
    func setModule(_ code: String, enabled: Bool) {
        let (status, _) = call("PUT", "/api/setup/modules/\(code)", ["status": enabled ? "enabled" : "disabled"])
        XCTAssertTrue((200..<300).contains(status), "module \(code) → \(enabled)")
    }

    private static func number(_ any: Any?) -> Double {
        if let d = any as? Double { return d }
        if let s = any as? String { return Double(s) ?? 0 }
        return 0
    }
}
