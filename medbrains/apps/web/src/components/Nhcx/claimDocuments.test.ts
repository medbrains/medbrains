import type { NhcxClaimDocument, PatientDocument } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { claimPicks, formatBytes, picksTotalBytes } from "./claimDocuments";

const rendered = (id: string, size: number): NhcxClaimDocument => ({
  kind: "lab_report",
  source: "rendered",
  id,
  title: id,
  mime_type: "application/pdf",
  size_bytes: size,
  created_at: "2026-10-19T00:00:00Z",
  preview_url: `/api/documents/${id}/download`,
});

const stored = (id: string, size: number | null): PatientDocument => ({
  id,
  tenant_id: "t",
  patient_id: "p",
  document_type: "referral",
  document_name: id,
  file_url: `k/${id}`,
  file_size: size,
  mime_type: "application/pdf",
  uploaded_by: null,
  notes: null,
  created_at: "2026-10-19T00:00:00Z",
});

describe("claimPicks", () => {
  it("sends every prepared document the desk did not untick, then its additions once", () => {
    const picks = claimPicks([rendered("ds", 10), rendered("lab", 20)], new Set(["rendered:lab"]), [
      stored("scan", 5),
      stored("scan", 5),
    ]);
    expect(picks).toEqual([
      { source: "rendered", id: "ds" },
      { source: "stored", id: "scan" },
    ]);
  });
});

describe("picksTotalBytes", () => {
  it("adds only what is ticked, and an unknown size as nothing", () => {
    const total = picksTotalBytes(
      [rendered("ds", 1000), rendered("lab", 2000)],
      new Set(["rendered:lab"]),
      [stored("scan", 500), stored("old", null)],
    );
    expect(total).toBe(1500);
  });
});

describe("formatBytes", () => {
  it("reads in KB below a megabyte and says when a size is unknown", () => {
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(null)).toBe("size unknown");
  });
});
