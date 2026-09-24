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
    data class Invoice(val id: String, val number: String, val total: Double, val balance: Double)

    fun call(method: String, path: String, body: Any? = null): Pair<Int, String> {
        val c = URL(BACKEND + path).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.setRequestProperty("Content-Type", "application/json")
        c.setRequestProperty("X-MedBrains-Client", "mobile-staff")
        token?.let { c.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) { c.doOutput = true; c.outputStream.use { it.write(body.toString().toByteArray()) } }
        val text = (if (c.responseCode < 400) c.inputStream else c.errorStream)?.bufferedReader()?.readText().orEmpty()
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
