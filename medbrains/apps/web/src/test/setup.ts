import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./server";

// jsdom has no canvas or WebAssembly player: the animated crab renders a
// marker canvas carrying the props it was given.
vi.mock("@lottiefiles/dotlottie-react", () => ({
  setWasmUrl: () => {},
  DotLottieReact: (props: { src: string; themeId?: string }) =>
    createElement("canvas", {
      "data-testid": "crab-player",
      "data-src": props.src,
      "data-theme": props.themeId,
    }),
}));

// Mantine's MantineProvider requires window.matchMedia in jsdom.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Mantine's ScrollArea (used by Select, Table and anything with a dropdown)
// observes its own size. jsdom ships no ResizeObserver, and without it any
// page-level render throws before a single assertion runs.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mantine's autosize Textarea (the default in the `@/components/ui` seam)
// re-measures when webfonts finish loading. jsdom ships no `document.fonts`,
// so the listener registration throws and takes the whole render with it.
if (typeof document !== "undefined" && !document.fonts) {
  Object.defineProperty(document, "fonts", {
    writable: true,
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
      ready: Promise.resolve(),
    },
  });
}

// MSW lifecycle — fixture-driven UI tests register handlers via
// `src/test/handlers.ts`. Tests can override per-call with
// `server.use(...)` inside the test body.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());

// Unmount between tests. Without this the previous test's DOM is still
// mounted when the next one queries it, so a test can pass on markup that
// its own render never produced — and fail on markup it never asked for.
afterEach(cleanup);

// jsdom's localStorage is real under vitest 5 (Node's file-less one used to
// shadow it), so what one test remembers — a last-used tender, a muted
// alert — would leak into the next. Each test starts with an empty one.
afterEach(() => {
  if (typeof window !== "undefined") window.localStorage.clear();
});
afterAll(() => server.close());
