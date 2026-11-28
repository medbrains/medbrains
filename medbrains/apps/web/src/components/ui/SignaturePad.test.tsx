import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { SignaturePad } from "./SignaturePad";

/** jsdom has no canvas: stand in for the 2D context and the PNG export. */
function fakeCanvas() {
  const ctx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA");
  return ctx;
}

describe("SignaturePad", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is a labelled drawing area that reports each stroke and a clear", async () => {
    const ctx = fakeCanvas();
    const onChange = vi.fn();
    render(<SignaturePad label="Draw your signature" onChange={onChange} />);
    const pad = screen.getByRole("img", { name: "Draw your signature" });

    fireEvent.pointerMove(pad, { clientX: 5, clientY: 5 });
    expect(ctx.stroke).not.toHaveBeenCalled();

    fireEvent.pointerDown(pad, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(pad, { clientX: 40, clientY: 20 });
    fireEvent.pointerUp(pad);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("data:image/png;base64,AAAA");

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
