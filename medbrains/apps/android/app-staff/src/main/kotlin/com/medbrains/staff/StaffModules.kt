package com.medbrains.staff

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Apartment
import androidx.compose.material.icons.filled.Bloodtype
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Festival
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material.icons.filled.Sync
import androidx.compose.ui.graphics.vector.ImageVector
import com.medbrains.kit.AppModule
import com.medbrains.staff.camp.CampModule
import com.medbrains.staff.doctor.DoctorModule
import com.medbrains.staff.nurse.NurseModule
import com.medbrains.staff.reception.ReceptionModule

/**
 * The staff registry, in the order apps/mobile-staff/src/modules/index.ts
 * keeps it. Order is not cosmetic: the shell opens on the first permitted
 * module, so this list decides where each role lands. Desk and clinical
 * modules first, cross-cutting ones after.
 */
object StaffModules {
    val registry: List<AppModule> = listOf(
        AppModule(id = "doctor", displayName = "Doctor", requiredPermissions = listOf("opd.visit.update"), appCodes = listOf("Mobile-Doctor"), icon = Icons.Filled.MonitorHeart) { DoctorModule() },
        AppModule(id = "nurse", displayName = "Nurse", requiredPermissions = listOf("nurse.dashboard.view"), appCodes = listOf("Mobile-Nurse"), icon = Icons.Filled.LocalHospital) { NurseModule() },
        AppModule(id = "reception", displayName = "Reception", requiredPermissions = listOf("front_office.queue.list"), appCodes = listOf("Desktop-Kiosk", "Desktop-Workstation", "Mobile-Admin", "Mobile-Security"), icon = Icons.Filled.SupportAgent) { ReceptionModule() },
        module("pharmacy", "Pharmacy", Icons.Filled.Medication, listOf("pharmacy.prescriptions.list"), listOf("Mobile-Pharmacist"), 5),
        module("lab", "Lab", Icons.Filled.Science, listOf("lab.orders.list"), listOf("Mobile-LabTech", "Mobile-Phlebo"), 5),
        module("blood-bank", "Blood Bank", Icons.Filled.Bloodtype, listOf("blood_bank.inventory.list"), listOf("Mobile-LabTech", "Mobile-Nurse", "Mobile-Doctor"), 5),
        module("billing", "Billing", Icons.Filled.AccountBalanceWallet, listOf("billing.invoices.list"), listOf("Mobile-Admin", "Desktop-Workstation"), 5),
        module("bme", "BME", Icons.Filled.Build, listOf("bme.equipment.list"), listOf("Mobile-BME", "Desktop-DeviceBridge", "Mobile-Vendor"), 5),
        module("facilities", "Facilities", Icons.Filled.Apartment, listOf("facilities.work_orders.list"), listOf("Mobile-BME", "Mobile-Housekeeping", "TV-Wayfinding"), 5),
        module("housekeeping", "Housekeeping", Icons.Filled.CleaningServices, listOf("housekeeping.cleaning.list"), listOf("Mobile-Housekeeping", "TV-Ward"), 5),
        module("security", "Security", Icons.Filled.Security, listOf("security.incidents.list"), listOf("Mobile-Security", "TV-Emergency"), 5),
        module("hr", "HR", Icons.Filled.Groups, listOf("hr.attendance.list"), listOf("Mobile-Admin"), 5),
        // Last of the working modules: doctors, nurses and pharmacists also hold camp.queue.manage and must still open on their own desk.
        AppModule(id = "camp", displayName = "Camp", requiredPermissions = listOf("camp.queue.manage"), appCodes = listOf("Mobile-Camp"), icon = Icons.Filled.Festival) { CampModule() },
        // Phase 6 defines this module's own permission; until then the pairing roster gates the placeholder.
        module("device-sync", "Device sync", Icons.Filled.Sync, listOf("devices.pairing.paired_list"), listOf("Mobile-Admin"), 6),
    )

    private fun module(id: String, name: String, icon: ImageVector, all: List<String>, apps: List<String>, phase: Int): AppModule {
        lateinit var self: AppModule
        self = AppModule(id = id, displayName = name, requiredPermissions = all, appCodes = apps, icon = icon) {
            PlaceholderModuleHome(self, phase)
        }
        return self
    }
}
