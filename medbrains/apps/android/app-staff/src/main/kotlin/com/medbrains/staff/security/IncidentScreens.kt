package com.medbrains.staff.security

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** The tone a severity reads in; the word is always in the tag too. */
fun severityTone(severity: String): CarbonTone = when (severity) {
    "critical", "high" -> CarbonTone.Danger
    "medium" -> CarbonTone.Warning
    else -> CarbonTone.Neutral
}

private fun String.titled() = replaceFirstChar { it.uppercase() }

/** S3: the incident register, open ones first. */
@Composable
fun IncidentsDesk(nav: NavHostController, api: SecurityApi, session: SecuritySession) {
    val canReport = LocalIdentity.current?.can(SecurityPermission.CREATE_INCIDENT) == true
    val remote = remember { Remote<List<SecurityIncidentRow>>() }
    val scope = rememberCoroutineScope()
    suspend fun fetch() = api.incidents().also { rows -> rows.forEach { session.incidents[it.id] = it } }
    LaunchedEffect(Unit) { remote.poll(SecurityRefresh.QUEUE_MS) { fetch() } }
    val state by remote.state.collectAsState()
    val stale by remote.staleSince.collectAsState()
    Column(Modifier.fillMaxSize()) {
        if (canReport) {
            CarbonPrimaryButton("Report an incident", { nav.navigate("report") }, Modifier.padding(16.dp).testTag("security-incident-report"))
        }
        StaleBanner(stale, "incidents")
        RemoteContent(
            id = "security-incidents", state = state,
            unavailableTitle = "Couldn't load incidents", unavailableMessage = "This is not an empty register. Try again in a moment.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No incidents", emptyMessage = "Incidents reported on rounds appear here.",
            retry = { scope.launch { remote.load { fetch() } } },
        ) { rows ->
            LazyColumn(Modifier.fillMaxSize().testTag("security-incident-rows")) {
                items(rows.sortedByDescending { it.isOpen }, key = { it.id }) { row ->
                    CarbonActionRow(
                        row.categoryLabel, "${row.location_description ?: "No location"} · ${ServerTime.short(row.occurred_at)}",
                        onClick = { nav.navigate("incident/${row.id}") },
                        modifier = Modifier.testTag("security-incident-${row.id}"),
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            CarbonTag(row.severity.titled(), severityTone(row.severity))
                            if (!row.isOpen) CarbonTag(row.status.titled())
                        }
                    }
                }
            }
        }
    }
}

