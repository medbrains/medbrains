package com.medbrains.patient

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * The hospital's side of the patient portal, from a test: the desk raises a
 * bill, the administrator licenses a module, and the record is read back so
 * the screen is judged against what the server holds. Mirrors PortalSeed.swift.
 * The sign-in code itself is seeded by `scripts/seed_portal_otp.sh` before the run.
 */
class PortalSeed private constructor(private var token: String?) {
    /** Step-up is a cookie; the seed carries it by hand, as a browser would. */
    private var stepUpCookie: String? = null

    data class Invoice(val id: String, val number: String, val total: Double, val balance: Double)

    fun call(method: String, path: String, body: Any? = null): Pair<Int, String> {
        val c = URL(BACKEND + path).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.setRequestProperty("Content-Type", "application/json")
        c.setRequestProperty("X-MedBrains-Client", "mobile-staff")
        token?.let { c.setRequestProperty("Authorization", "Bearer $it") }
        stepUpCookie?.let { c.setRequestProperty("Cookie", it) }
        if (body != null) { c.doOutput = true; c.outputStream.use { it.write(body.toString().toByteArray()) } }
        val text = (if (c.responseCode < 400) c.inputStream else c.errorStream)?.bufferedReader()?.readText().orEmpty()
        c.headerFields["Set-Cookie"]?.firstOrNull { it.startsWith("step_up=") }?.let { stepUpCookie = it.substringBefore(';') }
        return c.responseCode to text
    }

    private fun obj(method: String, path: String, body: Any? = null): JSONObject = runCatching { JSONObject(call(method, path, body).second) }.getOrDefault(JSONObject())

    /** The patient whose phone the seeded code belongs to. */
    fun patientId(phone: String): String? {
        val rows = obj("GET", "/api/patients?search=$phone&per_page=5").optJSONArray("patients") ?: JSONArray()
        return (0 until rows.length()).map { rows.getJSONObject(it) }.firstOrNull { it.optString("phone") == phone }?.optString("id")
    }

    /** A patient registered this run with their own phone, so a code request for "a registered number" never spends the seeded code. */
    fun registeredPhone(): String? {
        val phone = "97" + RUN.padEnd(8, '0')
        val created = obj("POST", "/api/patients", JSONObject().put("first_name", "Portal").put("last_name", "Seeded$RUN").put("gender", "female").put("phone", phone).put("date_of_birth", "1988-05-05").put("is_dob_estimated", false).put("registration_type", "new").put("registration_source", "walk_in").put("is_medico_legal", false).put("is_vip", false))
        return if (created.has("id")) phone else null
    }

    /** A consultation charge raised at the desk, unpaid: the bill the patient will see. */
    /** The purposes the patient currently agrees to (newest decision on the ledger), and who made it. */
    fun dpdpConsent(patientId: String): Pair<List<String>, String?> {
        val first = obj("GET", "/api/patients/$patientId/dpdp-consent").optJSONArray("history")?.optJSONObject(0)
        val purposes = first?.optJSONArray("purposes")?.let { a -> (0 until a.length()).map { a.getString(it) } }.orEmpty()
        return purposes to first?.optString("source")
    }

    /** The patient's requests on the privacy officer's register, newest first. */
    fun privacyRequests(patientId: String): JSONArray =
        runCatching { JSONArray(call("GET", "/api/privacy-requests?patient_id=$patientId").second) }.getOrDefault(JSONArray())

    fun invoice(patientId: String, amount: Double): Invoice? {
        val id = obj("POST", "/api/billing/invoices", JSONObject().put("patient_id", patientId).put("notes", "native e2e $RUN")).optString("id").ifEmpty { return null }
        call("POST", "/api/billing/invoices/$id/items", JSONObject().put("charge_code", "CONSULT").put("description", "Consultation (e2e $RUN)").put("source", "opd").put("quantity", 1).put("unit_price", "%.2f".format(amount)).put("tax_percent", "0"))
        val inv = obj("GET", "/api/billing/invoices/$id").optJSONObject("invoice") ?: return null
        // The detail carries paid and total; the portal derives what is owed the same way.
        val total = inv.optString("total_amount").toDoubleOrNull() ?: 0.0
        return Invoice(id, inv.optString("invoice_number"), total, total - (inv.optString("paid_amount").toDoubleOrNull() ?: 0.0))
    }

