package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CodeText
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

fun marTone(status: String): CarbonTone = when (status) {
    "scheduled" -> CarbonTone.Info
    "given" -> CarbonTone.Success
    "missed" -> CarbonTone.Danger
    "refused", "held" -> CarbonTone.Warning
    else -> CarbonTone.Neutral
}

/** The MAR schedule; giving a dose happens on the bedside screen, which scans first. */
@Composable
fun MarScheduleScreen(nav: NavHostController, api: NurseApi, session: NurseSession, admission: AdmissionRow) {
    val remote = remember { Remote<List<MarRow>>() }
    val scope = rememberCoroutineScope()
    // Refetch every time the screen shows: the dose just recorded has to be visibly gone.
    suspend fun load() = remote.load { api.listMar(admission.id).also { rows -> rows.forEach { session.doses[it.id] = it } } }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()

    Column(Modifier.fillMaxSize().testTag("screen-mar")) {
        CarbonPageHeader("MAR", admission.patient_name, admission.bedLine)
        RemoteContent(
            id = "mar", state = state,
            unavailableTitle = "Couldn't load MAR", unavailableMessage = "The schedule could not be loaded. Do not read this as no doses due.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No scheduled doses", emptyMessage = "MAR is empty for this admission.",
            retry = { scope.launch { load() } },
        ) { rows ->
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(rows, key = { it.id }) { dose ->
                    CarbonTonedTile(if (dose.is_high_alert) CarbonTone.HighAlert else marTone(dose.status)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                            Column(Modifier.weight(1f)) {
                                Text(dose.drug_name, style = MaterialTheme.typography.titleMedium)
                                Text("${dose.dose} · ${dose.route}" + (dose.frequency?.let { " · $it" } ?: ""), style = CodeText, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("DUE ${ServerTime.short(dose.scheduled_at)}", style = CodeText, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                CarbonTag(dose.status, marTone(dose.status))
                                if (dose.is_high_alert) CarbonTag("high alert", CarbonTone.HighAlert)
                            }
                        }
                        if (dose.status == "scheduled") {
                            CarbonPrimaryButton("Take to bedside", onClick = { nav.navigate("administer/${admission.id}/${dose.id}") },
                                modifier = Modifier.padding(top = 12.dp).testTag("mar-take-to-bedside").semantics { contentDescription = "Take ${dose.drug_name} to the bedside and scan" })
                        }
                    }
                }
            }
        }
    }
}
