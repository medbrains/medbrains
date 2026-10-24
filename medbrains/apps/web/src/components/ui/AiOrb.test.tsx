import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AiOrb, type AiOrbState, type AiOrbVariant } from "./AiOrb";

const VARIANTS: AiOrbVariant[] = ["halo", "glass", "blob", "pulse"];
const STATES: AiOrbState[] = ["idle", "thinking", "listening", "loading", "done"];

const glyphs = (el: Element) => el.querySelectorAll("svg").length;

describe("AiOrb", () => {
  it("renders every variant in every state at the size asked", () => {
    for (const variant of VARIANTS) {
      for (const state of STATES) {
        const { container, unmount } = render(<AiOrb variant={variant} state={state} size={40} />);
        const orb = container.querySelector(`[data-variant="${variant}"]`) as HTMLElement;
        expect(orb.dataset.state).toBe(state);
        expect(orb.style.width).toContain("2.5rem"); // 40px, via Mantine's rem scale
        unmount();
      }
    }
  });

  // Each state must read without motion: under reduced motion only the
  // static marks remain, so "done" has to carry its tick.
  it("marks done with a tick in every variant", () => {
    for (const variant of VARIANTS) {
      const { container, unmount } = render(<AiOrb variant={variant} state="done" />);
      expect(glyphs(container)).toBe(1);
      unmount();
    }
  });

  it("carries the heartbeat glyph only on the pulse orb", () => {
    expect(glyphs(render(<AiOrb variant="pulse" state="thinking" />).container)).toBe(1);
    expect(glyphs(render(<AiOrb variant="glass" state="thinking" />).container)).toBe(0);
  });

  it("is decorative unless labelled", () => {
    const { container } = render(<AiOrb />);
    expect(container.querySelector("[data-variant]")?.getAttribute("aria-hidden")).toBe("true");
    render(<AiOrb label="AI is thinking" state="thinking" />);
    expect(screen.getByRole("img", { name: "AI is thinking" })).toBeInTheDocument();
  });
});
