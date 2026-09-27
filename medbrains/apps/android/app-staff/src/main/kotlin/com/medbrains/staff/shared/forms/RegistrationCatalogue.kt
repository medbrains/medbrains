package com.medbrains.staff.shared.forms

import androidx.compose.runtime.mutableStateMapOf
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import uniffi.edge_rn.RegistrationProblem
import uniffi.edge_rn.registrationCarriesOver
import uniffi.edge_rn.registrationCatalogueJson
import uniffi.edge_rn.registrationProblems
import uniffi.edge_rn.registrationRequestJson
import uniffi.edge_rn.registrationVisibleFields

// The registration form as the shared core defines it
// (crates/medbrains-clinical-core/src/registration). The wizard draws these
// fields; it decides no rule and hides nothing on its own.

@Serializable data class CatalogueOption(val value: String, val label: String)

@Serializable data class CatalogueOptions(val source: String, val options: List<CatalogueOption>? = null)

@Serializable
data class CatalogueField(
    val id: String,
    val label: String,
    val step: String,
    val kind: String,
    val options: CatalogueOptions,
    val hint: String? = null,
    /** What a new draft starts with, if anything. */
    val default: String? = null,
)

@Serializable data class CatalogueStep(val step: String, val title: String)

@Serializable
data class RegistrationCatalogue(val steps: List<CatalogueStep>, val fields: List<CatalogueField>) {
    fun fieldsIn(step: String): List<CatalogueField> = fields.filter { it.step == step }
    fun field(id: String): CatalogueField? = fields.firstOrNull { it.id == id }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        /** Built into the app with the core, so it is always the rules this build enforces. */
        val shared: RegistrationCatalogue by lazy { json.decodeFromString(serializer(), registrationCatalogueJson()) }
    }
}

/** How a field is entered, as the core names it. */
object FieldKind {
    const val TOGGLE = "toggle"
    const val SEGMENTED = "segmented"
    const val SELECT = "select"
    const val DATE = "date"
    const val LONG_TEXT = "long_text"
    const val PHONE = "phone"
    const val EMAIL = "email"
    const val SEARCH = "search"
    const val TAGS = "tags"
    const val HIDDEN = "hidden"
    val NUMERIC = setOf("digits", "number", "age")
}

/** Where a field's choices come from. */
object OptionSource {
    const val FIXED = "fixed"
    const val DEPARTMENTS = "departments"
    const val DOCTORS = "doctors"
    const val CAMPS = "camps"
    const val ICD11 = "icd11"
    const val DRUG_CATALOGUE = "drug_catalogue"
}

/** The loaded lists a field's choices can come from; fixed choices come with the field. */
data class OptionLists(
    val departments: List<CatalogueOption> = emptyList(),
    val doctors: List<CatalogueOption> = emptyList(),
    val camps: List<CatalogueOption> = emptyList(),
) {
    fun options(field: CatalogueField): List<CatalogueOption> = when (field.options.source) {
        OptionSource.FIXED -> field.options.options.orEmpty()
        OptionSource.DEPARTMENTS -> departments
        OptionSource.DOCTORS -> doctors
        OptionSource.CAMPS -> camps
        else -> emptyList()
    }
}

/**
 * What the desk has entered, by the catalogue's field ids. The core reads it
 * for problems, visibility and the request; nothing here interprets it.
 */
class RegistrationDraftValues {
    private val values = mutableStateMapOf<String, String>().apply { putAll(defaults()) }

    /** The catalogue's starting values — the same the web form starts with. */
    private fun defaults(): Map<String, String> =
        RegistrationCatalogue.shared.fields.mapNotNull { f -> f.default?.let { f.id to it } }.toMap()

    operator fun get(id: String): String = values[id].orEmpty()
    operator fun set(id: String, value: String) { values[id] = value }

    /** A toggle's value as a Boolean. */
    fun isOn(id: String): Boolean = values[id] == "true"

    private fun snapshot(): Map<String, String> = values.toMap()
    fun problems(): List<RegistrationProblem> = registrationProblems(snapshot())
    fun visible(): Set<String> = registrationVisibleFields(snapshot()).toSet()

    /** The create-patient request, as the core builds it. */
    fun request(year: Int): String = registrationRequestJson(snapshot(), year)

    /** The person is cleared and the desk kept — which is which is the core's call. */
    fun clearPerson() {
        values.keys.filterNot { registrationCarriesOver(it) }.forEach { values.remove(it) }
        defaults().forEach { (id, v) -> values.putIfAbsent(id, v) }
    }
}

