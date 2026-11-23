import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { MySignatureCard } from "./MySignatureCard";

const mocks = vi.hoisted(() => ({ credentials: vi.fn() }));
vi.mock("@/services/signoff.service", () => ({
  signoffService: { getMySignatureCredentials: mocks.credentials, setMySignature: vi.fn() },
}));
vi.mock("@/services/doctor.service", () => ({
  doctorService: {
    getMyProfile: async () => ({ display_name: "Dr Meera Nair", mci_number: "TNMC 51234" }),
  },
}));

const base = { is_default: false, valid_until: null, revoked_at: null, revoked_reason: null };
const current = {
  ...base,
  id: "c3",
  is_default: true,
  valid_from: "2026-11-20T08:00:00Z",
  display_image_url: "data:image/png;base64,AAAA",
};
const replaced = {
  ...base,
  id: "c2",
  valid_from: "2026-10-01T08:00:00Z",
  valid_until: "2026-11-20T08:00:00Z",
};
const withdrawn = {
  ...base,
  id: "c1",
  valid_from: "2026-09-01T08:00:00Z",
  revoked_at: "2026-10-01T08:00:00Z",
  revoked_reason: "Reported copied",
};
const day = (iso: string) => new Date(iso).toLocaleDateString();

beforeEach(() => {
  vi.clearAllMocks();
  usePermissionStore
    .getState()
    .setPermissions("doctor", [
      P.DOCTOR.SIGNATURE.SIGN,
      P.DOCTOR.PROFILE.VIEW_OWN,
      P.SIGNATURES.OWN.MANAGE,
    ]);
});

describe("MySignatureCard", () => {
  it("shows the current signature, when it was set, and how each earlier one ended", async () => {
    mocks.credentials.mockResolvedValue([current, replaced, withdrawn]);
    render(<MySignatureCard />);
    expect(await screen.findByRole("img", { name: "Your signature" })).toBeVisible();
    expect(screen.getByText(`Set on ${day(current.valid_from)}`)).toBeVisible();
    expect(
      screen.getByText(`${day(replaced.valid_from)} to ${day(replaced.valid_until)}: replaced`),
    ).toBeVisible();
    expect(screen.getByText(/withdrawn \(Reported copied\)$/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(
      await screen.findByRole("dialog", { name: "Replace your signature" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Records you already signed keep the signature/)).toBeInTheDocument();
  });

  it("offers Set up when there is none, and nothing to change without the permission", async () => {
    mocks.credentials.mockResolvedValue([]);
    const { unmount } = render(<MySignatureCard />);
    expect(await screen.findByRole("button", { name: "Set up" })).toBeVisible();
    unmount();
    usePermissionStore.getState().setPermissions("doctor", [P.DOCTOR.SIGNATURE.SIGN]);
    render(<MySignatureCard />);
    expect(await screen.findByText(/You have no signature yet/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Set up" })).not.toBeInTheDocument();
  });

  it("says the check failed, with Retry, and never that there is no signature", async () => {
    mocks.credentials.mockRejectedValue(new Error("503"));
    render(<MySignatureCard />);
    expect(await screen.findByText("Couldn't check your signature")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Set up" })).not.toBeInTheDocument();
    expect(screen.queryByText(/You have no signature yet/)).not.toBeInTheDocument();
  });
});
