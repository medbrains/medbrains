import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The header shows the hospital's emblem and name banner when they are set,
 * either alone, and nothing (not an empty box) when neither is, when the read
 * fails, or when the user may not read them; it never fetches without the
 * permission.
 */
let canView = true;
const getBrandingMarks = vi.fn();

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => canView,
}));
vi.mock("@/services/branding.service", () => ({ brandingService: { getBrandingMarks } }));

const { HospitalMarks } = await import("./HospitalMarks");
const EMBLEM = "data:image/png;base64,AAAA";
const BANNER = "data:image/webp;base64,BBBB";

/** Answers the marks read with these marks. */
function marks(emblem: string | null, name_banner: string | null) {
  getBrandingMarks.mockResolvedValue({ display_name: "Example Care Centre", emblem, name_banner });
}

describe("HospitalMarks", () => {
  beforeEach(() => {
    canView = true;
    getBrandingMarks.mockReset();
  });

  it("shows the emblem, then the name banner", async () => {
    marks(EMBLEM, BANNER);
    render(<HospitalMarks />);
    expect(await screen.findByAltText("Example Care Centre emblem")).toHaveAttribute("src", EMBLEM);
    expect(screen.getByAltText("Example Care Centre")).toHaveAttribute("src", BANNER);
  });

  it("names the emblem as the hospital when it is shown alone", async () => {
    marks(EMBLEM, null);
    render(<HospitalMarks />);
    expect(await screen.findByAltText("Example Care Centre")).toHaveAttribute("src", EMBLEM);
  });

  it("shows the banner alone when there is no emblem", async () => {
    marks(null, BANNER);
    render(<HospitalMarks />);
    expect(await screen.findByAltText("Example Care Centre")).toHaveAttribute("src", BANNER);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("renders nothing when neither mark is set", async () => {
    marks(null, null);
    const { container } = render(<HospitalMarks />);
    await vi.waitFor(() => expect(getBrandingMarks).toHaveBeenCalled());
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing, and reads once, when the read fails", async () => {
    getBrandingMarks.mockRejectedValue(new Error("down"));
    const { container } = render(<HospitalMarks />);
    await vi.waitFor(() => expect(getBrandingMarks).toHaveBeenCalledTimes(1));
    expect(container.querySelector("img")).toBeNull();
  });

  it("does not fetch without branding.view", () => {
    canView = false;
    render(<HospitalMarks />);
    expect(getBrandingMarks).not.toHaveBeenCalled();
  });
});
