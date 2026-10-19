package com.medbrains.patient

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.medbrains.kit.HomeDelivery
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/** The address picker's value for "somewhere else". */
private const val NEW_ADDRESS = "new"
/** How many deliveries the section lists; the server sends at most this. */
private const val DELIVERY_LIMIT = 20

/** How each stage is marked; the words come from [HomeDelivery]. */
private val STAGE_TONES = mapOf(
    "requested" to CarbonTone.Info, "awaiting_payment" to CarbonTone.Warning, "being_prepared" to CarbonTone.Info,
    "out_for_delivery" to CarbonTone.Warning, "delivered" to CarbonTone.Success, "failed" to CarbonTone.Danger,
    "cancelled" to CarbonTone.Neutral, "declined" to CarbonTone.Neutral, "not_deliverable" to CarbonTone.Warning,
)

/**
 * Asking for a refill: collect it, or have it brought home. Delivery offers
 * only what the server allows this patient, and says why when it won't.
 * [send] answers null when requested, otherwise the server's reason.
 */
@Composable
fun RefillChoice(portal: PortalApi, row: PortalRefill, send: suspend (HomeDelivery.Choice?) -> String?, onCancel: () -> Unit) {
    val scope = rememberCoroutineScope()
    var offer by remember { mutableStateOf<PortalDeliveryOffer?>(null) }
    var offerFailed by remember { mutableStateOf(false) }
    var delivering by remember { mutableStateOf(false) }
    var addressKey by remember { mutableStateOf<String?>(null) }
    var typed by remember { mutableStateOf("") }
    var pincode by remember { mutableStateOf("") }
    var landmark by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var slot by remember { mutableStateOf<String?>(null) }
    var payment by remember { mutableStateOf<String?>(null) }
    var sending by remember { mutableStateOf(false) }
    var refused by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(row.prescription_id) {
        runCatching { portal.deliveryOptions(row.prescription_id) }
            .onSuccess {
                offer = it
                addressKey = if (it.addresses.isEmpty()) NEW_ADDRESS else "0"
                phone = it.contact_phone
                payment = it.payments.firstOrNull()
            }
            .onFailure { offerFailed = true }
    }
    val current = offer
    val saved = addressKey?.toIntOrNull()?.let { current?.addresses?.getOrNull(it) }
    val address = saved?.address ?: typed
    val wantsDelivery = delivering && current?.available == true
    val problem = if (wantsDelivery) HomeDelivery.problem(address, phone, payment, current?.payments.orEmpty()) else null

    Column(Modifier.fillMaxWidth().testTag("refill-choice"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (offerFailed) Text("We couldn't check home delivery. You can still collect it at the pharmacy.", style = MaterialTheme.typography.bodyMedium)
        if (current != null && !current.available) {
            Text("Home delivery isn't available for this: ${current.reason.orEmpty()}", Modifier.testTag("delivery-reason"), style = MaterialTheme.typography.bodyMedium)
        }
        if (current?.available == true) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("refill-fulfilment")) {
                listOf(false to "Collect", true to "Home delivery").forEachIndexed { i, (home, label) ->
                    SegmentedButton(
                        selected = delivering == home,
                        onClick = { delivering = home },
                        shape = SegmentedButtonDefaults.itemShape(i, 2),
                        modifier = Modifier.testTag(if (home) "fulfilment-delivery" else "fulfilment-pickup"),
                    ) { Text(label) }
                }
            }
        }
        if (wantsDelivery) {
            val places = current.addresses.mapIndexed { i, a -> PickerOption(i.toString(), "${a.label}: ${a.address}") } + PickerOption(NEW_ADDRESS, "Somewhere else")
            CarbonPicker("Deliver to", places, addressKey, { addressKey = it ?: NEW_ADDRESS }, allowNone = false, tag = "delivery-address")
            if (addressKey == NEW_ADDRESS) {
                CarbonTextField(typed, { typed = it }, "Address", Modifier.testTag("delivery-new-address"), singleLine = false)
                CarbonTextField(pincode, { pincode = it }, "PIN code", keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
            CarbonTextField(landmark, { landmark = it }, "Landmark (optional)")
            CarbonTextField(phone, { phone = it }, "Phone for the delivery", Modifier.testTag("delivery-phone"), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
            CarbonPicker("Preferred time (optional)", current.slots.map { PickerOption(it, HomeDelivery.SLOT_LABELS[it] ?: it) }, slot, { slot = it }, placeholder = "Any time")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("delivery-payment")) {
                current.payments.forEachIndexed { i, p ->
                    SegmentedButton(
                        selected = payment == p,
                        onClick = { payment = p },
                        shape = SegmentedButtonDefaults.itemShape(i, current.payments.size),
                        modifier = Modifier.testTag("pay-$p"),
                    ) { Text(HomeDelivery.PAYMENT_LABELS[p] ?: p) }
                }
            }
            Text(
                if (payment == HomeDelivery.PAY_NOW) "Once the pharmacist approves it, a payment link appears under Deliveries. It goes out once paid." else "Pay when it arrives.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        problem?.let { Text(it, Modifier.testTag("delivery-problem"), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        refused?.let { CarbonNotification(NotificationKind.Error, "Refill not requested", it, Modifier.testTag("refill-refused")) }
        CarbonPrimaryButton(
            if (sending) "Requesting…" else "Request",
            {
                sending = true
                scope.launch {
                    val choice = if (wantsDelivery) {
                        HomeDelivery.choice(address, landmark, saved?.pincode ?: pincode, phone, slot, payment.orEmpty())
                    } else {
                        null
                    }
                    refused = send(choice)
                    sending = false
                }
            },
            Modifier.testTag("refill-send"),
            enabled = !sending && problem == null,
        )
        CarbonTertiaryButton("Cancel", onCancel)
    }
}

/**
 * The patient's deliveries: where each is, when it moved, who is bringing it,
 * the code for the runner, and the link to pay while one is owed.
 * [refresh] is bumped when a refill is requested, so a new one shows at once.
 */
@Composable
fun DeliveriesSection(portal: PortalApi, refresh: Int) {
    val remote = remember { Remote<List<PortalDelivery>>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(refresh) { remote.load { portal.deliveries() } }
    val state by remote.state.collectAsState()
    Column {
        CarbonSectionTitle("Deliveries")
        RemoteContent("deliveries", state, "Couldn't load your deliveries", "Try again in a moment.", { it.isEmpty() }, "No deliveries", "Medicines you ask to have delivered appear here.", { scope.launch { remote.load { portal.deliveries() } } }) { rows ->
            Column { rows.take(DELIVERY_LIMIT).forEach { DeliveryRow(it) } }
        }
    }
}

@Composable
private fun DeliveryRow(d: PortalDelivery) {
    val uri = LocalUriHandler.current
    Column(Modifier.fillMaxWidth().padding(16.dp).testTag("delivery-${d.id}"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(d.drugs.joinToString(", ").ifEmpty { "Your medicines" }, style = MaterialTheme.typography.titleSmall)
        CarbonTag(HomeDelivery.stageLabel(d.stage), STAGE_TONES[d.stage] ?: CarbonTone.Neutral, modifier = Modifier.testTag("delivery-stage-${d.id}"))
        d.address?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        HomeDelivery.steps(d.requested_at, d.prepared_at, d.dispatched_at, d.delivered_at).forEach {
            Text("${it.label}: ${ServerTime.short(it.at)}", style = MaterialTheme.typography.bodyMedium)
        }
        d.carrier?.let { Text("Bringing it: $it${d.tracking_ref?.let { t -> " · tracking $t" }.orEmpty()}", style = MaterialTheme.typography.bodyMedium) }
        d.note?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        if (d.amount_due != null && d.stage != "delivered") Text("To pay when it arrives: ₹${d.amount_due}", style = MaterialTheme.typography.bodyMedium)
        d.handover_code?.let {
            Eyebrow("Give this code to the person delivering")
            Text(it, Modifier.testTag("delivery-code"), style = MaterialTheme.typography.headlineMedium, fontFamily = FontFamily.Monospace)
        }
        if (d.stage == "awaiting_payment") {
            val link = d.payment_url
            if (link != null) {
                CarbonPrimaryButton("Pay ₹${d.pay_amount.orEmpty()} now", { uri.openUri(link) }, Modifier.testTag("delivery-pay"))
            } else {
                Text("Your payment link is being made. Check back in a minute.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
