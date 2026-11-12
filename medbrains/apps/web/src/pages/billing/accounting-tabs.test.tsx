import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { BankReconTab, ConcessionsTab, GstTdsTab, JournalEntriesTab } from "./accounting-tabs";

const held = vi.hoisted(() => ({ permissions: new Set<string>() }));
const billing = vi.hoisted(() => ({
  listGstrSummaries: vi.fn(),
  generateGstrSummary: vi.fn(),
  fileGstr: vi.fn(),
  listTdsDeductions: vi.fn(),
  createTdsDeduction: vi.fn(),
  depositTds: vi.fn(),
  issueTdsCertificate: vi.fn(),
  reportHsnSummary: vi.fn(),
  listJournalEntries: vi.fn(),
  listGlAccounts: vi.fn(),
  createJournalEntry: vi.fn(),
  postJournalEntry: vi.fn(),
  reverseJournalEntry: vi.fn(),
  listBankTransactions: vi.fn(),
  importBankTransactions: vi.fn(),
  autoReconcile: vi.fn(),
  autoMatchBankTransactions: vi.fn(),
  listInsuranceReceivablesAging: vi.fn(),
  listConcessions: vi.fn(),
  getAutoConcessionRules: vi.fn(),
  approveConcession: vi.fn(),
  rejectConcession: vi.fn(),
}));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
}));
vi.mock("@/services/billing.service", () => ({ billingService: billing }));

/** Render with a query cache that swallows the expected read failures. */
function renderTab(ui: React.ReactElement) {
  return render(ui, {
    queryClient: new QueryClient({
      queryCache: new QueryCache({ onError: () => {} }),
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    }),
  });
}

const gstr = (id: string, status: string) => ({
  id,
  return_type: "GSTR-1",
  period: "2026-10",
  filing_status: status,
  total_taxable: 1000,
  total_cgst: 90,
  total_sgst: 90,
  total_igst: 0,
});

