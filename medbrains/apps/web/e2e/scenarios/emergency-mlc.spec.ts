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
import { getFirstLabTest } from "../helpers/seed-resolvers";

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

    const triage = await createTriage(nurseCtx, visit.id, "red");
    expect(triage.severity).toBe("red");
    expect(triage.visit_id).toBe(visit.id);
  });

  test("doctor places STAT lab order from active emergency visit", async ({
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");
    const labTechCtx = await loginAsRoleApi(request, "lab_technician");

    const patient = await createPatientApi(doctorCtx);
    const labTest = await getFirstLabTest(doctorCtx);

    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      arrivalMode: "walk_in",
      chiefComplaint: "Altered consciousness",
    });
    await createTriage(nurseCtx, visit.id, "orange");

    // Doctor places STAT lab order referencing emergency visit
    const labOrderId = await createLabOrder(doctorCtx, {
      patientId: patient.id,
      testId: labTest.id,
      urgency: "stat",
      sourceType: "emergency",
      sourceId: visit.id,
    });
    expect(labOrderId).toBeTruthy();

    // Lab tech verifies STAT order appears in stat queue
    const { api } = await import("../helpers/api");
    const statOrders = await api<{ id: string; urgency: string }[]>(
      labTechCtx,
      "GET",
      "/api/lab/stat-orders",
    );
    const found = statOrders.find((o) => o.id === labOrderId);
    expect(found).toBeDefined();
    expect(found!.urgency).toBe("stat");
  });

  test("MLC flag created; police intimation generated; MLC number assigned", async ({
    request,
  }) => {
    const nurseCtx = await loginAsRoleApi(request, "nurse");
    const doctorCtx = await loginAsRoleApi(request, "doctor");

    const patient = await createPatientApi(doctorCtx);

    const visit = await createEmergencyVisit(nurseCtx, patient.id, {
      arrivalMode: "police",
      chiefComplaint: "Multiple trauma injuries — RTA",
    });
    await createTriage(nurseCtx, visit.id, "red");

    // Doctor flags as MLC
    const mlcCase = await createMlcCase(doctorCtx, visit.id, "road_traffic_accident");
    expect(mlcCase.id).toBeTruthy();
    expect(mlcCase.mlc_number).toMatch(/MLC/i);
    expect(mlcCase.visit_id).toBe(visit.id);
    expect(mlcCase.mlc_type).toBe("road_traffic_accident");

    // Police intimation generated
    const intimation = await createPoliceIntimation(
      doctorCtx,
      mlcCase.id,
      "Central Police Station E2E",
    );
    expect(intimation.id).toBeTruthy();
    expect(intimation.mlc_id).toBe(mlcCase.id);
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
      chiefComplaint: "Stab wound, right abdomen",
    });
    await createTriage(nurseCtx, visit.id, "red");

    const mlcCase = await createMlcCase(doctorCtx, visit.id, "assault");
    expect(mlcCase.mlc_type).toBe("assault");

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
