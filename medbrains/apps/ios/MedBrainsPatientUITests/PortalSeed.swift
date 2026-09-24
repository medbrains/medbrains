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

    struct Invoice { let id: String; let number: String; let total: Double; let balance: Double }

    @discardableResult
    func call(_ method: String, _ path: String, _ body: Any? = nil) -> (Int, Any?) {
        var req = URLRequest(url: URL(string: path, relativeTo: Self.backend)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("mobile-staff", forHTTPHeaderField: "X-MedBrains-Client")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
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
