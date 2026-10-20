import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { RefundsCreditsTab } from "./refunds-credits";

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));
const empty = { data: [], meta: { total: 0, limit: 50, page: 1 } };
vi.mock("@/services/billing.service", () => ({
  billingService: {
    listRefunds: vi.fn(async () => empty),
    listCreditNotes: vi.fn(async () => empty),
    listWriteOffs: vi.fn(async () => empty),
  },
}));

beforeEach(() => held.clear());

describe("raising a refund (#4885)", () => {
  it("is not offered for holding invoices.create — refunding is its own grant", () => {
    held.add("billing.invoices.create");
    render(<RefundsCreditsTab canCreate canWriteOff={false} />);
    expect(screen.queryByRole("button", { name: "Create Refund" })).not.toBeInTheDocument();
  });

  it("is offered with billing.refunds.create, the code the server requires", () => {
    held.add("billing.refunds.create");
    render(<RefundsCreditsTab canCreate={false} canWriteOff={false} />);
    expect(screen.getByRole("button", { name: "Create Refund" })).toBeInTheDocument();
  });
});