/** S4: what happened, how bad, where. Back discards it; nothing is saved until the server answers. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportIncidentScreen(nav: NavHostController, api: SecurityApi) {
    val scope = rememberCoroutineScope()
    var category by remember { mutableStateOf<String?>(null) }
    var severity by remember { mutableStateOf("medium") }
    var location by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    var people by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-security-report")) {
        CarbonPageHeader("Security", "Report an incident", "Say what happened, where, and who was involved.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonPicker("What happened", IncidentCategory.all.map { PickerOption(it.first, it.second) }, category, { category = it }, placeholder = "Choose a category", allowNone = false, tag = "picker-incident-category")
            Text("How serious", style = MaterialTheme.typography.labelMedium)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                IncidentSeverity.all.forEachIndexed { i, s ->
                    SegmentedButton(
                        selected = severity == s, onClick = { severity = s },
                        shape = SegmentedButtonDefaults.itemShape(i, IncidentSeverity.all.size),
                        modifier = Modifier.testTag("security-incident-severity-$s"),
                    ) { Text(s.titled()) }
                }
            }
            CarbonTextField(location, { location = it }, "Where (ward, gate, corridor)", Modifier.testTag("field-incident-location"))
            CarbonTextField(details, { details = it }, "What happened", Modifier.testTag("field-incident-description"), singleLine = false)
            CarbonTextField(people, { people = it }, "People involved (optional)", Modifier.testTag("field-incident-people"))
            failure?.let { CarbonNotification(NotificationKind.Error, "Not reported", it, Modifier.testTag("security-incident-error")) }
            CarbonPrimaryButton(if (working) "Reporting…" else "Report", onClick = report@{
                val chosen = category ?: return@report
                working = true; failure = null
                scope.launch {
                    try {
                        api.report(NewIncidentBody(chosen, severity, location.trim().ifEmpty { null }, details.trim(), people.trim().ifEmpty { null }?.let { listOf(it) }))
                        nav.popBackStack()
                    } catch (e: Exception) {
                        // The typed values stay: a refusal must not cost the guard the report.
                        failure = securityWriteFailure(e)
                    } finally { working = false }
                }
            }, modifier = Modifier.testTag("security-incident-submit"), enabled = !working && category != null && details.isNotBlank())
        }
    }
}

/** S5: the incident and its timeline; a note, and resolving it, for those who may update the register. */
@Composable
fun IncidentDetailScreen(api: SecurityApi, incident: SecurityIncidentRow) {
    val canUpdate = LocalIdentity.current?.can(SecurityPermission.UPDATE_INCIDENT) == true
    val scope = rememberCoroutineScope()
    val timeline = remember(incident.id) { Remote<List<IncidentUpdateRow>>() }
    var note by remember { mutableStateOf("") }
    var status by remember { mutableStateOf(incident.status) }
    var working by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    var confirming by remember { mutableStateOf(false) }
    LaunchedEffect(incident.id) { timeline.load { api.updates(incident.id) } }
    val state by timeline.state.collectAsState()

    fun write(op: suspend () -> Unit) {
        working = true; failure = null
        scope.launch {
            try { op(); timeline.load { api.updates(incident.id) } } catch (e: Exception) { failure = securityWriteFailure(e) } finally { working = false }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-security-incident")) {
        CarbonPageHeader(incident.incident_number, incident.categoryLabel, incident.location_description) {
            CarbonTag(incident.severity.titled(), severityTone(incident.severity))
        }
        CarbonRow("Status", status.titled())
        CarbonRow("Occurred", ServerTime.short(incident.occurred_at))
        Text(incident.description, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(16.dp))
        failure?.let { CarbonNotification(NotificationKind.Error, "Not saved", it, Modifier.padding(horizontal = 16.dp)) }
        if (canUpdate) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonTextField(note, { note = it }, "Add an update", Modifier.testTag("field-incident-update"), singleLine = false)
                CarbonPrimaryButton(if (working) "Saving…" else "Add update", {
                    val text = note.trim()
                    write { api.addUpdate(incident.id, text); note = "" }
                }, Modifier.testTag("security-incident-add-update"), enabled = !working && note.isNotBlank())
                if (status == "reported" || status == "investigating") {
                    CarbonTertiaryButton("Mark resolved", { confirming = true }, Modifier.testTag("security-incident-resolve"), enabled = !working)
                }
            }
        }
        CarbonSectionTitle("Timeline")
        RemoteContent(
            id = "security-incident-timeline", state = state,
            unavailableTitle = "Couldn't load the timeline", unavailableMessage = "Updates may exist. Try again in a moment.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No updates yet", emptyMessage = "Notes added to this incident appear here, newest first.",
            retry = { scope.launch { timeline.load { api.updates(incident.id) } } },
        ) { rows ->
            // Bounded by the server (500); a column, because the screen already scrolls.
            Column {
                rows.forEach { row ->
                    Column(Modifier.testTag("security-incident-update-${row.id}")) {
                        CarbonRow(row.description, "${row.updated_by_name ?: "Someone"} · ${ServerTime.short(row.created_at)}")
                    }
                }
            }
        }
    }

    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("Mark this incident resolved?") },
            confirmButton = {
                TextButton(onClick = { confirming = false; write { status = api.resolveIncident(incident.id).status } }) { Text("Mark resolved") }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text("Cancel") } },
        )
    }
}
