package com.medbrains.staff.deliveries

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.Remote
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** How often the runner's list refreshes while open. */
private const val REFRESH_MS = 30_000L

/**
 * Rows the list already fetched, so the hand-over screen can open by id
 * without a second trip. Bounded by one runner's deliveries.
 */
class DeliveriesSession {
    val deliveries = mutableStateMapOf<String, Delivery>()
    val patients = mutableStateMapOf<String, DeliveryPatient>()
}

/** The runner's module: their deliveries, and the hand-over at the door. */
@Composable
fun DeliveriesModule() {
    val nav = rememberNavController()
    val session = remember { DeliveriesSession() }
    val api = DeliveriesApi(LocalApiClient.current)
    NavHost(nav, startDestination = "home") {
        composable("home") { DeliveriesHome(nav, api, session) }
        composable("handover/{id}") {
            val delivery = session.deliveries.getValue(it.arguments!!.getString("id")!!)
            HandoverScreen(nav, api, delivery, session.patients[delivery.patient_id])
        }
    }
}

/** What is out with the runner now, and what they have handed over. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeliveriesHome(nav: NavHostController, api: DeliveriesApi, session: DeliveriesSession) {
    var status by remember { mutableStateOf(DeliveryStatus.OUT) }
    val remote = remember(status) { Remote<DeliveryList>() }
    val scope = rememberCoroutineScope()
    suspend fun fetch() = api.list(status).also { list ->
        list.deliveries.forEach { session.deliveries[it.id] = it }
        list.patients.forEach { session.patients[it.id] = it }
    }
    LaunchedEffect(status) { remote.poll(REFRESH_MS) { fetch() } }
    val state by remote.state.collectAsState()

    Column(Modifier.fillMaxSize().testTag("screen-deliveries")) {
        CarbonPageHeader("Deliveries", "My deliveries", "Hand medicines over only against the patient's code.")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("delivery-filter")) {
            listOf(DeliveryStatus.OUT to "Out with me", DeliveryStatus.DELIVERED to "Delivered").forEachIndexed { i, (value, label) ->
                SegmentedButton(
                    selected = status == value,
                    onClick = { status = value },
                    shape = SegmentedButtonDefaults.itemShape(i, 2),
                ) { Text(label) }
            }
        }
        RemoteContent(
            id = "deliveries", state = state,
            unavailableTitle = "Couldn't load your deliveries", unavailableMessage = "This is not an empty list. Try again in a moment.",
            isEmpty = { it.deliveries.isEmpty() },
            emptyTitle = if (status == DeliveryStatus.OUT) "Nothing out with you" else "Nothing delivered yet",
            emptyMessage = "Deliveries the pharmacy gives you appear here.",
            retry = { scope.launch { remote.load { fetch() } } },
        ) { list ->
            val names = list.patients.associateBy { it.id }
            LazyColumn(Modifier.fillMaxSize()) {
                items(list.deliveries, key = { it.id }) { d ->
                    CarbonActionRow(
                        names[d.patient_id]?.full_name ?: "Patient",
                        d.addressLine,
                        onClick = { nav.navigate("handover/${d.id}") },
                        modifier = Modifier.fillMaxWidth().testTag("delivery-${d.id}"),
                    ) {
                        if (d.isCashOnDelivery) CarbonTag("₹${d.amount_due} cash", CarbonTone.Warning)
                    }
                }
            }
        }
    }
}
