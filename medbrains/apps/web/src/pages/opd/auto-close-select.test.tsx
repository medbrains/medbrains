import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import { autoCloseOptions } from "./auto-close-select";
import { queueStatusLabel } from "./shared";

/**
 * The OPD auto-close setting and the label a visit closed by it carries.
 * At a hospital whose doctors never press "complete", the setting closes started
 * visits for them, and the queue must say so rather than "Completed".
 */
const getOpdAutoClose = vi.fn(async () => ({ after_minutes: 60 as number | null }));
const updateOpdAutoClose = vi.fn(async (data: { after_minutes: number | null }) => data);

vi.mock("@/services/opd.service", () => ({
  opdService: {
    getOpdAutoClose: () => getOpdAutoClose(),
    updateOpdAutoClose: (data: { after_minutes: number | null }) => updateOpdAutoClose(data),
  },
}));
let canManage = true;
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => canManage,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === "string"
        ? fallback
        : ((fallback as { defaultValue?: string } | undefined)?.defaultValue ?? key),
  }),
}));

const { OpdAutoCloseSelect } = await import("./auto-close-select");
const t = ((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key) as never;

describe("OpdAutoCloseSelect", () => {
  it("shows the hospital's setting", async () => {
    render(<OpdAutoCloseSelect />);
    const [field] = await screen.findAllByLabelText("Close OPD visits automatically after");
    await waitFor(() => expect(field).toHaveValue("60 minutes"));
  });

  it("is not shown, and not fetched, without the settings permission", () => {
    canManage = false;
    getOpdAutoClose.mockClear();
    render(<OpdAutoCloseSelect />);
    expect(screen.queryAllByLabelText("Close OPD visits automatically after")).toHaveLength(0);
    expect(getOpdAutoClose).not.toHaveBeenCalled();
    canManage = true;
  });

  it("keeps a stored value that is not a preset", () => {
    const options = autoCloseOptions(75, (n) => `${n} minutes`, "Off");
    expect(options[0]).toEqual({ value: "0", label: "Off" });
    expect(options.map((o) => o.value)).toContain("75");
  });
});

describe("queueStatusLabel", () => {
  it("says a visit OPD closed on its own was closed automatically", () => {
    expect(queueStatusLabel(t, "completed", "auto_inactivity")).toBe("Closed automatically");
    expect(queueStatusLabel(t, "completed", null)).toBe("completed");
    expect(queueStatusLabel(t, "waiting", "auto_inactivity")).toBe("waiting");
  });
});
