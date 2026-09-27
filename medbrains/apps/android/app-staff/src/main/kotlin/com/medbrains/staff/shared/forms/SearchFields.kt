package com.medbrains.staff.shared.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

/**
 * A code chosen from ICD-11 as the desk types. Choosing one writes the code,
 * its display, source and version into the draft — the catalogue's hidden
 * companions of the field — and the display into the provisional diagnosis,
 * as the web's picker does. A lookup that fails is said, never an empty list.
 */
@Composable
fun TerminologyField(field: CatalogueField, draft: RegistrationDraftValues, lookups: CatalogueLookups?) {
    var query by remember { mutableStateOf("") }
    var hits by remember { mutableStateOf<List<TerminologyHit>>(emptyList()) }
    var failed by remember { mutableStateOf(false) }
    // `icd11_code` → `icd11_`: the companions share the field's prefix.
    val prefix = field.id.removeSuffix("code")

    fun choose(hit: TerminologyHit?) {
        draft[field.id] = hit?.code.orEmpty()
        draft["${prefix}display"] = hit?.display.orEmpty()
        draft["${prefix}source_url"] = hit?.source_url.orEmpty()
        draft["${prefix}source_version"] = hit?.source_version.orEmpty()
        draft["${prefix}provider_mode"] = hit?.provider_mode.orEmpty()
        if (hit != null) draft["initial_diagnosis_text"] = hit.display
        query = ""; hits = emptyList()
    }

    LaunchedEffect(query) {
        val q = query.trim()
        if (lookups == null || q.length < CatalogueLookups.MINIMUM_QUERY) { hits = emptyList(); return@LaunchedEffect }
        delay(CatalogueLookups.DEBOUNCE_MS)
        try { hits = lookups.icd11(q); failed = false } catch (e: CancellationException) { throw e } catch (e: Exception) { failed = true }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            draft[field.id].isNotEmpty() -> Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                CarbonTag("${draft[field.id]} · ${draft["${prefix}display"]}", CarbonTone.Info)
                TextButton(onClick = { choose(null) }) { Text("Clear") }
            }
            lookups == null -> Text("Search is not available for your role; write the diagnosis above.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            else -> {
                CarbonTextField(query, { query = it }, "Search ICD-11", Modifier.testTag("${field.id}-search"))
                if (failed) Text("Could not search just now; try again or write the diagnosis above.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                hits.forEach { hit ->
                    CarbonActionRow(hit.display, hit.code, onClick = { choose(hit) }, modifier = Modifier.fillMaxWidth().testTag("${field.id}-hit-${hit.code}")) {}
                }
            }
        }
    }
}

private const val TAG_SEPARATOR = ", "

/** Several entries kept as one comma-separated value, as the web sends them. Typed entries always work; the formulary suggests names when it answers. */
@Composable
fun TagsField(value: String, onChange: (String) -> Unit, label: String, lookups: CatalogueLookups?, tag: String) {
    var entry by remember { mutableStateOf("") }
    var suggestions by remember { mutableStateOf<List<String>>(emptyList()) }
    val tags = value.split(",").map { it.trim() }.filter { it.isNotEmpty() }

    fun add(name: String) {
        val new = name.trim()
        if (new.isEmpty() || new in tags) return
        onChange((tags + new).joinToString(TAG_SEPARATOR)); entry = ""; suggestions = emptyList()
    }

    LaunchedEffect(entry) {
        val q = entry.trim()
        if (lookups == null || q.length < CatalogueLookups.MINIMUM_QUERY) { suggestions = emptyList(); return@LaunchedEffect }
        delay(CatalogueLookups.DEBOUNCE_MS)
        // Suggestions are a convenience: without them the typed name still counts.
        suggestions = try { lookups.drugs(q) } catch (e: CancellationException) { throw e } catch (e: Exception) { emptyList() }
    }

    Column(Modifier.testTag(tag), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tags.forEach { t ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(t, style = MaterialTheme.typography.bodyLarge)
                IconButton(onClick = { onChange(tags.filter { it != t }.joinToString(TAG_SEPARATOR)) }) { Icon(Icons.Filled.Close, contentDescription = "Remove $t") }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CarbonTextField(entry, { entry = it }, "Add ${label.lowercase()}", Modifier.weight(1f).testTag("tags-entry"))
            CarbonTertiaryButton("Add", onClick = { add(entry) }, enabled = entry.isNotBlank(), modifier = Modifier.testTag("tags-add"))
        }
        suggestions.forEach { name -> CarbonActionRow(name, null, onClick = { add(name) }, modifier = Modifier.fillMaxWidth()) {} }
    }
}
