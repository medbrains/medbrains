import type { BackupHistory } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { BackupStatusCard } from "./BackupStatusCard";

const service = vi.hoisted(() => ({ listBackups: vi.fn() }));
vi.mock("@/services/settingsSetup.service", () => ({ settingsSetupService: service }));

const held = vi.hoisted(() => ({ backup: true }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => held.backup,
}));

const HOUR = 3_600_000;
function row(status: string, hoursAgo: number, extra: Partial<BackupHistory> = {}): BackupHistory {
  const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  return {
    id: `${status}-${hoursAgo}`,
    tenant_id: null,
    backup_type: "pg_dump",
    backup_name: "s3://bkt/pg-backups/host/x.dump.age",
    file_path: "s3://bkt/pg-backups/host/x.dump.age",
    file_size_bytes: 62_914_560,
    status,
    started_at: at,
    completed_at: at,
    verification_at: null,
    retention_days: 31,
    expires_at: null,
    error_message: null,
    created_at: at,
    ...extra,
  };
}

describe("BackupStatusCard", () => {
  beforeEach(() => {
    held.backup = true;
    service.listBackups.mockReset();
  });

  it("is up to date when the last good backup is under 26 hours old", async () => {
    service.listBackups.mockResolvedValue([row("completed", 3)]);
    render(<BackupStatusCard />);
    expect(await screen.findByText("Up to date")).toBeInTheDocument();
    expect(screen.getByText(/Last good backup 3 h ago/)).toBeInTheDocument();
    expect(screen.getByText(/60\.0 MB/)).toBeInTheDocument();
  });

  it("is overdue past 26 hours, even with older successes", async () => {
    service.listBackups.mockResolvedValue([row("completed", 27), row("completed", 51)]);
    render(<BackupStatusCard />);
    expect(await screen.findByText("Overdue")).toBeInTheDocument();
  });

  it("shows a failure newer than the last success", async () => {
    service.listBackups.mockResolvedValue([
      row("failed", 1, { error_message: "exit 1 — journalctl -u medbrains-pg-backup" }),
      row("completed", 25),
    ]);
    render(<BackupStatusCard />);
    expect(await screen.findByText("The latest run failed")).toBeInTheDocument();
    expect(screen.getByText(/journalctl -u medbrains-pg-backup/)).toBeInTheDocument();
  });

  it("calls a history with no success overdue, not fine", async () => {
    service.listBackups.mockResolvedValue([]);
    render(<BackupStatusCard />);
    expect(await screen.findByText("No successful backup recorded")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("says an outage is unknown, never that there are no backups", async () => {
    service.listBackups.mockRejectedValue(new Error("503"));
    render(<BackupStatusCard />);
    expect(await screen.findByText("Backup status could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No successful backup recorded")).not.toBeInTheDocument();
  });

  it("neither renders nor fetches without admin.backup.manage", () => {
    held.backup = false;
    render(<BackupStatusCard />);
    expect(screen.queryByText("Database backups")).not.toBeInTheDocument();
    expect(service.listBackups).not.toHaveBeenCalled();
  });
});
