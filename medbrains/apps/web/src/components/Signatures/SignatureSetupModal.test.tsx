import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignWorkspace } from "@/components/Doctor/SignWorkspace";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { SignatureSetupModal } from "./SignatureSetupModal";

const mocks = vi.hoisted(() => ({
  credentials: vi.fn(),
  setMySignature: vi.fn(),
  signRecord: vi.fn(),
  online: { online: true },
}));

vi.mock("@/services/signoff.service", () => ({
  signoffService: {
    getMySignatureCredentials: mocks.credentials,
    setMySignature: mocks.setMySignature,
    signRecord: mocks.signRecord,
    reviewSignature: async () => ({
      legal_class: "clinical",
      signer_role: "primary",
      payload_snapshot: { patient: { name: "Asha Verma" } },
      payload_hash_hex: "ab12",
      generated_at: "2026-11-23T10:00:00Z",
    }),
  },
}));
vi.mock("@/services/doctor.service", () => ({
  doctorService: {
    getMyProfile: async () => ({ display_name: "Dr Meera Nair", mci_number: null }),
  },
}));
vi.mock("@mantine/hooks", async (original) => ({
  ...(await original<typeof import("@mantine/hooks")>()),
  useNetwork: () => mocks.online,
}));

const OWN = "This is my own signature and I am setting it myself.";
const save = () => screen.getByRole("button", { name: "Save signature" });
/** Choose "No image" and tick the own-signature statement. */
async function chooseNoImage() {
  await userEvent.click(await screen.findByRole("radio", { name: "No image" }));
  await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(OWN) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.online.online = true;
  mocks.credentials.mockResolvedValue([]);
  mocks.setMySignature.mockResolvedValue({ replaced: false });
  usePermissionStore
    .getState()
    .setPermissions("doctor", [
      P.DOCTOR.SIGNATURE.SIGN,
      P.DOCTOR.PROFILE.VIEW_OWN,
      P.SIGNATURES.OWN.MANAGE,
    ]);
});

describe("SignatureSetupModal", () => {
  it("opens on its title and saves only the signer's own, stated choice", async () => {
    const onClose = vi.fn();
    render(<SignatureSetupModal opened onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Set up your signature")).toHaveFocus());
    expect(await screen.findByText("Registration number missing. Ask HR to add it.")).toBeVisible();
    expect(save()).toBeDisabled();
    await chooseNoImage();
    await userEvent.click(save());
    expect(mocks.setMySignature).toHaveBeenCalledWith({ image: null });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("refuses a wrong upload on the field, naming the limit", async () => {
    render(<SignatureSetupModal opened onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("radio", { name: "Upload" }));
    const tooLarge = new File([new Uint8Array(750_001)], "scan.png", { type: "image/png" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(input as HTMLInputElement, tooLarge);
    expect(
      await screen.findByText(
        "That file was not accepted. Use a PNG, JPEG or WebP image under 750 KB.",
      ),
    ).toBeVisible();
    expect(save()).toBeDisabled();
  });

  it("keeps the form and offers Retry when the save fails", async () => {
    mocks.setMySignature.mockRejectedValueOnce(new Error("The server is not answering."));
    render(<SignatureSetupModal opened onClose={vi.fn()} />);
    await chooseNoImage();
    await userEvent.click(save());
    expect(await screen.findByText("The server is not answering.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.setMySignature).toHaveBeenCalledTimes(2);
  });

  it("does not save offline, or for a role that cannot set a signature", async () => {
    mocks.online.online = false;
    const { unmount } = render(<SignatureSetupModal opened onClose={vi.fn()} />);
    await chooseNoImage();
    expect(save()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("You are offline");
    unmount();
    mocks.online.online = true;
    usePermissionStore.getState().setPermissions("doctor", [P.DOCTOR.SIGNATURE.SIGN]);
    render(<SignatureSetupModal opened onClose={vi.fn()} />);
    await chooseNoImage();
    expect(save()).toBeDisabled();
  });
});

describe("SignWorkspace with no signature", () => {
  const target = { record_type: "prescription", record_id: "r1", patient_name: "Asha Verma" };
  const sign = () => screen.getByRole("button", { name: "Sign" });
  /** Open the review and tick the attestation. */
  async function review() {
    render(<SignWorkspace opened target={target} onClose={vi.fn()} onSigned={vi.fn()} />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /I have reviewed/ }));
  }

  it("asks for the signature at the Sign click, then signs on the same review", async () => {
    await review();
    await waitFor(() => expect(sign()).toBeEnabled());
    await userEvent.click(sign());
    expect(mocks.signRecord).not.toHaveBeenCalled();
    mocks.credentials.mockResolvedValue([{ id: "c1", is_default: true }]);
    await chooseNoImage();
    await userEvent.click(save());
    await waitFor(() =>
      expect(screen.queryByText("Set up your signature")).not.toBeInTheDocument(),
    );
    mocks.signRecord.mockResolvedValue({ signature_hex: "abcdef0123456789" });
    await userEvent.click(sign());
    await waitFor(() => expect(mocks.signRecord).toHaveBeenCalledTimes(1));
  });

  it("says the check failed, never that there is no signature", async () => {
    mocks.credentials.mockRejectedValue(new Error("503"));
    await review();
    expect(await screen.findByText("Couldn't check your signature")).toBeVisible();
    expect(screen.queryByText(/You have no signature yet/)).not.toBeInTheDocument();
    expect(sign()).toBeDisabled();
    mocks.credentials.mockResolvedValue([{ id: "c1", is_default: true }]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(sign()).toBeEnabled());
  });
});
