package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavHostController
import com.medbrains.kit.PagedRows
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** Active admissions worklist. Pick a bed to enter the bedside workspace. */
@Composable
fun AdmissionsListScreen(nav: NavHostController, api: NurseApi, session: NurseSession) {
    val remote = remember { Remote<PagedRows<AdmissionRow>>() }
    val scope = rememberCoroutineScope()
    /** Every admitted patient, each kept in the session so a row opens by its id. */
    suspend fun load() = remote.load { api.listActiveAdmissions().also { paged -> paged.rows.forEach { session.admissions[it.id] = it } } }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()

    Column(Modifier.fillMaxSize().testTag("screen-admissions")) {
        CarbonPageHeader("Nurse", "My shift", "Tap a patient to open bedside MAR, vitals, I/O and risk actions.")
        RemoteContent(
            id = "admissions", state = state,
            unavailableTitle = "Couldn't load admissions", unavailableMessage = "The ward list could not be loaded. Do not read this as an empty ward.",
            isEmpty = { it.rows.isEmpty() }, emptyTitle = "No active admissions", emptyMessage = "Nobody is admitted on your wards right now.",
            retry = { scope.launch { load() } },
        ) { paged ->
            AdmissionWorklist(paged) { row ->
                CarbonActionRow(row.patient_name, row.bedLine, onClick = { nav.navigate("workspace/${row.id}") }, modifier = Modifier.fillMaxWidth().testTag("admission-${row.id}")) {
                    CarbonTag("active", CarbonTone.Success)
                }
            }
        }
    }
}
