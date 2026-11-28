package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.PagedRows
import com.medbrains.ui.CarbonTextField

/**
 * A loaded admissions list with a search over name, UHID, IP number, bed and ward, and a
 * "Showing N of M" line, so a long ward never ends silently at the first page. Shared by the
 * nurse's shift and the doctor's rounds.
 */
@Composable
fun AdmissionWorklist(paged: PagedRows<AdmissionRow>, row: @Composable (AdmissionRow) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val shown = remember(paged, query) { paged.rows.filter { it.matches(query) } }
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.padding(horizontal = 16.dp)) {
            CarbonTextField(query, { query = it }, "Search: name, UHID, IP number or bed", Modifier.testTag("admissions-search"))
        }
        Text(
            countLine(paged, shown.size), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(16.dp).testTag("admissions-count"),
        )
        if (shown.isEmpty()) {
            Text("No admitted patient matches \"$query\".", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(16.dp))
        }
        LazyColumn(Modifier.fillMaxSize()) { items(shown, key = { it.id }) { row(it) } }
    }
}

/** "Showing 40 of 340", and when the page cap stopped the read, that the rest are not on this list. */
private fun countLine(paged: PagedRows<AdmissionRow>, shown: Int): String {
    val line = "Showing $shown of ${paged.total}"
    return if (paged.isComplete) line else "$line. Only the latest ${paged.rows.size} are loaded here; find others on the web."
}
