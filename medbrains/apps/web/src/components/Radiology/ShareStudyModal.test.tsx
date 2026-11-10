import type { StudyShareLink } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ShareStudyModal } from "./ShareStudyModal";
import { StudyImageActions } from "./StudyImageActions";

const service = vi.hoisted(() => ({
  listStudyShareLinks: vi.fn(),
  createRadiologyShareLink: vi.fn(),
  revokeStudyShareLink: vi.fn(),
  openStudyViewer: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const OPENED: StudyShareLink = {
  id: "l1",
  recipient_kind: "clinician",
  recipient_name: "Dr Rao, City Hospital",
  recipient_email: null,
  deidentify: true,
  expires_at: "2099-01-01T00:00:00Z",
  accessed_count: 2,
  last_accessed: "2026-10-26T10:00:00Z",
  created_at: "2026-10-25T10:00:00Z",
  revoked_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  held.clear();
  service.listStudyShareLinks.mockResolvedValue([OPENED]);
  service.createRadiologyShareLink.mockResolvedValue({
    id: "l2",
    share_url: "/shared-images/tok",
    expires_at: "2099-01-01T00:00:00Z",
  });
  service.revokeStudyShareLink.mockResolvedValue({ revoked: true });
});

describe("ShareStudyModal", () => {
  it("needs somewhere to send a clinician's code, and lasts a day by default", async () => {
    render(<ShareStudyModal studyId="s1" onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/^For/), "Dr Mehta");
    await userEvent.click(screen.getByRole("button", { name: "Make link" }));
    expect(
      await screen.findByText("A phone or email: the images open only with a code sent there"),
    ).toBeInTheDocument();
    expect(service.createRadiologyShareLink).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Their mobile"), "+91 98450 12210");
    await userEvent.click(screen.getByRole("switch", { name: /De-identify/ }));
    expect(screen.getByText(/burned into an image/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Make link" }));
    await waitFor(() =>
      expect(service.createRadiologyShareLink).toHaveBeenCalledWith({
        study_id: "s1",
        recipient_kind: "clinician",
        recipient_name: "Dr Mehta",
        recipient_phone: "+91 98450 12210",
        deidentify: true,
        expires_hours: 24,
      }),
    );
    expect(await screen.findByText(/\/shared-images\/tok/)).toBeInTheDocument();
  });

  it("sends the patient's own code to the number on their record", async () => {
    render(<ShareStudyModal studyId="s1" onClose={() => {}} />);
    await userEvent.click(screen.getByText("The patient"));
    expect(screen.queryByLabelText("Their mobile")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("7 days"));
    await userEvent.click(screen.getByRole("button", { name: "Make link" }));
    await waitFor(() =>
      expect(service.createRadiologyShareLink).toHaveBeenCalledWith({
        study_id: "s1",
        recipient_kind: "patient",
        expires_hours: 168,
      }),
    );
  });

  it("shows who opened a link and revokes it", async () => {
    render(<ShareStudyModal studyId="s1" onClose={() => {}} />);
    expect(await screen.findByText("Dr Rao, City Hospital")).toBeInTheDocument();
    expect(screen.getByText(/^2× · last/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(service.revokeStudyShareLink).toHaveBeenCalledWith("l1"));
  });
});

describe("StudyImageActions", () => {
  it("offers nothing to someone who cannot read imaging orders", () => {
    render(<StudyImageActions studyId="s1" />);
    expect(screen.queryByRole("button", { name: "View images" })).not.toBeInTheDocument();
  });

  it("offers sharing only with the share permission", () => {
    held.add("radiology.orders.view");
    const { unmount } = render(<StudyImageActions studyId="s1" />);
    expect(screen.getByRole("button", { name: "View images" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    unmount();
    held.add("radiology.studies.share");
    render(<StudyImageActions studyId="s1" />);
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("opens the viewer the server returns, after it records the open", async () => {
    held.add("radiology.orders.view");
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    service.openStudyViewer.mockResolvedValue({
      viewer_url: "/api/radiology/pacs/ohif/viewer?StudyInstanceUIDs=1.2.3",
    });
    render(<StudyImageActions studyId="s1" />);
    await userEvent.click(screen.getByRole("button", { name: "View images" }));
    await waitFor(() =>
      expect(tab.location.href).toBe("/api/radiology/pacs/ohif/viewer?StudyInstanceUIDs=1.2.3"),
    );
    expect(tab.opener).toBeNull();
  });
});
