import { describe, it, expect } from "vitest";
import { buildPermissionTree, type PermissionDef } from "@medbrains/types";

describe("buildPermissionTree", () => {
  it("returns an empty array for empty input", () => {
    expect(buildPermissionTree([])).toEqual([]);
  });

  it("groups perms by their dot-prefix into a recursive tree", () => {
    const perms: PermissionDef[] = [
      { code: "lab.orders.list", description: "", label: "List", module: "lab" },
      { code: "lab.orders.create", description: "", label: "Create", module: "lab" },
      { code: "lab.results.amend", description: "", label: "Amend", module: "lab" },
      { code: "pharmacy.dispensing.create", description: "", label: "Create", module: "pharmacy" },
    ];

    const tree = buildPermissionTree(perms);

    // Top level: lab + pharmacy
    expect(tree).toHaveLength(2);
    const lab = tree.find((g) => g.key === "lab");
    const pharmacy = tree.find((g) => g.key === "pharmacy");
    expect(lab).toBeDefined();
    expect(pharmacy).toBeDefined();

    // Lab has two children: orders + results
    expect(lab?.children).toHaveLength(2);
    const orders = lab?.children.find((c) => c.key === "lab.orders");
    expect(orders?.permissions.map((p) => p.code).sort()).toEqual([
      "lab.orders.create",
      "lab.orders.list",
    ]);
  });

  it("places leaf perm at the correct level (3-segment code)", () => {
    const perms: PermissionDef[] = [{ code: "billing.invoices.list", description: "", label: "List", module: "billing" }];
    const tree = buildPermissionTree(perms);
    const billing = tree.find((g) => g.key === "billing");
    expect(billing).toBeDefined();
    const invoices = billing?.children.find((c) => c.key === "billing.invoices");
    expect(invoices?.permissions[0]?.code).toBe("billing.invoices.list");
  });

  it("supports flat 2-segment codes (e.g. indent.list)", () => {
    const perms: PermissionDef[] = [
      { code: "indent.list", description: "", label: "List", module: "indent" },
      { code: "indent.create", description: "", label: "Create", module: "indent" },
    ];
    const tree = buildPermissionTree(perms);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.key).toBe("indent");
    expect(tree[0]?.permissions.map((p) => p.code).sort()).toEqual([
      "indent.create",
      "indent.list",
    ]);
  });

  it("capitalizes labels for accordion display", () => {
    const perms: PermissionDef[] = [{ code: "lab.orders.list", description: "", label: "List", module: "lab" }];
    const tree = buildPermissionTree(perms);
    expect(tree[0]?.label).toBe("Lab");
    expect(tree[0]?.children[0]?.label).toBe("Orders");
  });

  it("does not duplicate intermediate groups across multiple perms", () => {
    const perms: PermissionDef[] = [
      { code: "lab.orders.list", description: "", label: "List", module: "lab" },
      { code: "lab.orders.create", description: "", label: "Create", module: "lab" },
      { code: "lab.orders.cancel", description: "", label: "Cancel", module: "lab" },
    ];
    const tree = buildPermissionTree(perms);
    // Single "lab" group with single "lab.orders" subgroup
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.permissions).toHaveLength(3);
  });
});
