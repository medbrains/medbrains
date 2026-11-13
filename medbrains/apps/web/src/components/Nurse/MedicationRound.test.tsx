import { MantineProvider } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { MarDueRow } from "@medbrains/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MedicationRound } from "./MedicationRound";

const due = vi.hoisted(() => ({ rows: [] as MarDueRow[] }));

vi.mock("@/services/nurseActivities.service", () => ({
  nurseActivitiesService: {
    listMarDueNow: () => Promise.resolve(due.rows),
    updateMarRound: () => Promise.resolve({}),
  },
}));

const dose = (id: string, drug: string, isHighAlert: boolean): MarDueRow => ({
  id,
  admission_id: "a1",
  patient_id: "p1",
  patient_name: "Mar Gate",
  bed_id: null,
  drug_name: drug,
  dose: "10 units",
  route: "sc",
  frequency: "OD",
  scheduled_at: "2026-11-12T08:00:00Z",
  status: "scheduled",
  is_high_alert: isHighAlert,
  is_cytotoxic: false,
  batch_number: null,
  batch_expiry: null,
  patients_own: false,
});

function renderRound() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <MedicationRound />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

const NOT_ALLOWED = "Hand to a nurse allowed to give high-alert doses";

describe("MedicationRound high-alert giver gate", () => {
  beforeEach(() => {
    due.rows = [dose("d1", "Insulin regular", true), dose("d2", "Paracetamol", false)];
  });

  it("offers a nurse holding the code every dose", async () => {
    usePermissionStore
      .getState()
      .setPermissions("nurse", ["nurse.mar.administer", "nurse.mar.administer_high_alert"]);
    renderRound();
    expect(await screen.findByText(/Insulin regular/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Administer" })).toHaveLength(2);
    expect(screen.queryByText(NOT_ALLOWED)).toBeNull();
  });

  it("does not offer an administrator the high-alert dose, only the ordinary one", async () => {
    usePermissionStore.getState().setPermissions("hospital_admin", []);
    renderRound();
    expect(await screen.findByText(NOT_ALLOWED)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Administer" })).toHaveLength(1);
  });

  it("is view only without nurse.mar.administer", async () => {
    usePermissionStore.getState().setPermissions("nurse", ["nurse.mar.view"]);
    renderRound();
    expect(await screen.findAllByText("View only")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Administer" })).toBeNull();
  });
});
