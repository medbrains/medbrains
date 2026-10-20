import MedBrainsKit

/// The codes the desk's ABDM screens gate on — the same ones the web's
/// `P.ABDM.*` / `P.PATIENTS.*` use and the server enforces.
enum AbdmPermission {
    static let manageAbha = "abdm.abha.manage"
    static let scanShareView = "abdm.scanshare.view"
    static let viewPatient = "patients.view"
    static let findPatient = "patients.find"
    static let createPatient = "patients.create"
    static let updatePatient = "patients.update"
}

extension TenantIdentity {
    /// Verify or create an ABHA and use it for a new registration.
    var canRegisterWithAbha: Bool { can(AbdmPermission.createPatient) && can(AbdmPermission.manageAbha) }
    /// Link a verified ABHA to an existing record (`/link` checks both).
    var canLinkAbha: Bool { can(AbdmPermission.updatePatient) && can(AbdmPermission.manageAbha) }
    /// Compare a share with a record and link it: the record is looked up
    /// hospital-wide (`patients.find`) before it is linked.
    var canCompareShare: Bool { canLinkAbha && can(AbdmPermission.findPatient) }
    /// Run the duplicate check (`POST /api/patients/match`).
    var canMatchPatients: Bool { canAny([AbdmPermission.viewPatient, AbdmPermission.createPatient]) }
}
