import { IconInbox } from "@tabler/icons-react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and icon", () => {
    render(<EmptyState icon={<IconInbox size={32} />} title="No records found" />);
    expect(screen.getByText("No records found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState
        icon={<IconInbox size={32} />}
        title="Empty"
        description="Try adjusting your filters"
      />,
    );
    expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<EmptyState icon={<IconInbox size={32} />} title="No data" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.queryByText("Some description text")).not.toBeInTheDocument();
  });

  it("renders action button and handles click", async () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={<IconInbox size={32} />}
        title="Empty"
        action={{ label: "Add New", onClick: handleClick }}
      />,
    );
    const button = screen.getByRole("button", { name: "Add New" });
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
