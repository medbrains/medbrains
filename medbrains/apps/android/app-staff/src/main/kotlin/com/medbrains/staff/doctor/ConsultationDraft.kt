package com.medbrains.staff.doctor

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement

private val wire = Json { ignoreUnknownKeys = true; explicitNulls = false }

/**
 * The consultation note as the handheld writes it: the four prose fields
 * and the findings at a site. The note keeps them as sections — subjective
 * (chief complaint), objective (examination), assessment, plan, and the
 * examination record — the same places the web's case sheet writes.
 */
data class ConsultationDraft(
    val chief: String = "",
    val exam: String = "",
    val assessment: String = "",
    val plan: String = "",
    val findings: List<ExamFinding> = emptyList(),
) {
    /** The sections to save. The examination record keeps whatever else the web wrote in it; only its findings are replaced. */
    fun patches(examData: JsonElement?): List<SectionPatch> {
        val outer = (examData as? JsonObject) ?: JsonObject(emptyMap())
        val inner = (outer["exam"] as? JsonObject) ?: JsonObject(emptyMap())
        val withFindings = JsonObject(inner + ("findings" to wire.encodeToJsonElement(findings)))
        return listOf(
            SectionPatch("subjective", noteHtml(chief)),
            SectionPatch("objective", noteHtml(exam)),
            SectionPatch("assessment", noteHtml(assessment)),
            SectionPatch("plan", noteHtml(plan)),
            SectionPatch("examination", data = JsonObject(outer + ("exam" to withFindings))),
        )
    }

    companion object {
        fun of(note: Note): ConsultationDraft {
            fun text(code: String) = plainText(note.sections.firstOrNull { it.code == code }?.text.orEmpty())
            return ConsultationDraft(text("subjective"), text("objective"), text("assessment"), text("plan"), findingsIn(note))
        }

        fun findingsIn(note: Note): List<ExamFinding> {
            val raw = note.sections.firstOrNull { it.code == "examination" }?.data
                ?.let { (it as? JsonObject)?.get("exam") as? JsonObject }?.get("findings") as? JsonArray ?: return emptyList()
            return runCatching { wire.decodeFromJsonElement<List<ExamFinding>>(raw) }.getOrDefault(emptyList())
        }
    }
}

/** The web editor's HTML as the paragraphs a reader sees. */
fun plainText(html: String): String {
    var text = html
    listOf("</p>" to "\n", "<br>" to "\n", "<br/>" to "\n", "<br />" to "\n", "<li>" to "\n• ").forEach { (tag, to) -> text = text.replace(tag, to) }
    text = text.replace(Regex("<[^>]+>"), "")
    listOf("&nbsp;" to " ", "&lt;" to "<", "&gt;" to ">", "&quot;" to "\"", "&#39;" to "'", "&amp;" to "&").forEach { (e, c) -> text = text.replace(e, c) }
    return text.lines().map { it.trim() }.filter { it.isNotEmpty() }.joinToString("\n")
}

/** Plain text as the editor's HTML, one paragraph per line, so the web shows what the handheld wrote. */
fun noteHtml(plain: String): String = plain.lines().map { it.trim() }.filter { it.isNotEmpty() }
    .joinToString("") { "<p>" + it.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</p>" }
