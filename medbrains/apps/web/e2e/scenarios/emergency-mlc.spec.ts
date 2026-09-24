/**
 * SOP ref: docs/sops/06-emergency-casualty.md
 * Scenario S1: Nurse triages arriving patient
 * Scenario S2: Doctor opens emergency encounter + rapid orders
 * Scenario S4: MLC flag and mandatory police intimation
 */

import { test, expect } from "@playwright/test";
import { loginAsRoleApi } from "../helpers/api";
import {
  createPatientApi,
  createEmergencyVisit,
  createTriage,
  createMlcCase,
  createPoliceIntimation,
  createLabOrder,
} from "../helpers/journey-steps";

test.describe("Emergency — triage, encounter, MLC workflow", () => {
  test("nurse triages patient; severity red; emergency visit created", async ({
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);

    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      arrivalMode: "ambulance",
      chiefComplaint: "Chest pain, diaphoresis",
    });
    expect(visit.id).toBeTruthy();
    expect(visit.patient_id).toBe(patient.id);

    const triage = await createTriage(nurseCtx, visit.id, "immediate");
    expect(triage.triage_level).toBe("immediate");
    expect(triage.er_visit_id).toBe(visit.id);
  });

  test("doctor places STAT lab order from active emergency visit", async ({
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const labTechCtx = await loginAsRoleApi(request, "lab_technician");

    const patient = await createPatientApi(doctorCtx);

    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      arrivalMode: "walk_in",
      chiefComplaint: "Altered consciousness",
    });
    expect(visit.encounter_id, "an ER visit is encounter-backed").toBeTruthy();
    await createTriage(nurseCtx, visit.id, "emergent");

    // Doctor places a STAT lab order on the visit's encounter
    const labOrderId = await createLabOrder(doctorCtx, {
      patientId: patient.id,
      encounterId: visit.encounter_id ?? undefined,
      priority: "stat",
    });
    expect(labOrderId).toBeTruthy();

    // Lab tech sees it in the STAT queue
    const { api } = await import("../helpers/api");
    const statOrders = await api<{ order_id: string }[]>(labTechCtx, "GET", "/api/lab/stat-orders");
    expect(statOrders.map((o) => o.order_id)).toContain(labOrderId);
  });

  test("MLC flag created; police intimation generated; MLC number assigned", async ({
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);

    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      arrivalMode: "police",
      // No medico-legal keyword: the MLC below is the doctor's explicit decision.
      chiefComplaint: "Multiple fractures, polytrauma",
    });
    await createTriage(nurseCtx, visit.id, "immediate");

    // Doctor flags as MLC
    const mlcCase = await createMlcCase(doctorCtx, {
      patientId: patient.id,
      visitId: visit.id,
      caseType: "road_traffic_accident",
    });
    expect(mlcCase.id).toBeTruthy();
    expect(mlcCase.mlc_number).toMatch(/MLC/i);
    expect(mlcCase.er_visit_id).toBe(visit.id);
    expect(mlcCase.case_type).toBe("road_traffic_accident");

    // Police intimation generated
    const intimation = await createPoliceIntimation(
      doctorCtx,
      mlcCase.id,
      "Central Police Station E2E",
    );
    expect(intimation.id).toBeTruthy();
    expect(intimation.mlc_case_id).toBe(mlcCase.id);
    expect(intimation.sent_at).not.toBeNull();
  });

  test("assault MLC case gets correct type and intimation", async ({
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);
    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      arrivalMode: "walk_in",
      chiefComplaint: "Penetrating wound, right abdomen",
    });
    await createTriage(nurseCtx, visit.id, "immediate");

    const mlcCase = await createMlcCase(doctorCtx, {
      patientId: patient.id,
      visitId: visit.id,
      caseType: "assault",
    });
    expect(mlcCase.case_type).toBe("assault");

    const { api } = await import("../helpers/api");
    const intimations = await api<{ id: string }[]>(
      doctorCtx,
      "GET",
      `/api/emergency/mlc/${mlcCase.id}/police-intimations`,
    );
    // No auto-intimation; doctor must explicitly create
    const manual = await createPoliceIntimation(doctorCtx, mlcCase.id);
    expect(manual.id).toBeTruthy();

    const intimationsAfter = await api<{ id: string }[]>(
      doctorCtx,
      "GET",
      `/api/emergency/mlc/${mlcCase.id}/police-intimations`,
    );
    expect(intimationsAfter.length).toBeGreaterThan(intimations.length);
  });
});
