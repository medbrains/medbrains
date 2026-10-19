package com.medbrains.kit

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Reads an NRCeS FHIR document bundle (as another facility sent it through
 * ABDM) into sections a clinician can scan: diagnoses, medicines, results with
 * their units and ranges, and attached documents. The same reading as the web
 * (`apps/web/src/components/Patient/abdm/fhirSections.ts`) and iOS. Bounded —
 * a bundle can carry thousands of resources; the screen shows the first few dozen.
 */
object FhirSections {
    /** Sections and items shown per record. */
    const val MAX_SECTIONS = 20
    const val MAX_ITEMS = 50

    /** A document to open: a web link, or content sent inline. */
    sealed interface Link {
        val label: String
        data class Web(val url: String, override val label: String) : Link
        /** Base64 content, always saved as a file, never opened in place. */
        data class Inline(val base64: String, val contentType: String, override val label: String, val fileName: String) : Link
    }

    /** One line; [key] is the reference it was read from, with its position. */
    data class Item(val key: String, val text: String, val detail: String? = null, val link: Link? = null)
    data class Section(val key: String, val title: String, val items: List<Item>)
    data class Document(val title: String?, val date: String?, val author: String?, val sections: List<Section>)

    private val WEB_LINK = Regex("^https?://", RegexOption.IGNORE_CASE)

    /** The document's header and readable sections; an empty one for anything that is not a bundle. */
    fun read(bundle: JsonElement?): Document {
        val byRef = index(bundle)
        val composition = list(bundle["entry"]).map { it["resource"] }.firstOrNull { text(it["resourceType"]) == "Composition" }
        val author = byRef[text(list(composition["author"]).firstOrNull()["reference"]) ?: ""]
        val sections = list(composition["section"]).take(MAX_SECTIONS)
            .mapIndexed { i, raw -> section(raw, i, byRef) }
            .filter { it.items.isNotEmpty() }
        return Document(
            title = text(composition["title"]),
            date = text(composition["date"]),
            author = text(list(author["name"]).firstOrNull()["text"]) ?: text(author["name"]),
            sections = sections,
        )
    }

    /** A CodeableConcept in words: its text, else its first coding's display. */
    fun concept(v: JsonElement?): String? =
        text(v["text"]) ?: list(v["coding"]).firstOrNull()?.let { text(it["display"]) ?: text(it["code"]) }

    /** One resource as a line: what it is, and the detail that matters. */
    fun describe(r: JsonElement?, key: String = ""): Item {
        val type = text(r["resourceType"]) ?: "Entry"
        return when (type) {
            "Observation" -> {
                val value = quantity(r["valueQuantity"]) ?: text(r["valueString"]) ?: concept(r["valueCodeableConcept"])
                val flag = concept(list(r["interpretation"]).firstOrNull())
                val detail = listOfNotNull(range(r), flag).joinToString(" · ")
                Item(key, listOfNotNull(concept(r["code"]) ?: "Observation", value).joinToString(": "), detail.ifEmpty { null })
            }
            "MedicationRequest", "MedicationStatement" -> {
                val dosage = present(r["dosageInstruction"]) ?: r["dosage"]
                Item(key, concept(r["medicationCodeableConcept"]) ?: "Medicine", text(list(dosage).firstOrNull()["text"]))
            }
            "DiagnosticReport" -> Item(key, concept(r["code"]) ?: "Report", text(r["conclusion"]))
            "DocumentReference" -> {
                val attachment = list(r["content"]).firstOrNull()["attachment"]
                Item(key, concept(r["type"]) ?: text(attachment["title"]) ?: "Document", link = link(attachment))
            }
            "Binary" -> Item(key, "Attached document", link = link(null, text(r["data"]), text(r["contentType"]), null))
            "Immunization" -> Item(key, concept(r["vaccineCode"]) ?: "Immunisation", text(r["occurrenceDateTime"]))
            else -> Item(key, concept(r["code"]) ?: type, concept(r["clinicalStatus"]) ?: text(r["recordedDate"]))
        }
    }

    // reading

    private operator fun JsonElement?.get(key: String): JsonElement? = (this as? JsonObject)?.get(key)

    private fun text(v: JsonElement?): String? = (v as? JsonPrimitive)?.takeIf { it.isString }?.content?.ifEmpty { null }

    private fun list(v: JsonElement?): List<JsonElement> = (v as? JsonArray).orEmpty()

    /** JSON `null` reads as absent, as `??` does on the web. */
    private fun present(v: JsonElement?): JsonElement? = v.takeUnless { it is JsonNull }

    /** `12` not `12.0`: a number reads as the sender wrote it. */
    private fun number(n: Double): String = if (n % 1.0 == 0.0 && kotlin.math.abs(n) < 1e15) n.toLong().toString() else n.toString()

    private fun quantity(v: JsonElement?): String? {
        val value = (v["value"] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull ?: return null
        return listOfNotNull(number(value), text(v["unit"]) ?: text(v["code"])).joinToString(" ")
    }

    private fun range(r: JsonElement?): String? {
        val first = list(r["referenceRange"]).firstOrNull()
        text(first["text"])?.let { return "Range $it" }
        val low = quantity(first["low"])
        val high = quantity(first["high"])
        return if (low != null || high != null) "Range ${low ?: "…"} – ${high ?: "…"}" else null
    }

    private fun link(a: JsonElement?): Link? = link(text(a["url"]), text(a["data"]), text(a["contentType"]), text(a["title"]))

    /** Another facility's content: only web links open; anything else (`javascript:`, `file:`) is dropped. */
    private fun link(url: String?, data: String?, contentType: String?, title: String?): Link? {
        val label = title ?: "Open document"
        if (url != null && WEB_LINK.containsMatchIn(url)) return Link.Web(url, label)
        data ?: return null
        return Link.Inline(data, contentType ?: "application/octet-stream", label, title ?: "document")
    }

    /** Resources by every name a reference may use: fullUrl and `Type/id`. */
    private fun index(bundle: JsonElement?): Map<String, JsonElement> {
        val map = HashMap<String, JsonElement>()
        for (entry in list(bundle["entry"])) {
            val resource = entry["resource"] ?: JsonObject(emptyMap())
            text(entry["fullUrl"])?.let { map[it] = resource }
            val type = text(resource["resourceType"])
            val id = text(resource["id"])
            if (type != null && id != null) map["$type/$id"] = resource
        }
        return map
    }

    private fun section(raw: JsonElement, position: Int, byRef: Map<String, JsonElement>): Section {
        val refs = list(raw["entry"]).take(MAX_ITEMS).map { text(it["reference"]) ?: "" }.filter { it in byRef }
        val items = refs.mapIndexed { i, ref -> describe(byRef[ref], "$i:$ref") }
        val title = text(raw["title"]) ?: concept(raw["code"]) ?: "Section"
        return Section("$position:$title", title, items)
    }
}
