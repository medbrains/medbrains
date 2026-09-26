package com.medbrains.staff

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * The backend, from a test: identities provisioned per run through the real
 * API, data seeded the way the desk would seed it, every outcome read back.
 * Mirrors apps/web/e2e/helpers and the iOS Api.swift.
 */
class Api private constructor(private var token: String?) {
    data class Identity(val id: String, val role: String, val username: String, val password: String)
    data class Admission(val id: String, val encounterId: String, val patientId: String, val uhid: String, val patientName: String)

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

    fun obj(method: String, path: String, body: Any? = null): JSONObject = runCatching { JSONObject(call(method, path, body).second) }.getOrDefault(JSONObject())
    fun list(path: String): List<JSONObject> {
        val text = call("GET", path).second
        val arr = runCatching { JSONArray(text) }.getOrNull() ?: runCatching {
            val o = JSONObject(text); listOf("admissions", "calls", "rows", "data", "items", "patients").firstNotNullOfOrNull { o.optJSONArray(it) }
        }.getOrNull() ?: return emptyList()
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }

    fun provision(role: String): Identity {
        val username = "e2e_${role.replace("_", "")}_$RUN${++serial}"
        val password = "E2eTemp#${RUN}Aa9"
        val payload = JSONObject().put("username", username).put("email", "$username@e2e.medbrains.localhost").put("password", password).put("full_name", "E2E $role $RUN").put("role", role)
        if (role in setOf("doctor", "nurse")) firstDepartmentId()?.let { payload.put("department_ids", JSONArray().put(it)) }
        if (role == "doctor") payload.put("specialization", "General Medicine").put("medical_registration_number", "E2E-$RUN").put("qualification", "MBBS")
        val (status, text) = call("POST", "/api/setup/users", payload)
        check(status in 200..299) { "provisioning $role failed: $status $text" }
        return Identity(JSONObject(text).getString("id"), role, username, password)
    }

    /** Deactivated, not deleted. */
    fun retire(who: Identity?) { who?.let { call("DELETE", "/api/setup/users/${it.id}") } }

    /** An arrest another run left open covers every screen with the flash. */
    fun endOpenCodeBlues() { list("/api/nurse/code-blue?active_only=true").forEach { endCodeBlue(it.getString("id")) } }

    fun visitor(name: String): JSONObject = obj("POST", "/api/front-office/visitors", JSONObject()
        .put("visitor_name", "$name$RUN").put("phone", "95$RUN").put("relationship", "family").put("purpose", "visiting").put("category", "general"))

    /** `hours` may be negative: that is how a pass whose hours already lapsed is made without waiting for the clock. */
    fun pass(registrationId: String, hours: Int = 4, bed: String? = null): JSONObject {
        val body = JSONObject().put("registration_id", registrationId).put("valid_hours", hours)
        bed?.let { body.put("bed_number", it) }
        return obj("POST", "/api/front-office/passes", body)
    }

    fun revokePass(id: String, reason: String) { call("PUT", "/api/front-office/passes/$id/revoke", JSONObject().put("reason", reason)) }
    fun passes(): List<JSONObject> = list("/api/front-office/passes")
    fun visitorLogs(): List<JSONObject> = list("/api/front-office/visitor-logs")
    fun enquiry(said: String): JSONObject = obj("POST", "/api/front-office/enquiries", JSONObject()
        .put("caller_name", "Caller $RUN").put("caller_phone", "94$RUN").put("enquiry_type", "general").put("response_text", said))
    fun enquiries(): List<JSONObject> = list("/api/front-office/enquiries")

    fun firstDepartmentId(): String? {
        val rows = list("/api/setup/departments")
        return (rows.firstOrNull { it.optString("code") == "GEN-MEDICINE" } ?: rows.firstOrNull())?.optString("id")
    }

    fun patient(last: String, phone: String = "98" + RUN.padEnd(8, '0')): JSONObject = obj("POST", "/api/patients", JSONObject()
        .put("first_name", "Seeded").put("last_name", "$last$RUN").put("gender", "female").put("phone", phone)
        .put("date_of_birth", "1988-05-05").put("is_dob_estimated", false).put("registration_type", "new")
        .put("registration_source", "walk_in").put("is_medico_legal", false).put("is_vip", false))

    fun admission(last: String): Admission? {
        val p = patient(last)
        val patientId = p.optString("id").ifEmpty { return null }
        val dept = firstDepartmentId() ?: return null
        val doctor = list("/api/setup/doctors").firstOrNull()?.optString("id")
        val created = obj("POST", "/api/ipd/admissions", JSONObject().put("patient_id", patientId).put("admitting_doctor_id", doctor).put("department_id", dept).put("admission_type", "elective"))
        val adm = created.optJSONObject("admission") ?: return null
        return Admission(adm.getString("id"), adm.getString("encounter_id"), patientId, p.optString("uhid"), "Seeded $last$RUN")
    }

