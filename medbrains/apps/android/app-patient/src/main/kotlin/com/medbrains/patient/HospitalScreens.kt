package com.medbrains.patient

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import java.time.LocalDate

private val CANCELLED = setOf("cancelled", "no_show")

/** Appointments: what is still coming on top, what already happened below. */
@Composable
fun AppointmentsScreen(portal: PortalApi) {
    val remote = remember { Remote<List<PortalAppointment>>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { remote.load { portal.appointments() } }
    val state by remote.state.collectAsState()
    val rows = state.value.orEmpty().take(100)
    val today = LocalDate.now().toString()
    val upcoming = rows.filter { it.appointment_date >= today && it.status !in CANCELLED }.sortedBy { it.appointment_date }
    val upcomingIds = upcoming.map { it.id }.toSet()
    val past = rows.filter { it.id !in upcomingIds }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-appointments")) {
        CarbonPageHeader("Visits", "Your appointments", "Booked visits, newest first.")
        RemoteContent("appointments", state, "Couldn't load your appointments", "Try again in a moment.", { it.isEmpty() }, "No appointments", "You have no booked visits.", { scope.launch { remote.load { portal.appointments() } } }) {
            Column {
                if (upcoming.isNotEmpty()) CarbonSectionTitle("Coming up")
                upcoming.forEach { a -> CarbonRow(a.appointment_date, a.department_name ?: "Department to be confirmed") }
                if (past.isNotEmpty()) CarbonSectionTitle("Earlier")
                past.forEach { a -> CarbonRow(a.appointment_date, (a.department_name ?: "Department to be confirmed") + " · " + a.status.replace('_', ' ')) }
            }
        }
    }
}

/** Lab results: verified only; a flagged value is marked in words as well as colour. */
@Composable
fun ResultsScreen(portal: PortalApi) {
    val remote = remember { Remote<List<PortalLabReport>>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { remote.load { portal.labReports() } }
    val state by remote.state.collectAsState()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-lab-reports")) {
        CarbonPageHeader("Results", "Your results", "Released by the laboratory.")
        RemoteContent("lab-reports", state, "Couldn't load your results", "Try again in a moment.", { it.isEmpty() }, "No results yet", "Results appear here once the laboratory has checked them. Your doctor will contact you about anything urgent.", { scope.launch { remote.load { portal.labReports() } } }) { rows ->
            Column {
                rows.take(200).forEach { r ->
                    val flagged = r.flag != null && r.flag != "normal"
                    CarbonRow("${r.parameter_name} · ${r.value}${r.unit?.let { " $it" } ?: ""}" + if (flagged) "  [${r.flag}]" else "", "${r.test_name} · ${ServerTime.short(r.reported_at)}" + (r.normal_range?.let { " · usual range $it" } ?: ""))
                }
                Text("Talk to your doctor before acting on anything here.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp))
            }
        }
    }
}

/** Prescriptions, grouped by prescription rather than listed flat. */
@Composable
fun MedicinesScreen(portal: PortalApi) {
    val remote = remember { Remote<List<PortalPrescriptionItem>>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { remote.load { portal.prescriptions() } }
    val state by remote.state.collectAsState()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-prescriptions")) {
        CarbonPageHeader("Medicines", "Your prescriptions", "What was prescribed, and how to take it.")
        RemoteContent("prescriptions", state, "Couldn't load your prescriptions", "Try again in a moment.", { it.isEmpty() }, "No prescriptions yet", "Nothing has been prescribed to you.", { scope.launch { remote.load { portal.prescriptions() } } }) { rows ->
            Column {
                rows.take(200).groupBy { it.prescription_id }.values.sortedByDescending { it.first().prescribed_at }.forEach { items ->
                    CarbonSectionTitle("Prescribed ${ServerTime.short(items.first().prescribed_at)}")
                    items.forEach { m -> CarbonRow(m.drug_name, "${m.dosage} · ${m.frequency} · ${m.duration}") }
                }
                Text("Do not start or stop a medicine without asking your doctor.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp))
            }
        }
    }
}

/** Bills: one number — what is still owed, summed from balances — and the invoices as evidence. */
@Composable
fun BillsScreen(portal: PortalApi) {
    val remote = remember { Remote<List<PortalInvoice>>() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { remote.load { portal.bills() } }
    val state by remote.state.collectAsState()
    val invoices = state.value.orEmpty().take(100)
    val outstanding = invoices.sumOf { it.balance_due.toDoubleOrNull() ?: 0.0 }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-bills")) {
        CarbonPageHeader("Bills", "Your bills", "Invoices, payments and receipts.")
        RemoteContent("bills", state, "Couldn't load your bills", "Try again in a moment.", { it.isEmpty() }, "No bills yet", "Nothing has been billed to you.", { scope.launch { remote.load { portal.bills() } } }) {
            Column {
                Column(Modifier.padding(16.dp)) {
                    Eyebrow(if (outstanding > 0) "Still to pay" else "Nothing outstanding")
                    Text("₹%.2f".format(outstanding), style = MaterialTheme.typography.displaySmall)
                }
                invoices.forEach { inv ->
                    val due = inv.balance_due.toDoubleOrNull() ?: 0.0
                    CarbonRow("₹%.2f".format(inv.total_amount.toDoubleOrNull() ?: 0.0), "${inv.invoice_number} · ${ServerTime.short(inv.created_at)} · " + if (due > 0) "₹%.2f due".format(due) else "paid")
                }
            }
        }
    }
}
