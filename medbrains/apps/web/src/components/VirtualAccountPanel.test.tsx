import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { VirtualAccountPanel } from "./VirtualAccountPanel";

const service = vi.hoisted(() => ({ createVirtualAccount: vi.fn(), getPaymentStatus: vi.fn() }));
vi.mock("@/services/payments.service", () => ({ paymentsService: service }));

beforeEach(() => vi.clearAllMocks());

describe("VirtualAccountPanel (#4885)", () => {
  it("says the bank transfer settled once, however often the status is read", async () => {
    service.createVirtualAccount.mockResolvedValue({ transaction_id: "txn-va" });
    service.getPaymentStatus.mockResolvedValue({
      transaction: { id: "txn-va", status: "captured", notes: [] },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onSettled = vi.fn();
    render(<VirtualAccountPanel invoiceId="inv-1" amount={400} onSettled={onSettled} />, {
      queryClient: client,
    });
    await userEvent.click(screen.getByRole("button", { name: "Generate bank virtual account" }));
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
    await client.refetchQueries();
    await client.refetchQueries();
    expect(service.getPaymentStatus.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
