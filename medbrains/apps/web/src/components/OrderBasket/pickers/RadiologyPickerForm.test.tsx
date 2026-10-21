import { usePermissionStore } from "@medbrains/stores";
import type { RadiologyExamListItem, RadiologyModality } from "@medbrains/types";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { RadiologyPickerForm } from "./RadiologyPickerForm";

const service = vi.hoisted(() => ({
  listRadiologyModalities: vi.fn(),
  listRadiologyExams: vi.fn(),
}));
vi.mock("@/services/clinicalSupport.service", () => ({ clinicalSupportService: service }));

const MODALITIES = [
  { id: "mod-ct", code: "CT", name: "CT", is_active: true },
  { id: "mod-us", code: "US", name: "Ultrasound", is_active: true },
] as RadiologyModality[];

const USG_ABDOMEN = {
  id: "exam-usg",
  modality_id: "mod-us",
  modality_code: "US",
  modality_name: "Ultrasound",
  code: "US-ABD",
  name: "Ultrasound abdomen",
  body_part: "Abdomen",
  laterality_required: false,
  contrast: "none",
  preparation: "Fast for 6 hours. Water is allowed.",
} as RadiologyExamListItem;

describe("RadiologyPickerForm", () => {
  beforeEach(() => {
    usePermissionStore.getState().setPermissions("doctor", [P.RADIOLOGY.ORDERS_CREATE]);
    service.listRadiologyModalities.mockResolvedValue(MODALITIES);
    service.listRadiologyExams.mockResolvedValue([USG_ABDOMEN]);
  });

  // Given no modality picked, When the doctor searches an exam and picks it,
  // Then the order carries that exam's modality and its preparation shows.
  it("orders by exam alone: the exam decides the modality", async () => {
    const onAdd = vi.fn();
    render(<RadiologyPickerForm onAdd={onAdd} />);

    await userEvent.type(screen.getByRole("textbox", { name: /exam/i }), "abdomen");
    await userEvent.click(await screen.findByText(/Ultrasound abdomen/));

    expect(service.listRadiologyExams).toHaveBeenCalledWith(
      expect.objectContaining({ modality_id: undefined }),
    );
    expect(await screen.findByText(/Fast for 6 hours/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ modality_id: "mod-us", exam_id: "exam-usg" }),
      ),
    );
  });
});
