import { ApiError } from "@medbrains/api";
import type { Patient } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

/**
 * Undoing a merge needs access to both records. The server refuses with a 404
 * (it does not confirm a record the caller may not see), and the screen must
 * say why rather than leave the Undo button looking broken.
 */
const show = vi.fn();
let unmerge: () => Promise<unknown> = async () => ({ status: "unmerged" });

vi.mock("@mantine/notifications", () => ({ notifications: { show: (n: unknown) => show(n) } }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));
vi.mock("@/components/PatientNameCell", () => ({ PatientNameCell: () => null }));
vi.mock("@/components/PatientSearchSelect", () => ({ PatientSearchSelect: () => null }));
vi.mock("@/services/patientDetail.service", () => ({
  patientDetailService: {
    listMergeHistory: async () => [
      {
        id: "h1",
        surviving_patient_id: "p1",
        merged_patient_id: "p2",
        merge_reason: "Registered twice",
        created_at: "2026-11-19T08:00:00Z",
        unmerged_at: null,
      },
    ],
    unmergePatient: () => unmerge(),
    mergePatients: async () => ({}),
  },
}));

const { MergeTab } = await import("./merge-tab");
const patient = { id: "p1", is_merged: false } as Patient;

describe("undoing a merge", () => {
  beforeEach(() => show.mockClear());

  it("says the caller needs both records when the server refuses", async () => {
    unmerge = async () => {
      throw new ApiError("Not found", 404);
    };
    render(<MergeTab patient={patient} />);
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Not unmerged",
          message: expect.stringContaining("open both records"),
        }),
      ),
    );
  });

  it("does not blame access for any other failure", async () => {
    unmerge = async () => {
      throw new ApiError("Server error", 500);
    };
    render(<MergeTab patient={patient} />);
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ message: "The records could not be separated. Try again." }),
      ),
    );
  });
});
