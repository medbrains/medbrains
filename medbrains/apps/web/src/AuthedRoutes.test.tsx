import {
  Children,
  type ComponentType,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it, vi } from "vitest";

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

const { AuthedRoutes } = await import("./AuthedRoutes");

interface RouteProps {
  path?: string;
  index?: boolean;
  element?: ReactNode;
  children?: ReactNode;
}

/** Lists the full address of every route in the tree, parents first. */
function collectPaths(node: ReactNode, prefix: string, out: string[]): string[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = (child as ReactElement<RouteProps>).props;
    const here = props.path ? `${prefix}/${props.path}` : prefix;
    if (props.path || props.index) out.push(props.index ? `${here} (index)` : here);
    collectPaths(props.children, here, out);
  });
  return out;
}

describe("the signed-in routes", () => {
  it("give each address exactly one screen", () => {
    const paths = collectPaths(AuthedRoutes().props.children, "", []);
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
