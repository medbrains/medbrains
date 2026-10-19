package com.medbrains.patient

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.Storefront
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import java.io.ByteArrayOutputStream
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Search results shown, at most; the server sends no more. */
private const val RESULT_LIMIT = 40
/** JPEG quality for a prescription photo: legible, well under the server's 8 MB. */
private const val PHOTO_QUALITY = 80
/** The longest side a prescription photo is scaled to. */
private const val PHOTO_MAX_SIDE = 2400

private val TABS = listOf("prescriptions" to "My prescriptions", "shop" to "Shop", "cart" to "Cart", "orders" to "Orders")

/**
 * The hospital pharmacy, ordered from: a prescription written here in one
 * tap, the shop, the cart (with the prescription it rides on and pickup or
 * delivery), and the orders with the pharmacist's answer per medicine.
 */
@Composable
fun StoreScreen(portal: PortalApi) {
    var tab by remember { mutableStateOf("prescriptions") }
    var prescriptionId by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-pharmacy")) {
        CarbonPageHeader("Pharmacy", "Order medicines", "From the hospital's own pharmacy. A pharmacist checks every prescription.")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            TABS.forEachIndexed { i, (id, label) ->
                SegmentedButton(selected = tab == id, onClick = { tab = id }, shape = SegmentedButtonDefaults.itemShape(i, TABS.size), modifier = Modifier.testTag("store-tab-$id")) { Text(label) }
            }
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            when (tab) {
                "prescriptions" -> StorePrescriptions(portal) { prescriptionId = it; tab = "cart" }
                "shop" -> StoreShop(portal)
                "cart" -> StoreCartSection(portal, prescriptionId) { tab = "orders" }
                else -> StoreOrders(portal)
            }
        }
    }
}

@Composable
private fun StorePrescriptions(portal: PortalApi, onOrdered: (String) -> Unit) {
    val remote = remember { Remote<List<PortalRefill>>() }
    val scope = rememberCoroutineScope()
    var note by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { remote.load { portal.refills() } }
    val state by remote.state.collectAsState()
    val today = LocalDate.now().toString()
    RemoteContent("store-prescriptions", state, "Couldn't load your prescriptions", "Try again in a moment.", { rows -> rows.none { Storefront.usable(it.valid_until, today) } }, "No current prescriptions", "Prescriptions from this hospital appear here.", { scope.launch { remote.load { portal.refills() } } }) { rows ->
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            rows.filter { Storefront.usable(it.valid_until, today) }.forEach { r ->
                Text(r.drugs.joinToString(", "), style = MaterialTheme.typography.titleSmall)
                Text("${r.doctor_name?.let { "$it · " }.orEmpty()}${ServerTime.short(r.prescribed_at)}", style = MaterialTheme.typography.bodySmall)
                CarbonPrimaryButton("Order these medicines", {
                    scope.launch {
                        runCatching { portal.orderPrescription(r.prescription_id) }
                            .onSuccess { filled ->
                                note = filled.left_out.joinToString(" · ") { "${it.drug_name}: ${it.reason}" }.ifEmpty { null }
                                onOrdered(filled.prescription_id)
                            }
                            .onFailure { note = it.message }
                    }
                }, Modifier.testTag("order-rx-${r.prescription_id}"))
            }
            note?.let { CarbonNotification(NotificationKind.Info, "Not everything is in your cart", it) }
        }
    }
}

@Composable
private fun StoreShop(portal: PortalApi) {
    val hospital = LocalHospitalCode.current
    val scope = rememberCoroutineScope()
    var q by remember { mutableStateOf("") }
    var items by remember { mutableStateOf<List<StoreItem>>(emptyList()) }
    var message by remember { mutableStateOf<String?>(null) }
    CarbonTextField(q, { q = it }, "Search by brand or generic name", Modifier.testTag("store-search"))
    CarbonPrimaryButton("Search", {
        scope.launch {
            runCatching { portal.searchStore(hospital, q.trim()) }
                .onSuccess { items = it.items.take(RESULT_LIMIT); message = if (it.items.isEmpty()) "Nothing found. Try the generic name." else null }
                .onFailure { message = "The pharmacy isn't taking orders online right now." }
        }
    }, Modifier.testTag("store-search-go"))
    message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    items.forEach { item ->
        StoreItemRow(item) {
            scope.launch {
                message = runCatching { portal.setQuantity(item.id, 1) }.fold({ "${item.name} is in your cart" }, { it.message })
            }
        }
    }
}

