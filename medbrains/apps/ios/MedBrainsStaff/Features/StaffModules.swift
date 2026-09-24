import MedBrainsKit
import SwiftUI

/// The staff registry, in the order apps/mobile-staff/src/modules/index.ts
/// keeps it. Order is not cosmetic: the shell opens on the first permitted
/// module, so this list decides where each role lands. A receptionist holds
/// `billing.invoices.list` for taking payments, and with reception at the
/// bottom that landed them in Billing every morning. Desk and clinical
/// modules first, cross-cutting ones after.
enum StaffModules {
    static let registry: [AppModule] = [
        AppModule(id: "doctor", displayName: "Doctor", symbol: "stethoscope", requiredPermissions: ["opd.visit.update"], appCodes: ["Mobile-Doctor"]) { AnyView(DoctorHomeView()) },
        AppModule(id: "nurse", displayName: "Nurse", symbol: "cross.case", requiredPermissions: ["nurse.dashboard.view"], appCodes: ["Mobile-Nurse"]) { AnyView(NurseHomeView()) },
        AppModule(id: "reception", displayName: "Reception", symbol: "person.badge.clock", requiredPermissions: ["front_office.queue.list"], appCodes: ["Desktop-Kiosk", "Desktop-Workstation", "Mobile-Admin", "Mobile-Security"]) { AnyView(ReceptionHomeView()) },
        module("pharmacy", "Pharmacy", "pills", ["pharmacy.prescriptions.list"], apps: ["Mobile-Pharmacist"], phase: 5),
        module("lab", "Lab", "testtube.2", ["lab.orders.list"], apps: ["Mobile-LabTech", "Mobile-Phlebo"], phase: 5),
        module("blood-bank", "Blood Bank", "drop", ["blood_bank.inventory.list"], apps: ["Mobile-LabTech", "Mobile-Nurse", "Mobile-Doctor"], phase: 5),
        module("billing", "Billing", "indianrupeesign.circle", ["billing.invoices.list"], apps: ["Mobile-Admin", "Desktop-Workstation"], phase: 5),
        module("bme", "BME", "wrench.and.screwdriver", ["bme.equipment.list"], apps: ["Mobile-BME", "Desktop-DeviceBridge", "Mobile-Vendor"], phase: 5),
        module("facilities", "Facilities", "building.2", ["facilities.work_orders.list"], apps: ["Mobile-BME", "Mobile-Housekeeping", "TV-Wayfinding"], phase: 5),
        module("housekeeping", "Housekeeping", "bed.double", ["housekeeping.cleaning.list"], apps: ["Mobile-Housekeeping", "TV-Ward"], phase: 5),
        module("security", "Security", "shield.lefthalf.filled", ["security.incidents.list"], apps: ["Mobile-Security", "TV-Emergency"], phase: 5),
        module("hr", "HR", "person.2", ["hr.attendance.list"], apps: ["Mobile-Admin"], phase: 5),
        // Phase 6 defines this module's own permission; until then the pairing roster gates the placeholder.
        module("device-sync", "Device sync", "arrow.triangle.2.circlepath", ["devices.pairing.paired_list"], apps: ["Mobile-Admin"], phase: 6),
    ]

    private static func module(_ id: String, _ name: String, _ symbol: String, _ all: [String], apps: [String], phase: Int) -> AppModule {
        AppModule(id: id, displayName: name, symbol: symbol, requiredPermissions: all, appCodes: apps) {
            AnyView(PlaceholderModuleHome(module: AppModule(id: id, displayName: name, symbol: symbol, requiredPermissions: all, appCodes: apps) { AnyView(EmptyView()) }, phase: phase))
        }
    }
}
