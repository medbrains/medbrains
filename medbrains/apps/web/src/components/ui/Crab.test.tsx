import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { Crab, type CrabState, type CrabVariant } from "./Crab";

const VARIANTS: CrabVariant[] = ["geometric", "line", "medic", "chibi"];
const STATES: CrabState[] = ["idle", "thinking", "happy"];

describe("Crab", () => {
  it("renders every variant in every state as art, at the size asked", () => {
    for (const variant of VARIANTS) {
      for (const state of STATES) {
        const { container, unmount } = render(<Crab variant={variant} state={state} size={48} />);
        const crab = container.querySelector(`[data-variant="${variant}"]`) as HTMLElement;
        expect(crab.dataset.state).toBe(state);
        expect(crab.querySelector("svg")).not.toBeNull();
        expect(crab.style.width).toContain("3rem"); // 48px, via Mantine's rem scale
        unmount();
      }
    }
  });

  it("is decorative unless it is given a label", () => {
    const { container } = render(<Crab />);
    expect(container.querySelector("[data-variant]")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("announces itself as an image when labelled", () => {
    render(<Crab variant="medic" label="MedBrains helper" />);
    expect(screen.getByRole("img", { name: "MedBrains helper" })).toBeInTheDocument();
  });

  it("shows the thinking pose of the chibi crab, not its idle art", () => {
    const idle = render(<Crab variant="chibi" />).container.innerHTML;
    const thinking = render(<Crab variant="chibi" state="thinking" />).container.innerHTML;
    expect(thinking).not.toBe(idle);
  });

  it("plays the animated crab in the colour scheme's theme", async () => {
    render(<Crab variant="medic" />);
    const player = await screen.findByTestId("crab-player");
    expect(player.dataset.src).toContain("crab-medic");
    expect(player.dataset.theme).toBe("light");
  });

  it("uses the onBrand theme for a crab on a blue fill", async () => {
    render(<Crab tone="onBrand" />);
    expect((await screen.findByTestId("crab-player")).dataset.theme).toBe("onBrand");
  });

  describe("under reduced motion", () => {
    const original = window.matchMedia;
    afterEach(() => {
      window.matchMedia = original;
    });

    it("keeps the still art and never loads the player", async () => {
      window.matchMedia = (query: string) => ({
        ...original(query),
        matches: query.includes("prefers-reduced-motion"),
      });
      const { container } = render(<Crab variant="chibi" />);
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector("svg")).not.toBeNull();
      expect(screen.queryByTestId("crab-player")).toBeNull();
    });
  });
});
