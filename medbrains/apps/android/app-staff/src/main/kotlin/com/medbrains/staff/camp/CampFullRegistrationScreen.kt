package com.medbrains.staff.camp

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.navigation.NavHostController
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.staff.reception.CampSummary
import com.medbrains.staff.reception.ReceptionApi
import com.medbrains.staff.reception.ReceptionSession
import com.medbrains.staff.reception.RegisterPatientScreen
import com.medbrains.staff.reception.load

/**
 * The full registration wizard, opened from a camp's registration table:
 * every field the web asks, the form starting as this camp's, and the patient
 * put on the camp's route once registered. The quick form stays for a queue
 * of villagers; this is for the one who needs a proper record.
 */
@Composable
fun CampFullRegistrationScreen(nav: NavHostController, station: CampStation) {
    val client = LocalApiClient.current
    val api = remember { ReceptionApi(client) }
    val session = remember { ReceptionSession() }
    val identity = LocalIdentity.current
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { session.load(api) { identity?.can(it) == true }; loaded = true }
    // A camp the list did not return (the role cannot list camps) is still this camp: the station names it.
    val camp = session.camps.firstOrNull { it.id == station.camp_id } ?: CampSummary(station.camp_id, station.camp_name)
    if (loaded) RegisterPatientScreen(nav, api, session, camp)
}
