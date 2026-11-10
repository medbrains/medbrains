import { Text } from "@mantine/core";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAddProductStore } from "@/components/Materials/add-product-store";
import { type CollectTarget, useCollect } from "@/components/payments/collect/collect-store";
import { render, screen } from "@/test/test-utils";
import { OnDemandOverlays } from "./OnDemandOverlays";

const loads = vi.hoisted(() => ({ addProduct: 0, collect: 0 }));
vi.mock("@/components/Materials/AddProductModal", () => {
  loads.addProduct += 1;
  return { AddProductModal: () => <Text>Add product form</Text> };
});
vi.mock("@/components/payments/collect/CollectDrawer", () => {
  loads.collect += 1;
  return { CollectDrawer: () => <Text>Collect form</Text> };
});

describe("the shell's on-demand overlays", () => {
  afterEach(() => {
    act(() => {
      useAddProductStore.getState().close();
      useCollect.getState().close();
    });
  });

  it("download nothing until one is opened", () => {
    render(<OnDemandOverlays />);
    expect(loads).toEqual({ addProduct: 0, collect: 0 });
    expect(screen.queryByText("Add product form")).toBeNull();
  });

  it("open the add-product form when its store says so", async () => {
    render(<OnDemandOverlays />);
    act(() => useAddProductStore.getState().open());
    expect(await screen.findByText("Add product form")).toBeInTheDocument();
    expect(loads.collect).toBe(0);
  });

  it("open the collect drawer for a payment target", async () => {
    render(<OnDemandOverlays />);
    act(() => useCollect.getState().open({} as CollectTarget));
    expect(await screen.findByText("Collect form")).toBeInTheDocument();
  });
});
