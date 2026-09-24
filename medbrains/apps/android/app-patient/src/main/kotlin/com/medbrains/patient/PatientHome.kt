package com.medbrains.patient

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.medbrains.kit.AuthStore
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.Eyebrow
import uniffi.edge_rn.companionAccess

/**
 * Two destinations: **Hospital**, the record a clinician wrote, and
 * **Health**, what the person does day to day — present only when the
 * hospital licensed the companion, hidden by default including while the
 * entitlement loads. A locked tab is an advert; an absent tab is navigation.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientHome(auth: AuthStore) {
    val portal = LocalPortalApi.current
    var companionVia by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        // A rejected request leaves the door unknown, which keeps it shut.
        val licensed = runCatching { portal.entitlements().companion }.getOrNull()
        companionVia = companionAccess(licensed, null, null)
    }
    var tab by remember { mutableStateOf("hospital") }
    var menuOpen by remember { mutableStateOf(false) }
    val nav = rememberNavController()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (tab == "hospital") "Hospital" else "Today", style = MaterialTheme.typography.headlineSmall) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                actions = {
                    IconButton(onClick = { menuOpen = true }) { Icon(Icons.Filled.AccountCircle, contentDescription = "Account") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Sign out") }, onClick = { menuOpen = false; auth.signOut() })
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.background, modifier = Modifier.testTag("patient-home")) {
                NavigationBarItem(selected = tab == "hospital", onClick = { tab = "hospital"; nav.navigate("hospital") { popUpTo("hospital") { inclusive = true } } }, icon = { Icon(Icons.Filled.LocalHospital, null) }, label = { Text("Hospital") }, modifier = Modifier.testTag("tab-hospital-item"))
                if (companionVia != null) {
                    NavigationBarItem(selected = tab == "health", onClick = { tab = "health"; nav.navigate("health") { popUpTo("hospital") } }, icon = { Icon(Icons.Filled.Favorite, null) }, label = { Text("Health") }, modifier = Modifier.testTag("tab-health-item"))
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            NavHost(nav, startDestination = "hospital") {
                composable("hospital") { HospitalTab { nav.navigate(it) } }
                composable("health") { HealthTab { nav.navigate("bands") } }
                composable("appointments") { AppointmentsScreen(portal) }
                composable("lab-reports") { ResultsScreen(portal) }
                composable("prescriptions") { MedicinesScreen(portal) }
                composable("bills") { BillsScreen(portal) }
                composable("bands") { BandsScreen() }
                composable("consent") {
                    TilesScreen("consent", "Consent", "Consent", "View, grant, or revoke consent for any of your records.", listOf(
                        "Active consents" to "What you've granted, to whom, for how long.", "Revoke a consent" to "Stop a previously granted access.",
                        "Access audit" to "Who saw what, when.", "Export my data" to "DPDP right to portability.", "Delete my account" to "DPDP right to erasure (with safety holds)."))
                }
                composable("family-share") {
                    TilesScreen("family-share", "Family", "Family share", "Link family, share specific records, set expiry.", listOf(
                        "Link a family member" to "Parent, spouse, child or caregiver.", "Share a record" to "Choose what they can see, and until when.", "Manage sharing" to "Stop or extend a share."))
                }
            }
        }
    }
}

private data class Entry(val id: String, val label: String, val detail: String, val icon: ImageVector)

/** The hospital's record of the patient, one row per module in the order the RN registry kept. */
@Composable
fun HospitalTab(open: (String) -> Unit) {
    val entries = listOf(
        Entry("appointments", "Appointments", "Booked visits, newest first.", Icons.Filled.CalendarMonth),
        Entry("lab-reports", "Results", "Released by the laboratory.", Icons.Filled.Science),
        Entry("prescriptions", "Medicines", "What was prescribed, and how to take it.", Icons.Filled.Medication),
        Entry("bills", "Bills", "Invoices, payments and receipts.", Icons.Filled.AccountBalanceWallet),
        Entry("consent", "Consent", "View, grant, or revoke consent for your records.", Icons.Filled.VerifiedUser),
        Entry("family-share", "Family share", "Link family, share specific records, set expiry.", Icons.Filled.Groups),
    )
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("tab-hospital")) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            Eyebrow("Your record")
            Text("What your hospital has recorded about you.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        entries.forEach { e ->
            CarbonActionRow(e.label, e.detail, onClick = { open(e.id) }, modifier = Modifier.fillMaxWidth().testTag("module-${e.id}")) {
                Icon(e.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

/** A module the RN app carried as tiles without a backend yet; same tiles here, the wiring lands with the portal endpoints. */
@Composable
fun TilesScreen(id: String, eyebrow: String, title: String, subtitle: String, tiles: List<Pair<String, String>>) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-$id")) {
        CarbonPageHeader(eyebrow, title, subtitle)
        tiles.forEach { (t, d) ->
            CarbonTonedTile(CarbonTone.Info, Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                Text(t, style = MaterialTheme.typography.titleMedium)
                Text(d, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
