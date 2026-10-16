import { ApiError } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { DataTable } from "./DataTable";

const columns = [{ key: "name", label: "Name", render: (r: { id: string }) => r.id }];

function Ward({ fetchBeds }: { fetchBeds: () => Promise<{ id: string }[]> }) {
  const beds = useQuery({ queryKey: ["beds"], queryFn: fetchBeds });
  return (
    <DataTable
      columns={columns}
      data={beds.data ?? []}
      loading={beds.isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No patients on this ward"
    />
  );
}

describe("DataTable when its load fails", () => {
  it("says it did not load, never that the ward is empty, and retries", async () => {
    const fetchBeds = vi.fn().mockRejectedValue(new ApiError("boom", 500));
    render(<Ward fetchBeds={fetchBeds} />);
    expect(await screen.findByText("This didn't load")).toBeInTheDocument();
    expect(screen.queryByText("No patients on this ward")).not.toBeInTheDocument();

    fetchBeds.mockResolvedValue([{ id: "Bed 4" }]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Bed 4")).toBeInTheDocument();
  });

  it("treats a refusal as an answer, not an outage", async () => {
    render(<Ward fetchBeds={() => Promise.reject(new ApiError("forbidden", 403))} />);
    expect(await screen.findByText("No patients on this ward")).toBeInTheDocument();
  });

  it("shows the error it is given, with that query's retry", async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey={(r) => r.id}
        error={new TypeError("Failed to fetch")}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/Couldn't reach the server/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
