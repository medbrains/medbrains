import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EMBLEM_BOX } from "@/lib/image/brand-mark";
import { render, screen } from "@/test/test-utils";
import { BrandMarkField } from "./BrandMarkField";

/** The Branding screen's mark picker: refusals are said on screen, and Remove clears. */
describe("BrandMarkField", () => {
  it("says why an SVG was refused and keeps the old value", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <BrandMarkField
        label="Emblem"
        description=""
        box={EMBLEM_BOX}
        value=""
        onChange={onChange}
      />,
    );
    // Mantine's FileInput is a button over a hidden file input; upload to the input.
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    const svg = new File(["<svg/>"], "emblem.svg", { type: "image/svg+xml" });
    await userEvent.upload(input, svg, { applyAccept: false });
    expect(await screen.findByText(/SVG and other files are not accepted/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("previews the chosen image and removes it", async () => {
    const onChange = vi.fn();
    render(
      <BrandMarkField
        label="Emblem"
        description=""
        box={EMBLEM_BOX}
        value="data:image/png;base64,AAAA"
        onChange={onChange}
      />,
    );
    expect(screen.getByAltText("Emblem preview")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove emblem" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