@Composable
private fun StoreItemRow(item: StoreItem, onAdd: () -> Unit) {
    Column(Modifier.fillMaxWidth().testTag("store-item-${item.id}"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(item.name, style = MaterialTheme.typography.titleSmall)
        Text(listOfNotNull(item.inn, item.pack).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            item.schedule?.let { CarbonTag("Schedule $it", CarbonTone.Warning) }
            if (item.prescription_needed) CarbonTag("Prescription needed", CarbonTone.Info)
            CarbonTag(Storefront.label(Storefront.STOCK_LABELS, item.stock), if (item.stock == "out") CarbonTone.Neutral else CarbonTone.Success)
        }
        Text(item.price?.let { "₹$it${item.mrp?.takeIf { m -> m != it }?.let { m -> " · MRP ₹$m" }.orEmpty()}" } ?: "Price at the pharmacy", style = MaterialTheme.typography.bodyMedium)
        item.note?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        if (Storefront.canAdd(item.on_sale, item.sale_class, item.price, item.stock)) CarbonTertiaryButton("Add to cart", onAdd)
    }
}

/** A picked photo as JPEG base64, scaled to a legible size. */
private suspend fun photoBase64(context: android.content.Context, uri: Uri): String? = withContext(Dispatchers.IO) {
    val bitmap = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) } ?: return@withContext null
    val scale = minOf(1f, PHOTO_MAX_SIDE.toFloat() / maxOf(bitmap.width, bitmap.height))
    val scaled = if (scale < 1f) Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true) else bitmap
    val out = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, PHOTO_QUALITY, out)
    Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
}

@Composable
private fun StoreCartSection(portal: PortalApi, prescriptionId: String?, onPlaced: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var cart by remember { mutableStateOf<StoreCart?>(null) }
    var refills by remember { mutableStateOf<List<PortalRefill>>(emptyList()) }
    var hospitalRx by remember { mutableStateOf(prescriptionId) }
    var delivery by remember { mutableStateOf(StoreDeliveryState()) }
    var message by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        cart = runCatching { portal.cart() }.getOrNull()
        refills = runCatching { portal.refills() }.getOrDefault(emptyList())
        delivery = StoreDeliveryState.from(runCatching { portal.storeDeliveryOptions() }.getOrNull())
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch {
            val data = photoBase64(context, uri)
            message = if (data == null) "That photo couldn't be read" else runCatching { cart = portal.uploadPrescription(data); null }.getOrElse { it.message }
        }
    }
    val current = cart
    if (current == null || current.lines.isEmpty()) {
        Text("Your cart is empty. Search for a medicine, or order a prescription.", style = MaterialTheme.typography.bodyMedium)
        return
    }
    current.lines.forEach { l ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("${l.item.name} × ${l.quantity}${l.line_total?.let { " · ₹$it" }.orEmpty()}", style = MaterialTheme.typography.bodyMedium)
            CarbonTertiaryButton("Remove", { scope.launch { cart = runCatching { portal.setQuantity(l.item.id, 0) }.getOrDefault(current) } }, Modifier.testTag("remove-${l.item.id}"))
        }
    }
    Text("Total ₹${current.total}", style = MaterialTheme.typography.titleSmall)
    if (current.prescription_needed) {
        CarbonSectionTitle("Prescription")
        val today = LocalDate.now().toString()
        StorePrescriptionPicker(refills.filter { Storefront.usable(it.valid_until, today) }, hospitalRx) { hospitalRx = it }
        CarbonTertiaryButton(if (current.prescription_uploaded) "Upload a different photo" else "Upload a photo of it", { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, Modifier.testTag("upload-rx"))
    }
    StoreDeliveryFields(delivery, current.lines.filter { it.item.pickup_only }.map { it.item.name }) { delivery = it }
    message?.let { CarbonNotification(NotificationKind.Error, "Not ordered", it, Modifier.testTag("store-message")) }
    CarbonPrimaryButton("Place order", {
        val checkout = Storefront.checkout(current.lines.size, current.lines.all { it.item.on_sale }, current.prescription_needed, hospitalRx, current.prescription_uploaded)
        when (checkout) {
            is Storefront.Checkout.Problem -> message = checkout.reason
            is Storefront.Checkout.Ready -> scope.launch {
                val problem = delivery.problem()
                if (problem != null) { message = problem; return@launch }
                runCatching { portal.checkout(checkout.source, checkout.prescriptionId, delivery.choice()) }
                    .onSuccess { onPlaced() }
                    .onFailure { message = it.message }
            }
        }
    }, Modifier.testTag("place-order"))
}

@Composable
private fun StoreOrders(portal: PortalApi) {
    val remote = remember { Remote<List<StoreOrder>>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { remote.load { portal.storeOrders() } }
    val state by remote.state.collectAsState()
    RemoteContent("store-orders", state, "Couldn't load your orders", "Try again in a moment.", { it.isEmpty() }, "No orders yet", "Medicines you order appear here.", { scope.launch { remote.load { portal.storeOrders() } } }) { rows ->
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            rows.forEach { o ->
                Column(Modifier.testTag("store-order-${o.id}"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    CarbonTag(Storefront.label(Storefront.ORDER_STATUS_LABELS, o.status), if (o.status == "rejected") CarbonTone.Danger else CarbonTone.Info)
                    o.lines.forEach { l ->
                        val refused = l.reject_reason?.let { " — not approved: ${Storefront.label(Storefront.REJECT_REASON_LABELS, it)}" }.orEmpty()
                        Text("${l.drug_name} × ${l.approved_quantity ?: l.quantity}$refused", style = MaterialTheme.typography.bodyMedium)
                    }
                    o.decision_note?.let { Text("Pharmacist: $it", style = MaterialTheme.typography.bodySmall) }
                    Text("Total ₹${o.total} · ${if (o.fulfilment == "delivery") "home delivery" else "collect at the pharmacy"}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
