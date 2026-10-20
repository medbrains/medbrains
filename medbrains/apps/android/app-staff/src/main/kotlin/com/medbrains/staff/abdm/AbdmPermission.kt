package com.medbrains.staff.abdm

import com.medbrains.kit.TenantIdentity

/** The codes the desk's ABDM screens gate on — the same ones the web's `P.ABDM.*` / `P.PATIENTS.*` use and the server enforces. */
object AbdmPermission {
    const val MANAGE_ABHA = "abdm.abha.manage"
    const val SCAN_SHARE_VIEW = "abdm.scanshare.view"
    const val VIEW_PATIENT = "patients.view"
    const val FIND_PATIENT = "patients.find"
    const val CREATE_PATIENT = "patients.create"
    const val UPDATE_PATIENT = "patients.update"
}

/** Verify or create an ABHA and use it for a new registration. */
val TenantIdentity?.canRegisterWithAbha: Boolean get() = this != null && can(AbdmPermission.CREATE_PATIENT) && can(AbdmPermission.MANAGE_ABHA)

/** Link a verified ABHA to an existing record (`/link` checks both). */
val TenantIdentity?.canLinkAbha: Boolean get() = this != null && can(AbdmPermission.UPDATE_PATIENT) && can(AbdmPermission.MANAGE_ABHA)

/** Run the duplicate check (`POST /api/patients/match`). */
val TenantIdentity?.canMatchPatients: Boolean get() = this != null && canAny(listOf(AbdmPermission.VIEW_PATIENT, AbdmPermission.CREATE_PATIENT))

/** Compare a share with a record and link it: the record is looked up hospital-wide (`patients.find`) before it is linked. */
val TenantIdentity?.canCompareShare: Boolean get() = canLinkAbha && this != null && can(AbdmPermission.FIND_PATIENT)
