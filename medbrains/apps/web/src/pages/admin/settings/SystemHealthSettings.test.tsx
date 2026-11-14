import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { SystemHealthSettings } from "./SystemHealthSettings";

const service = vi.hoisted(() => ({
  listBackups: vi.fn(),
  completenessCheck: vi.fn(),
  systemHealth: vi.fn(),
}));
vi.mock("@/services/settingsSetup.service", () => ({ settingsSetupService: service }));

const held = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.codes.has(code),
}));

describe("SystemHealthSettings", () => {
  beforeEach(() => {
    for (const fn of Object.values(service)) fn.mockReset().mockResolvedValue([]);
  });

  it("shows a backup-only holder the backup card and asks for nothing else", async () => {
    held.codes = new Set([P.ADMIN.BACKUP_MANAGE]);
    render(<SystemHealthSettings />);
    expect(await screen.findByText("Database backups")).toBeInTheDocument();
    expect(screen.queryByText("Setup Completeness")).not.toBeInTheDocument();
    expect(service.completenessCheck).not.toHaveBeenCalled();
    expect(service.systemHealth).not.toHaveBeenCalled();
  });

  it("shows a settings manager the whole page", async () => {
    held.codes = new Set([P.ADMIN.SETTINGS.GENERAL.MANAGE]);
    render(<SystemHealthSettings />);
    expect(await screen.findByText("Setup Completeness")).toBeInTheDocument();
    expect(service.completenessCheck).toHaveBeenCalled();
  });
});
