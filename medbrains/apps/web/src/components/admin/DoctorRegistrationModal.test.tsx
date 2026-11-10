import type { DoctorProfile } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { DoctorRegistrationModal } from "./DoctorRegistrationModal";

const service = vi.hoisted(() => ({ updateDoctor: vi.fn() }));
vi.mock("@/services/adminDoctors.service", () => ({ adminDoctorsService: service }));

/** A profile as the users trigger creates it: name and specialty, no registration. */
const autoCreated = {
  id: "doc-1",
  display_name: "Arjun Mehta",
  qualification_string: null,
  mci_number: null,
  state_council_number: null,
  state_council_name: null,
  registration_valid_until: null,
  subspecialty: "General Medicine",
} as DoctorProfile;

describe("DoctorRegistrationModal", () => {
  it("saves the registration the admin typed and leaves untouched fields as they are", async () => {
    service.updateDoctor.mockResolvedValue({ ...autoCreated, mci_number: "NMC-12345" });
    const onClose = vi.fn();
    render(<DoctorRegistrationModal doctor={autoCreated} onClose={onClose} />);

    expect(screen.getByLabelText("Specialty / unit")).toHaveValue("General Medicine");
    await userEvent.type(screen.getByLabelText("NMC / MCI number"), "NMC-12345");
    await userEvent.type(screen.getByLabelText("State council name"), "Tamil Nadu Medical Council");
    await userEvent.click(screen.getByRole("button", { name: "Save registration" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(service.updateDoctor).toHaveBeenCalledWith("doc-1", {
      qualification_string: null,
      mci_number: "NMC-12345",
      state_council_number: null,
      state_council_name: "Tamil Nadu Medical Council",
      registration_valid_until: null,
      subspecialty: "General Medicine",
    });
  });
});
