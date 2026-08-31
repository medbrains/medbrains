import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

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

// MSW lifecycle — fixture-driven UI tests register handlers via
// `src/test/handlers.ts`. Tests can override per-call with
// `server.use(...)` inside the test body.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());

// Unmount between tests. Without this the previous test's DOM is still
// mounted when the next one queries it, so a test can pass on markup that
// its own render never produced — and fail on markup it never asked for.
afterEach(cleanup);
afterAll(() => server.close());