    fun marDose(admissionId: String, drug: String, highAlert: Boolean, minutesFromNow: Long): String? =
        obj("POST", "/api/ipd/admissions/$admissionId/mar", JSONObject().put("drug_name", drug).put("dose", "1 tab").put("route", "oral").put("frequency", "once")
            .put("scheduled_at", DateTimeFormatter.ISO_INSTANT.format(Instant.now().plusSeconds(minutesFromNow * 60))).put("is_high_alert", highAlert)).optString("id").ifEmpty { null }

    fun nurseCall(a: Admission, notes: String): String? =
        obj("POST", "/api/bedside/${a.id}/nurse-request", JSONObject().put("patient_id", a.patientId).put("request_type", "pain_management").put("priority", "high").put("notes", notes)).optString("id").ifEmpty { null }

    fun codeBlue(a: Admission, location: String): String? =
        obj("POST", "/api/nurse/code-blue", JSONObject().put("patient_id", a.patientId).put("encounter_id", a.encounterId).put("location", location)).optString("id").ifEmpty { null }
    fun endCodeBlue(id: String) { call("PUT", "/api/nurse/code-blue/$id/end", JSONObject().put("outcome", "rosc").put("notes", "e2e")) }

    fun transfusion(a: Admission, secondNurseId: String): String? =
        obj("POST", "/api/ipd/admissions/${a.id}/transfusions", JSONObject().put("product_type", "PRBC").put("bag_number", "BAG-$RUN").put("blood_group", "O").put("rh_factor", "positive")
            .put("volume_ml", 350).put("expiry_date", "2027-01-01").put("crossmatch_compatible", true).put("consent_on_file", true).put("product_verified_by_id", secondNurseId)).optString("id").ifEmpty { null }

    fun waitingVisit(doctorId: String, last: String): Pair<String, String>? {
        val p = patient(last)
        val patientId = p.optString("id").ifEmpty { return null }
        val dept = firstDepartmentId() ?: return null
        val v = obj("POST", "/api/opd/encounters", JSONObject().put("patient_id", patientId).put("department_id", dept).put("doctor_id", doctorId))
        val enc = v.optJSONObject("encounter")?.optString("id")?.ifEmpty { null } ?: return null
        return patientId to enc
    }

    fun nurseRequests(admissionId: String) = list("/api/bedside/$admissionId/nurse-requests")
    fun mar(admissionId: String) = list("/api/ipd/admissions/$admissionId/mar")
    fun worklistToken(patientId: String) = list("/api/tokens/worklist?module=opd").firstOrNull { it.optString("patient_id") == patientId }
    /** A camp today started from "General camp": its id and its four stations' counter ids, in route order. */
    fun campRoute(name: String): Pair<String, List<String>> {
        val today = java.time.LocalDate.now().toString()
        val camp = obj("POST", "/api/camp/camps", JSONObject().put("name", "$name $RUN").put("camp_type", "general_health")
            .put("scheduled_date", today).put("organizing_department_id", firstDepartmentId() ?: JSONObject.NULL))
        val id = camp.optString("id")
        val route = org.json.JSONArray(call("POST", "/api/camp/camps/$id/route-template", JSONObject().put("template", "general")).second)
        return id to (0 until route.length()).map { route.getJSONObject(it).getString("counter_id") }
    }
    fun campQueue(station: String) = list("/api/tokens/worklist?module=camp&scope=counter&scope_id=$station")
    fun consultation(encounterId: String): JSONObject? = runCatching { JSONObject(call("GET", "/api/opd/encounters/$encounterId/consultation").second) }.getOrNull()
    fun responders() = list("/api/nurse/code-blue/responders")

    companion object {
        const val BACKEND = "http://10.0.2.2:3000"
        val RUN: String = (System.currentTimeMillis() / 1000 % 1_000_000).toString()
        private var serial = 0
        /** The API as a provisioned identity — what the desk itself can see and do. */
        fun signIn(username: String, password: String): Api {
            val api = Api(null)
            val (status, text) = api.call("POST", "/api/auth/login", JSONObject().put("username", username).put("password", password))
            check(status == 200) { "$username signs in: $status" }
            return Api(JSONObject(text).getString("token"))
        }

        fun admin(): Api {
            val api = Api(null)
            api.token = JSONObject(api.call("POST", "/api/auth/login", JSONObject().put("username", "admin").put("password", "admin123")).second).optString("token").ifEmpty { null }
            checkNotNull(api.token) { "admin signs in through the real API" }
            return api
        }
    }
}
