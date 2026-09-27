package com.medbrains.staff.shared.forms

import com.medbrains.kit.ApiClient
import kotlinx.serialization.Serializable
import java.net.URLEncoder

/** A code chosen from a terminology search, as `/api/terminology/search` answers. */
@Serializable
data class TerminologyHit(
    val code: String,
    val display: String,
    val source_url: String? = null,
    val source_version: String? = null,
    val provider_mode: String,
)

@Serializable private data class DrugRow(val name: String, val generic_name: String? = null)

/**
 * The searches a catalogue field can run while the desk types: a terminology
 * (ICD-11) and the drug formulary (for allergies). Read-only lookups, gated
 * on their own codes (`terminology.search`, `pharmacy.catalog.lookup`).
 */
class CatalogueLookups(private val client: ApiClient) {
    private fun encoded(q: String) = URLEncoder.encode(q, "UTF-8")

    suspend fun icd11(q: String): List<TerminologyHit> = client.get("/api/terminology/search?system=icd11&q=${encoded(q)}&limit=$LIMIT")

    /** Drug names for an allergy list: the brand, and its generic when it has one. */
    suspend fun drugs(q: String): List<String> =
        client.get<List<DrugRow>>("/api/pharmacy/catalog?search=${encoded(q)}").map { listOfNotNull(it.name, it.generic_name).joinToString(" — ") }.take(LIMIT)

    companion object {
        /** The fewest characters worth sending: one letter matches half a terminology. */
        const val MINIMUM_QUERY = 2
        const val LIMIT = 10
        /** Typing settles before asking: one request per pause, not per key. */
        const val DEBOUNCE_MS = 300L
    }
}
