package com.medbrains.kit

/**
 * Blood pressure is two numbers — systolic (high) and diastolic (low). Every
 * screen that takes one checks it here, by the same rules as the web
 * (`@medbrains/schemas` blood-pressure.ts) and iOS, so a reading is refused the
 * same way at the bedside and on the desk.
 */
object BloodPressure {
    val SYSTOLIC_RANGE = 50..300
    val DIASTOLIC_RANGE = 20..200

    data class Errors(val systolic: String? = null, val diastolic: String? = null) {
        val isEmpty: Boolean get() = systolic == null && diastolic == null
        val message: String? get() = systolic ?: diastolic
    }

    /** A checked reading: both numbers, or neither. */
    data class Reading(val systolic: Int?, val diastolic: Int?)

    /** Errors for the text in the two fields; blank in both is allowed. */
    fun validate(systolic: String, diastolic: String): Errors {
        val s = systolic.trim()
        val d = diastolic.trim()
        var sysError: String? = null
        var diaError: String? = null
        if (s.isNotEmpty() && s.toIntOrNull()?.let { it in SYSTOLIC_RANGE } != true) {
            sysError = "Systolic must be a whole number, ${SYSTOLIC_RANGE.first}–${SYSTOLIC_RANGE.last} mmHg"
        }
        if (d.isNotEmpty() && d.toIntOrNull()?.let { it in DIASTOLIC_RANGE } != true) {
            diaError = "Diastolic must be a whole number, ${DIASTOLIC_RANGE.first}–${DIASTOLIC_RANGE.last} mmHg"
        }
        if (s.isNotEmpty() && d.isEmpty()) diaError = "Enter the diastolic (low) value too"
        if (s.isEmpty() && d.isNotEmpty()) sysError = "Enter the systolic (high) value too"
        if (sysError == null && diaError == null) {
            val sv = s.toIntOrNull()
            val dv = d.toIntOrNull()
            if (sv != null && dv != null && sv <= dv) diaError = "Diastolic (low) must be lower than systolic (high)"
        }
        return Errors(sysError, diaError)
    }

    /** The reading to send, or null with [validate]'s errors to show. */
    fun readingOrNull(systolic: String, diastolic: String): Reading? =
        if (validate(systolic, diastolic).isEmpty) Reading(systolic.trim().toIntOrNull(), diastolic.trim().toIntOrNull()) else null
}