    /** What the patient still owes across every invoice, summed on the server's numbers. */
    fun outstanding(patientId: String): Double {
        val rows = runCatching { JSONArray(call("GET", "/api/patients/$patientId/invoices").second) }.getOrDefault(JSONArray())
        return (0 until rows.length()).sumOf { rows.getJSONObject(it).optString("balance").toDoubleOrNull() ?: 0.0 }
    }

    /**
     * A prescription written at a visit and dispensed at the counter, of a drug
     * the doctor approves refills of — what a refill is asked for.
     */
    fun dispensedPrescription(patientId: String): Pair<String, String> {
        check(call("POST", "/api/auth/step-up", JSONObject().put("password", "admin123")).first == 200) { "step-up for prescribing" }
        val departments = JSONArray(call("GET", "/api/setup/departments").second)
        val dept = (0 until departments.length()).map { departments.getJSONObject(it) }.first { it.optString("code") == "GEN-MEDICINE" }.getString("id")
        val (visitStatus, visitText) = call("POST", "/api/opd/encounters", JSONObject().put("patient_id", patientId).put("department_id", dept))
        val encounter = runCatching { JSONObject(visitText).getJSONObject("encounter").getString("id") }.getOrElse { error("visit $visitStatus $visitText") }
        val catalog = JSONArray(call("GET", "/api/pharmacy/catalog").second)
        val drug = (0 until catalog.length()).map { catalog.getJSONObject(it) }.first {
            it.optBoolean("is_active") && !it.optBoolean("is_controlled") && it.optString("drug_schedule") !in setOf("X", "H1", "NDPS") &&
                // Reserve antibiotics and non-formulary drugs need approvals the seed does not give.
                it.optString("aware_category") != "reserve" && it.optString("formulary_status") != "non_formulary" &&
                it.optString("refill_policy") == "doctor_approval" && (it.optString("current_stock").toDoubleOrNull() ?: it.optDouble("current_stock", 0.0)) >= 10
        }
        val line = JSONObject().put("drug_name", drug.getString("name")).put("catalog_item_id", drug.getString("id")).put("dosage", "1 tab").put("frequency", "OD").put("duration", "5 days").put("route", "oral")
        val (rxStatus, rxText) = call("POST", "/api/opd/encounters/$encounter/prescriptions", JSONObject().put("items", JSONArray().put(line)))
        val written = runCatching { JSONObject(rxText) }.getOrElse { error("prescription $rxStatus $rxText") }
        val rx = written.getJSONObject("prescription").getString("id")
        check(call("PUT", "/api/pharmacy/rx-queue/${written.getString("pharmacy_rx_queue_id")}/review", JSONObject().put("action", "approved")).first == 200) { "pharmacist approves" }
        val orders = obj("GET", "/api/pharmacy/orders?patient_id=$patientId").getJSONArray("orders")
        val order = (0 until orders.length()).map { orders.getJSONObject(it) }.first { it.optString("prescription_id") == rx }.getString("id")
        check(call("PUT", "/api/pharmacy/orders/$order/dispense", JSONObject().put("unpaid_override_reason", "native e2e $RUN — paid at the counter")).first == 200) { "dispensed at the counter" }
        return rx to drug.getString("name")
    }

    /** Refill requests for `drug` waiting in the prescriber's sign-offs. */
    fun refillRequestsAwaiting(drug: String): Int {
        val rows = JSONArray(call("GET", "/api/doctors/me/pending-signoffs").second)
        return (0 until rows.length()).map { rows.getJSONObject(it) }.count { it.optString("record_type") == "refill_request" && it.optString("summary").contains(drug) }
    }

    /** The hospital licenses (or drops) a module for every patient at once. */
    fun setModule(code: String, enabled: Boolean) {
        val (status, text) = call("PUT", "/api/setup/modules/$code", JSONObject().put("status", if (enabled) "enabled" else "disabled"))
        check(status in 200..299) { "module $code → $enabled: $status $text" }
    }

    companion object {
        const val BACKEND = "http://10.0.2.2:3000"
        val RUN: String = (System.currentTimeMillis() / 1000 % 1_000_000).toString()

        fun admin(): PortalSeed {
            val seed = PortalSeed(null)
            val (status, text) = seed.call("POST", "/api/auth/login", JSONObject().put("username", "admin").put("password", "admin123"))
            check(status == 200) { "admin signs in through the real API: $status" }
            seed.token = JSONObject(text).getString("token")
            return seed
        }
    }
}
