import { ApiError } from "@medbrains/api";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DepartmentSelect } from "./DepartmentSelect";

const service = vi.hoisted(() => ({ listDepartments: vi.fn() }));
vi.mock("@/services/lookups.service", () => ({ lookupsService: service }));

describe("the department picker", () => {
  it("says the list was refused, instead of offering no departments", async () => {
    service.listDepartments.mockRejectedValue(new ApiError("forbidden", 403));
    const queryClient = new QueryClient({
      queryCache: new QueryCache({ onError: () => {} }),
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(<DepartmentSelect value="" onChange={() => {}} label="Ward" />, { queryClient });
    expect(
      await screen.findByText(
        "Departments did not load. You don't have access to this. Ask your administrator.",
      ),
    ).toBeInTheDocument();
  });
});