const entry = (id: string, status: string) => ({
  id,
  entry_number: `JE-${id}`,
  entry_date: "2026-11-01",
  entry_type: "manual",
  status,
  total_debit: 500,
  total_credit: 500,
  description: `Entry ${id}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  held.permissions = new Set();
  billing.listInsuranceReceivablesAging.mockResolvedValue([]);
});

describe("GstTdsTab", () => {
  it("files only a validated return, and only for a user who manages GST returns", async () => {
    billing.listGstrSummaries.mockResolvedValue([gstr("g1", "validated"), gstr("g2", "filed")]);
    billing.fileGstr.mockResolvedValue({});
    held.permissions = new Set(["billing.gst_returns.manage"]);
    renderTab(<GstTdsTab canTds={false} />);
    const file = await screen.findAllByRole("button", { name: "File" });
    expect(file).toHaveLength(1);
    await userEvent.click(file[0] as HTMLElement);
    await waitFor(() => expect(billing.fileGstr).toHaveBeenCalledWith("g1"));
    expect(screen.getByRole("button", { name: /Generate/ })).toBeInTheDocument();
  });

  it("offers neither File nor Generate to a reader, and hides TDS without canTds", async () => {
    billing.listGstrSummaries.mockResolvedValue([gstr("g1", "validated")]);
    renderTab(<GstTdsTab canTds={false} />);
    expect(await screen.findByText("2026-10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "File" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate/ })).toBeNull();
    expect(screen.queryByText("TDS Management")).toBeNull();
  });

  it("shows a failed read with a retry, never as no returns", async () => {
    billing.listGstrSummaries.mockRejectedValue(new Error("502"));
    renderTab(<GstTdsTab canTds={false} />);
    expect(await screen.findByRole("button", { name: /Retry/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(billing.listGstrSummaries).toHaveBeenCalledTimes(2));
  });

  it("lists TDS deductions for a user with canTds", async () => {
    billing.listGstrSummaries.mockResolvedValue([]);
    billing.listTdsDeductions.mockResolvedValue([
      {
        id: "t1",
        deductee_name: "Dr Visiting",
        deductee_pan: "ABCDE1234F",
        tds_section: "194J",
        tds_rate: 10,
        base_amount: 10000,
        tds_amount: 1000,
        status: "deducted",
        deducted_date: "2026-11-12",
        financial_year: "2026-27",
        quarter: "Q3",
      },
    ]);
    renderTab(<GstTdsTab canTds />);
    await userEvent.click(await screen.findByText("TDS Management"));
    expect(await screen.findByText("Dr Visiting")).toBeInTheDocument();
  });
});

describe("JournalEntriesTab", () => {
  it("posts a draft and reverses a posted entry for a user with billing.journal.post", async () => {
    billing.listJournalEntries.mockResolvedValue([entry("1", "draft"), entry("2", "posted")]);
    billing.postJournalEntry.mockResolvedValue({});
    billing.reverseJournalEntry.mockResolvedValue({});
    held.permissions = new Set(["billing.journal.post"]);
    renderTab(<JournalEntriesTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Post to ledger" }));
    await waitFor(() => expect(billing.postJournalEntry).toHaveBeenCalledWith("1"));
    await userEvent.click(screen.getByRole("button", { name: "Reverse entry" }));
    await waitFor(() => expect(billing.reverseJournalEntry).toHaveBeenCalledWith("2"));
    expect(screen.getAllByRole("button", { name: "Post to ledger" })).toHaveLength(1);
  });

  it("offers no ledger actions without billing.journal.post", async () => {
    billing.listJournalEntries.mockResolvedValue([entry("1", "draft"), entry("2", "posted")]);
    renderTab(<JournalEntriesTab />);
    expect(await screen.findByText("Entry 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post to ledger" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reverse entry" })).toBeNull();
  });

  it("shows a failed read with a retry, never as no entries", async () => {
    billing.listJournalEntries.mockRejectedValue(new Error("502"));
    renderTab(<JournalEntriesTab />);
    expect(await screen.findByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });
});

describe("BankReconTab", () => {
  const txn = (id: string, status: string) => ({
    id,
    bank_name: "Test Bank",
    account_number: "000111",
    transaction_date: "2026-11-01",
    description: `Line ${id}`,
    debit_amount: 0,
    credit_amount: 500,
    reference_number: null,
    recon_status: status,
  });

  it("runs auto-reconcile for a user who manages reconciliation", async () => {
    billing.listBankTransactions.mockResolvedValue([txn("b1", "unmatched")]);
    billing.autoReconcile.mockResolvedValue({ matched_count: 1, unmatched_count: 0 });
    held.permissions = new Set(["billing.bank_recon.manage"]);
    renderTab(<BankReconTab />);
    await userEvent.click(await screen.findByRole("button", { name: /Auto-Reconcile/ }));
    await waitFor(() => expect(billing.autoReconcile).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Import Transactions/ })).toBeInTheDocument();
  });

  it("is read-only without billing.bank_recon.manage", async () => {
    billing.listBankTransactions.mockResolvedValue([txn("b1", "discrepancy")]);
    renderTab(<BankReconTab />);
    expect(await screen.findByText("discrepancy")).toBeInTheDocument();
    for (const name of [/Auto-Reconcile/, /TPA Auto-match/, /Import Transactions/]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("shows a failed read with a retry, never as no transactions", async () => {
    billing.listBankTransactions.mockRejectedValue(new Error("502"));
    renderTab(<BankReconTab />);
    expect(await screen.findByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });
});

describe("ConcessionsTab", () => {
  const concession = (id: string, status: string) => ({
    id,
    concession_type: "staff",
    original_amount: "1000",
    concession_amount: "100",
    final_amount: "900",
    status,
    reason: `Reason ${id}`,
    auto_rule: null,
    source_module: null,
    created_at: "2026-11-01T10:00:00Z",
  });

  it("lets an approver approve or reject only a pending concession", async () => {
    billing.listConcessions.mockResolvedValue({
      concessions: [concession("c1", "pending"), concession("c2", "approved")],
      total: 2,
    });
    billing.approveConcession.mockResolvedValue({});
    billing.rejectConcession.mockResolvedValue({});
    renderTab(<ConcessionsTab canApprove />);
    expect(await screen.findByText("Reason c1")).toBeInTheDocument();
    const approve = screen.getAllByRole("button", { name: "Approve" });
    expect(approve).toHaveLength(1);
    await userEvent.click(approve[0] as HTMLElement);
    await waitFor(() => expect(billing.approveConcession).toHaveBeenCalledWith("c1"));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(billing.rejectConcession).toHaveBeenCalledWith("c1"));
  });

  it("gives a non-approver no decision and no New concession without the create code", async () => {
    billing.listConcessions.mockResolvedValue({
      concessions: [concession("c1", "pending")],
      total: 1,
    });
    renderTab(<ConcessionsTab canApprove={false} />);
    expect(await screen.findByText("Reason c1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: /New concession/ })).toBeNull();
  });
});
