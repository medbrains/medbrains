package com.medbrains.patient

import com.medbrains.kit.HomeDelivery
import kotlinx.serialization.Serializable

// The hospital pharmacy's storefront, as the server sends it
// (crates/medbrains-pharmacy/src/storefront). Stock is a word, never a count.

@Serializable data class StoreItem(
    val id: String,
    val name: String,
    val inn: String? = null,
    val manufacturer: String? = null,
    val pack: String? = null,
    val schedule: String? = null,
    val sale_class: String,
    val prescription_needed: Boolean = false,
    val note: String? = null,
    val pickup_only: Boolean = false,
    val stock: String,
    val mrp: String? = null,
    val price: String? = null,
    val max_quantity: Int = 1,
    val on_sale: Boolean = true,
)
@Serializable data class StoreSearchResult(val items: List<StoreItem> = emptyList(), val categories: List<String> = emptyList())
@Serializable data class StoreCartLine(val item: StoreItem, val quantity: Int, val from_prescription: Boolean = false, val line_total: String? = null)
@Serializable data class StoreCart(
    val lines: List<StoreCartLine> = emptyList(),
    val total: String = "0",
    val prescription_needed: Boolean = false,
    val prescription_uploaded: Boolean = false,
)
@Serializable data class StoreOrderLine(
    val catalog_item_id: String,
    val drug_name: String,
    val quantity: Int,
    val status: String,
    val approved_quantity: Int? = null,
    val reject_reason: String? = null,
)
@Serializable data class StoreOrder(
    val id: String,
    val status: String,
    val fulfilment: String,
    val placed_at: String? = null,
    val decision_note: String? = null,
    val lines: List<StoreOrderLine> = emptyList(),
    val total: String = "0",
)
@Serializable data class LeftOut(val drug_name: String, val reason: String)
@Serializable data class StoreOrderedPrescription(val prescription_id: String, val cart: StoreCart, val left_out: List<LeftOut> = emptyList())
/** Somebody a shared mobile belongs to: enough to pick themselves. */
@Serializable data class PortalPerson(val id: String, val name: String, val birth_year: Int? = null)
/** A sign-in's answer: the session, or who to choose between when a family shares the mobile. */
@Serializable data class PortalSignIn(
    val token: String? = null,
    val patient_id: String? = null,
    val tenant_id: String? = null,
    val choose: List<PortalPerson> = emptyList(),
)
@Serializable internal data class OtpChoose(val tenant_code: String, val phone: String, val code: String, val patient_id: String? = null)
@Serializable internal data class SetQuantity(val quantity: Int)
@Serializable internal data class RxUpload(val data_base64: String)
@Serializable internal data class CheckoutAsk(
    val prescription_source: String,
    val prescription_id: String? = null,
    val delivery: HomeDelivery.Choice? = null,
)
