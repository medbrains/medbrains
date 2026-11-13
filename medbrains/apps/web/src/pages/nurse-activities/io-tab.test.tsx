import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { IoTab } from "./io-tab";

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));

const service = vi.hoisted(() => ({
  listIoForEncounter: vi.fn(),
  getEncounterIoBalance: vi.fn(),
  createIoEntry: vi.fn(),
}));
vi.mock("@/services/nurseActivities.service", () => ({ nurseActivitiesService: service }));

beforeEach(() => {
  service.listIoForEncounter.mockResolvedValue([]);
  service.getEncounterIoBalance.mockResolvedValue({ intake_total: 0, output_total: 0, balance: 0 });
  service.createIoEntry.mockResolvedValue({});
});

/** Clear the volume box and type `ml` into it. */
async function typeVolume(ml: string) {
  const box = screen.getByLabelText("Volume");
  await userEvent.clear(box);
  await userEvent.type(box, ml);
}

/**
 * "Urine 0 ml this shift" is how an anuric patient or a blocked catheter is
 * charted, so a zero output can be saved; a zero intake records nothing.
 */
describe("IoTab volume", () => {
  it("refuses a zero intake but saves a zero output", async () => {
    render(<IoTab initialEncounterId="enc-1" patientId="p-1" />);
    const save = screen.getByRole("button", { name: /save entry/i });

    await typeVolume("0");
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByText("Output"));
    await typeVolume("0");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(service.createIoEntry).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "output", volume_ml: 0 }),
    );
  });
});
