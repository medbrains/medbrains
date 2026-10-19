package com.medbrains.staff.deliveries

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch

/** The digits in a patient's delivery code. */
private const val CODE_LENGTH = 6

/**
 * At the door: the patient reads out the code they were texted, and the
 * medicines are handed over against it — with the cash taken, for cash on
 * delivery. Or it wasn't delivered, and the runner says why.
 */
@Composable
fun HandoverScreen(nav: NavHostController, api: DeliveriesApi, delivery: Delivery, patient: DeliveryPatient?) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var cash by remember { mutableStateOf(if (delivery.isCashOnDelivery) delivery.amount_due else "") }
    var reason by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }

    fun record(op: suspend () -> Unit) {
        working = true
        scope.launch {
            runCatching { op() }
                .onSuccess { nav.popBackStack() }
                .onFailure { failure = it.message ?: "Try again in a moment." }
            working = false
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-handover")) {
        CarbonPageHeader(patient?.uhid ?: "Delivery", patient?.full_name ?: "Patient", delivery.addressLine)
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CarbonTertiaryButton("Call ${delivery.contact_phone}", {
                context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${delivery.contact_phone}")))
            })
            CarbonTertiaryButton("Directions", {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(delivery.addressLine)}")))
            })
        }
        failure?.let {
            CarbonNotification(NotificationKind.Error, "Not recorded", it, Modifier.padding(16.dp).testTag("handover-error"))
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CarbonTextField(
                code, { code = it.filter(Char::isDigit).take(CODE_LENGTH) }, "Patient's code (the six digits in their text)",
                Modifier.testTag("handover-code"),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
            if (delivery.isCashOnDelivery) {
                CarbonTextField(
                    cash, { cash = it }, "Cash taken (₹${delivery.amount_due} due) — hand it to the pharmacy counter",
                    Modifier.testTag("handover-cash"),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
            CarbonPrimaryButton(
                if (working) "Recording…" else "Delivered",
                { record { api.complete(delivery.id, code, if (delivery.isCashOnDelivery) cash.toDoubleOrNull() else null) } },
                Modifier.testTag("handover-delivered"),
                enabled = !working && code.length == CODE_LENGTH && (!delivery.isCashOnDelivery || cash.toDoubleOrNull() != null),
            )
            CarbonSectionTitle("Couldn't deliver")
            CarbonTextField(reason, { reason = it }, "What happened", Modifier.testTag("handover-reason"), singleLine = false)
            CarbonDangerButton(
                "Not delivered",
                { record { api.fail(delivery.id, reason.trim()) } },
                Modifier.testTag("handover-not-delivered"),
                enabled = !working && reason.isNotBlank(),
            )
        }
    }
}
