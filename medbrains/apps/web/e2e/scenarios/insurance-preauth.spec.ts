/**
 * SOP ref: docs/sops/20-insurance-tpa.md
 * Scenario S1: Insurance officer verifies eligibility at admission
 * Scenario S2: Insurance officer submits pre-auth; TPA approves
 * Scenario S3: Claim submitted post-discharge; denial tracked
 */

import { test, expect } from "@playwright/test";
import { loginAsRoleApi, api } from "../helpers/api";
import {
  createPatientApi,
  createEncounter,
  admitToIpd,
  createPatientInsurance,
  createInsuranceVerification,
  createPriorAuth,
  submitPriorAuth,
  respondPriorAuth,
} from "../helpers/journey-steps";
import { getOpdDept, getIpdDept, getAvailableBed } from "../helpers/seed-resolvers";

test.describe("Insurance — eligibility verification and prior auth lifecycle", () => {
  test("insurance officer verifies eligibility; result recorded against patient", async ({
    request,
  }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const insuranceCtx = await loginAsRoleApi(request, "insurance_officer");

    const patient = await createPatientApi(doctorCtx);
    const insurance = await createPatientInsurance(doctorCtx, patient.id);

    const verification = await createInsuranceVerification(
      insuranceCtx,
      patient.id,
      insurance.id,
    );

    expect(verification.id).toBeTruthy();
    expect(verification.patient_id).toBe(patient.id);
    expect(["pending", "active", "inactive", "unknown", "error"]).toContain(verification.status);
  });

  test("prior auth created → submitted → approved; sanctioned amount on record", async ({
    request,
  }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const insuranceCtx = await loginAsRoleApi(request, "insurance_officer");

    const patient = await createPatientApi(doctorCtx);
    const insurance = await createPatientInsurance(doctorCtx, patient.id);
    const opdDept = await getOpdDept(doctorCtx);
    const ipdDept = await getIpdDept(doctorCtx);
    const bed = await getAvailableBed(doctorCtx);

    const encounterId = await createEncounter(doctorCtx, patient.id, {
      departmentId: opdDept.id,
    });

    const admissionId = await admitToIpd(doctorCtx, {
      patientId: patient.id,
      encounterId,
      departmentId: ipdDept.id,
      bedId: bed?.id,
      admissionType: "elective",
      provisionalDiagnosis: "Acute appendicitis",
    });
    expect(admissionId).toBeTruthy();

    // Insurance officer raises pre-auth linked to admission
    const priorAuth = await createPriorAuth(insuranceCtx, {
      patientId: patient.id,
      patientInsuranceId: insurance.id,
      encounterId,
      diagnosisCode: "K35.9",
      estimatedCost: 75000,
    });
    expect(priorAuth.id).toBeTruthy();
    expect(priorAuth.status).toBe("draft");

    // Submit to TPA
    const submitted = await submitPriorAuth(insuranceCtx, priorAuth.id);
    expect(submitted.status).toBe("submitted");

    // TPA responds — approved
    const approved = await respondPriorAuth(
      insuranceCtx,
      priorAuth.id,
      "approved",
      65000,
    );
    expect(approved.status).toBe("approved");
    expect(approved.approved_amount).toBeTruthy();
    expect(approved.auth_number).toBeTruthy();
  });

  test("prior auth denied; denial reason recorded; status is denied", async ({
    request,
  }) => {
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const insuranceCtx = await loginAsRoleApi(request, "insurance_officer");

    const patient = await createPatientApi(doctorCtx);
    const insurance = await createPatientInsurance(doctorCtx, patient.id);

    const priorAuth = await createPriorAuth(insuranceCtx, {
      patientId: patient.id,
      patientInsuranceId: insurance.id,
      diagnosisCode: "J18.9",
      estimatedCost: 30000,
    });

    await submitPriorAuth(insuranceCtx, priorAuth.id);

    const denied = await respondPriorAuth(insuranceCtx, priorAuth.id, "denied");
    expect(denied.status).toBe("denied");
    expect(denied.approved_amount).toBeNull();
    expect(denied.auth_number).toBeNull();
  });

  test("insurance dashboard returns required summary fields", async ({
    request,
  }) => {
    const insuranceCtx = await loginAsRoleApi(request, "insurance_officer");

    const dashboard = await api<{
      pending_prior_auths: number;
      approved_prior_auths: number;
      denied_prior_auths: number;
      total_verifications: number;
    }>(insuranceCtx, "GET", "/api/insurance/dashboard");

    expect(typeof dashboard.pending_prior_auths).toBe("number");
    expect(typeof dashboard.approved_prior_auths).toBe("number");
    expect(typeof dashboard.denied_prior_auths).toBe("number");
    expect(typeof dashboard.total_verifications).toBe("number");
  });
});
