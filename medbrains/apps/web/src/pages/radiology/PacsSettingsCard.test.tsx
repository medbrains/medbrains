import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { PacsSettingsCard } from "./PacsSettingsCard";

const service = vi.hoisted(() => ({
  getRadiologyPacsConfig: vi.fn(),
  updateRadiologyPacsConfig: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const held = vi.hoisted(() => new Set<string>(["radiology.modalities.manage"]));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const SAVED = {
  orthanc_url: "http://10.0.0.5:8042",
  orthanc_username: "medbrains",
  password_set: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  held.clear();
  held.add("radiology.modalities.manage");
  service.getRadiologyPacsConfig.mockResolvedValue(SAVED);
  service.updateRadiologyPacsConfig.mockResolvedValue(SAVED);
});

async function shown() {
  render(<PacsSettingsCard />);
  await screen.findByDisplayValue(SAVED.orthanc_url);
}

describe("PacsSettingsCard", () => {
  it("keeps the saved password when only other settings are saved", async () => {
    await shown();
    expect(screen.getByText("A password is saved. Leave blank to keep it.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(service.updateRadiologyPacsConfig).toHaveBeenCalledTimes(1));
    expect(service.updateRadiologyPacsConfig.mock.calls[0]?.[0]).not.toHaveProperty(
      "orthanc_password",
    );
  });

  it("asks for the password again when the address changes", async () => {
    await shown();
    const address = screen.getByLabelText("PACS address");
    await userEvent.clear(address);
    await userEvent.type(address, "http://10.0.0.9:8042");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Enter the password again: a new address or username needs it"),
    ).toBeInTheDocument();
    expect(service.updateRadiologyPacsConfig).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Password"), "n3w-secret");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(service.updateRadiologyPacsConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          orthanc_url: "http://10.0.0.9:8042",
          orthanc_password: "n3w-secret",
        }),
      ),
    );
  });

  it("offers no password field to someone who cannot manage modalities", async () => {
    held.clear();
    await shown();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
