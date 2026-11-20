import { APP_SCREENS } from "@medbrains/types";
import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { appOfRoute, enabledRoutes } from "./layouts/appPanel";

type Loader = () => Promise<{ default: ComponentType }>;

// Every page is code-split behind React.lazy. Catch each loader so the test can
// run it: a page renamed or moved without its route breaks only at runtime,
// as a blank screen for whoever opens that address.
const loaders = vi.hoisted(() => [] as Loader[]);
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    lazy: (loader: Loader) => {
      loaders.push(loader);
      return react.lazy(loader);
    },
  };
});

const { AUTHED_ROUTES } = await import("./AuthedRoutes");

/** Lists the full address of every route in the tree, parents first. */
function collectPaths(routes: RouteObject[], prefix = "", out: string[] = []): string[] {
  for (const route of routes) {
    const here = route.path ? `${prefix}/${route.path}` : prefix;
    if (route.path || route.index) out.push(route.index ? `${here} (index)` : here);
    collectPaths(route.children ?? [], here, out);
  }
  return out;
}

/** Shell routes no app owns and no menu screen lists: home, errors, redirects, tools. */
const SHELL_ROUTES = new Set([
  "/home",
  "/forbidden",
  "/*",
  "/admin/simulator",
  "/oauth/callback",
  "/components-inputs",
  "/demo/dicom/*",
  "/assistant",
  "/remote-access",
  "/profile",
  "/assets",
  "/specialty",
  "/admin",
  "/admin/device-integrations",
  "/admin/integration-builder/*",
  "/admin/tv-displays",
]);

describe("the signed-in routes", () => {
  it("register no route of a switched-off app, and every route of the others", () => {
    const all = collectPaths(AUTHED_ROUTES);
    const left = collectPaths(enabledRoutes(AUTHED_ROUTES, new Set(["pharmacy", "lab"])));
    const gone = all.filter((p) => !left.includes(p));
    expect(gone).toContain("/pharmacy/orders/:orderId");
    expect(gone).toContain("/ward-stock");
    expect(gone.every((p) => ["pharmacy", "lab"].includes(appOfRoute(p) ?? ""))).toBe(true);
    expect(left).toContain("/opd/encounters/:encounterId");
  });

  it("belong to a screen in the registry, or are named shell routes", () => {
    // A brick's page at an address no registry screen covers would open with the brick off.
    const covered = (p: string) =>
      APP_SCREENS.some((screen) => p === screen.path || p.startsWith(`${screen.path}/`));
    const unowned = collectPaths(AUTHED_ROUTES)
      .map((p) => p.replace(" (index)", ""))
      .filter((p) => !covered(p) && !SHELL_ROUTES.has(p));
    expect(unowned).toEqual([]);
  });

  it("give each address exactly one screen", () => {
    const paths = collectPaths(AUTHED_ROUTES);
    const seen = new Set<string>();
    const duplicates = paths.filter((p) => seen.size === seen.add(p).size);
    expect(paths.length).toBeGreaterThan(100);
    expect(duplicates).toEqual([]);
  });

  it("load a real component for every code-split page", { timeout: 240_000 }, async () => {
    expect(loaders.length).toBeGreaterThan(150);
    const broken: string[] = [];
    for (const loader of loaders) {
      const mod = await loader();
      const kind = typeof mod.default;
      // A component is a function, or an object for memo/forwardRef wrappers.
      if (kind !== "function" && (kind !== "object" || mod.default === null)) {
        broken.push(loader.toString());
      }
    }
    expect(broken).toEqual([]);
  });
});
