/**
 * The vitals counter shows "Record vitals" to whoever the server will let
 * record them, and sends the reading to the endpoint that person may call.
 */
import type { QueueEntry } from "@medbrains/types";
import { P } from "@medbrains/types";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import { OpdVitalsCounter } from "./vitals-counter";

const held = vi.hoisted(() => ({ codes: [] as string[] }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.codes.includes(code),
}));

const opd = vi.hoisted(() => ({
  listQueue: vi.fn(),
  createVital: vi.fn(),
  createNurseVital: vi.fn(),
}));
vi.mock("@/services/opd.service", () => ({ opdService: opd }));

const waiting = {
  id: "q-1",
  encounter_id: "enc-1",
  token_number: 412,
  token_code: "R-001",
  status: "waiting",
  has_vitals: false,
  patient_name: "Asha Example",
  uhid: "MB-00001",
} as QueueEntry;

/** Opens the counter, records a pulse for the waiting patient and saves. */
async function recordPulse() {
  render(<OpdVitalsCounter />);
  await userEvent.click(await screen.findByRole("button", { name: "vitalsCounter.record" }));
  await userEvent.type(await screen.findByTestId("vital-pulse"), "72");
  await userEvent.click(screen.getByRole("button", { name: "vitals.recordVitals" }));
}

beforeEach(() => {
  for (const fn of Object.values(opd)) fn.mockReset();
  opd.listQueue.mockResolvedValue([waiting]);
  opd.createVital.mockResolvedValue({ id: "v-1" });
  opd.createNurseVital.mockResolvedValue({ id: "v-1" });
});

describe("OPD vitals counter", () => {
  it("lets a nurse record through the nursing endpoint her role may call", async () => {
    held.codes = [P.NURSE.VITALS.RECORD];
    await recordPulse();
    await waitFor(() =>
      expect(opd.createNurseVital).toHaveBeenCalledWith({ pulse: 72, encounter_id: "enc-1" }),
    );
    expect(opd.createVital).not.toHaveBeenCalled();
  });

  it("uses the OPD endpoint for a role that holds only opd.vitals.create", async () => {
    held.codes = [P.OPD.VITALS.CREATE];
    await recordPulse();
    await waitFor(() => expect(opd.createVital).toHaveBeenCalledWith("enc-1", { pulse: 72 }));
    expect(opd.createNurseVital).not.toHaveBeenCalled();
  });

  it("shows the row but no button to a role that may not record", async () => {
    held.codes = [];
    render(<OpdVitalsCounter />);
    expect(await screen.findByText("Asha Example")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "vitalsCounter.record" })).not.toBeInTheDocument();
  });

  it("calls the patient by the token every other screen shows", async () => {
    held.codes = [];
    render(<OpdVitalsCounter />);
    expect(await screen.findByText("R-001")).toBeInTheDocument();
    expect(screen.queryByText("T412")).not.toBeInTheDocument();
  });
});
