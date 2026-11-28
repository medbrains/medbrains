import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-utils";
import { VerifyPackPage } from "./verify-view";

const guard = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: guard }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => false,
}));

describe("Pharmacy → check a pack", () => {
  it("sends anyone without pharmacy.fulfilment.verify to the access-denied screen", () => {
    render(<VerifyPackPage />);
    expect(guard).toHaveBeenCalledWith("pharmacy.fulfilment.verify");
  });
});
