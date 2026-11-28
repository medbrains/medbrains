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

  it("shows the server's counts and its version beside the web build's", async () => {
    held.codes = new Set([P.ADMIN.SETTINGS.GENERAL.MANAGE]);
    service.systemHealth.mockResolvedValue({
      users: 12,
      departments: 4,
      modules: 26,
      migrations_applied: 355,
      server_version: "0.0.1",
    });
    render(<SystemHealthSettings />);
    expect(await screen.findByText("355")).toBeInTheDocument();
    expect(screen.getByText(`Server v0.0.1 · Web v${__APP_VERSION__}`)).toBeInTheDocument();
    expect(screen.getByText("Different releases")).toBeInTheDocument();
  });
});
