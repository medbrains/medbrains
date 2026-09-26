package com.medbrains.staff.camp

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** A camp step with where it sits on its camp's route. */
private data class Placed(val station: CampStation, val first: Boolean, val last: Boolean)

/** Stations arrive newest camp first, in route order; each camp's steps stay together. */
private fun placed(rows: List<CampStation>): List<Placed> =
    rows.groupBy { it.camp_id }.values.flatMap { steps -> steps.map { Placed(it, it == steps.first(), it == steps.last()) } }

@Composable
fun CampModule() {
    val nav = rememberNavController()
    val client = LocalApiClient.current
    val api = remember { CampApi(client) }
    val stations = remember { Remote<List<CampStation>>() }
    // A coordinator often starts the route after the volunteers have opened
    // the app; the camp has to appear without a restart.
    LaunchedEffect(Unit) { stations.poll(15_000) { api.stations() } }
    val state by stations.state.collectAsState()
    val byId = { id: String -> placed(state.value.orEmpty()).first { it.station.counter_id == id } }
    NavHost(nav, startDestination = "home") {
        composable("home") { CampHome(nav, api, stations) }
        composable("register/{id}") { CampRegisterScreen(api, byId(it.arguments!!.getString("id")!!).station) }
        composable("station/{id}") {
            val step = byId(it.arguments!!.getString("id")!!)
            CampStationScreen(api, step.station, step.last)
        }
    }
}

/**
 * A camp's route as the volunteer picks their place in it: the first step
 * registers people, every later step calls them by the number registration
 * gave. A step with two doctors is one queue; the room is chosen inside.
 */
@Composable
private fun CampHome(nav: NavHostController, api: CampApi, stations: Remote<List<CampStation>>) {
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    val state by stations.state.collectAsState()
    Column(Modifier.fillMaxSize().testTag("module-home-camp")) {
        CarbonPageHeader("Camp", "Your station", "Choose where you are working today.")
        RemoteContent("camp-stations", state, "Couldn't load the camps", "The hospital server did not answer. Your camp is still running.", { it.isEmpty() }, "No camp running", "A camp appears here once its coordinator starts its route.", { scope.launch { stations.load { api.stations() } } }) { rows ->
            val canRegister = identity?.can("camp.registrations.create") == true
            LazyColumn(Modifier.fillMaxSize().testTag("camp-station-list")) {
                items(placed(rows), key = { it.station.counter_id }) { p ->
                    Column {
                        if (p.first) CarbonSectionTitle(p.station.camp_name)
                        // Registration hands out numbers; nobody queues at it.
                        if (p.first && canRegister) {
                            CarbonActionRow(p.station.label, "Register people and give their number", onClick = { nav.navigate("register/${p.station.counter_id}") }, modifier = Modifier.fillMaxWidth().testTag("camp-station-${p.station.counter_id}")) {
                                Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            }
                        } else if (!p.first) {
                            val detail = if (p.station.rooms.size > 1) "${p.station.rooms.size} rooms share this queue" else "Call the next patient"
                            CarbonActionRow(p.station.label, detail, onClick = { nav.navigate("station/${p.station.counter_id}") }, modifier = Modifier.fillMaxWidth().testTag("camp-station-${p.station.counter_id}")) {
                                Icon(Icons.Filled.Groups, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
        }
    }
}
