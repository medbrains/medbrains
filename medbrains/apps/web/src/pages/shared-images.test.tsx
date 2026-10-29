import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { SharedImagesPage } from "./shared-images";

const service = vi.hoisted(() => ({
  getPublicShareLink: vi.fn(),
  sendShareLinkCode: vi.fn(),
  verifyShareLinkCode: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useParams: () => ({ token: "tok" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  service.getPublicShareLink.mockResolvedValue({
    recipient_name: "Dr Rao",
    recipient_kind: "clinician",
    code_sent_to: "98•••••210",
    deidentified: true,
    expires_at: "2099-01-01T00:00:00Z",
  });
  service.sendShareLinkCode.mockResolvedValue({ sent_to: "98•••••210" });
});

describe("SharedImagesPage", () => {
  it("opens the viewer only after the code, and shows nothing about the patient first", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    service.verifyShareLinkCode.mockResolvedValue({ viewer_url: "/api/public/x/ohif/viewer" });
    render(<SharedImagesPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: /Send my code to 98•••••210/ }),
    );
    const open = screen.getByRole("button", { name: "Open images" });
    expect(open).toBeDisabled();
    expect(screen.getByText("De-identified")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Code"), "12a3456");
    await userEvent.click(open);
    await waitFor(() => expect(service.verifyShareLinkCode).toHaveBeenCalledWith("tok", "123456"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/api/public/x/ohif/viewer"));
    vi.unstubAllGlobals();
  });

  it("says a dead link no longer opens", async () => {
    service.getPublicShareLink.mockRejectedValue(new Error("not found"));
    render(<SharedImagesPage />);
    expect(await screen.findByText("This link no longer opens")).toBeInTheDocument();
  });
});
