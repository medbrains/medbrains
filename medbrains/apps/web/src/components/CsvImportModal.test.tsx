import type { CsvImportRequest, UserImportResult } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { CsvImportModal } from "./CsvImportModal";

const csv = "username,full_name\nasha,Asha R\nbala,Bala K\nchitra,Chitra M\n";

/** Answers each batch with a one-time password per row, failing from batch `failAt`. */
function importer(failAt: number) {
  let batch = 0;
  return vi.fn(async (req: CsvImportRequest): Promise<UserImportResult> => {
    batch += 1;
    if (batch >= failAt) throw new Error("server down");
    return {
      imported: req.rows.length,
      skipped: 0,
      errors: [],
      one_time_passwords: req.rows.map((r) => ({
        username: r.values[0] ?? "",
        password: `otp-${r.values[0]}`,
      })),
    };
  });
}

/** Opens the modal and uploads the three-row file. */
async function upload(onImport: ReturnType<typeof importer>) {
  render(
    <CsvImportModal
      opened
      onClose={() => {}}
      title="Import users"
      requiredColumns={["username"]}
      onImport={onImport}
      chunkSize={2}
    />,
  );
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, new File([csv], "users.csv", { type: "text/csv" }));
  await userEvent.click(await screen.findByRole("button", { name: "Import 3 rows" }));
}

describe("importing users from a CSV", () => {
  it("shows every one-time password once, since it is shown nowhere else", async () => {
    const onImport = importer(99);
    await upload(onImport);
    const table = await screen.findByRole("table", { name: "One-time passwords" });
    expect(within(table).getByText("otp-chitra")).toBeInTheDocument();
    expect(onImport).toHaveBeenCalledTimes(2);
  });

  it("keeps the passwords of batches already saved when a later batch fails", async () => {
    await upload(importer(2));
    const table = await screen.findByRole("table", { name: "One-time passwords" });
    expect(within(table).getByText("otp-asha")).toBeInTheDocument();
    expect(within(table).getByText("otp-bala")).toBeInTheDocument();
    expect(within(table).queryByText("otp-chitra")).toBeNull();
  });
});
