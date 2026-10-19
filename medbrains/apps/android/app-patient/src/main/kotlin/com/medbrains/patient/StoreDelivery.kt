package com.medbrains.patient

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import com.medbrains.kit.HomeDelivery
import com.medbrains.kit.ServerTime
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.PickerOption

/** Pickup or part 3's home delivery for a storefront order, as the server offers it. */
data class StoreDeliveryState(
    val offer: PortalDeliveryOffer? = null,
    val delivering: Boolean = false,
    val address: String = "",
    val phone: String = "",
    val payment: String? = null,
) {
    fun problem(): String? = if (delivering) HomeDelivery.problem(address, phone, payment, offer?.payments.orEmpty()) else null

    fun choice(): HomeDelivery.Choice? = if (delivering) HomeDelivery.choice(address, "", null, phone, null, payment.orEmpty()) else null

    companion object {
        /** Prefilled with the first saved address, their phone and the first way to pay. */
        fun from(offer: PortalDeliveryOffer?) = StoreDeliveryState(
            offer = offer,
            address = offer?.addresses?.firstOrNull()?.address.orEmpty(),
            phone = offer?.contact_phone.orEmpty(),
            payment = offer?.payments?.firstOrNull(),
        )
    }
}

@Composable
fun StoreDeliveryFields(state: StoreDeliveryState, pickupOnly: List<String>, onChange: (StoreDeliveryState) -> Unit) {
    val offer = state.offer
    if (pickupOnly.isNotEmpty()) Text("${pickupOnly.joinToString(", ")} can't be delivered: collect at the pharmacy.", style = MaterialTheme.typography.bodySmall)
    if (offer == null || !offer.available) {
        offer?.reason?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        return
    }
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().testTag("store-fulfilment")) {
        listOf(false to "Collect", true to "Home delivery").forEachIndexed { i, (home, label) ->
            SegmentedButton(selected = state.delivering == home, onClick = { onChange(state.copy(delivering = home)) }, shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(label) }
        }
    }
    if (!state.delivering) return
    CarbonTextField(state.address, { onChange(state.copy(address = it)) }, "Deliver to", Modifier.testTag("store-address"), singleLine = false)
    CarbonTextField(state.phone, { onChange(state.copy(phone = it)) }, "Phone for the delivery", keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        offer.payments.forEachIndexed { i, p ->
            SegmentedButton(selected = state.payment == p, onClick = { onChange(state.copy(payment = p)) }, shape = SegmentedButtonDefaults.itemShape(i, offer.payments.size)) {
                Text(HomeDelivery.PAYMENT_LABELS[p] ?: p)
            }
        }
    }
}

/** One of the patient's own unexpired prescriptions from this hospital. */
@Composable
fun StorePrescriptionPicker(rows: List<PortalRefill>, selection: String?, onSelect: (String?) -> Unit) {
    CarbonPicker(
        "One of your prescriptions from this hospital",
        rows.map { PickerOption(it.prescription_id, "${ServerTime.short(it.prescribed_at)} · ${it.drugs.joinToString(", ")}") },
        selection,
        onSelect,
        placeholder = "Choose, or upload one",
        tag = "store-rx",
    )
}
