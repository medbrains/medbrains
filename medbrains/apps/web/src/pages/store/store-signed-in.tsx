import { Tabs } from "@mantine/core";
import { useState } from "react";
import { StoreBrowse } from "./store-browse";
import { StoreCart } from "./store-cart";
import { StoreOrders } from "./store-orders";
import { StoreRx } from "./store-rx";

interface StoreSignedInProps {
  tenantCode: string;
  token: string;
}

/** The storefront for a signed-in patient: their prescriptions first, then the shop. */
export function StoreSignedIn({ tenantCode, token }: StoreSignedInProps) {
  const [tab, setTab] = useState("prescriptions");
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  return (
    <Tabs value={tab} onChange={(v) => setTab(v ?? "prescriptions")} w="100%">
      <Tabs.List grow>
        <Tabs.Tab value="prescriptions">My prescriptions</Tabs.Tab>
        <Tabs.Tab value="shop">Shop</Tabs.Tab>
        <Tabs.Tab value="cart">Cart</Tabs.Tab>
        <Tabs.Tab value="orders">Orders</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="prescriptions" pt="md">
        <StoreRx
          token={token}
          onOrdered={(id) => {
            setPrescriptionId(id);
            setTab("cart");
          }}
        />
      </Tabs.Panel>
      <Tabs.Panel value="shop" pt="md">
        <StoreBrowse tenantCode={tenantCode} token={token} />
      </Tabs.Panel>
      <Tabs.Panel value="cart" pt="md">
        <StoreCart
          token={token}
          prescriptionId={prescriptionId}
          onPlaced={() => setTab("orders")}
        />
      </Tabs.Panel>
      <Tabs.Panel value="orders" pt="md">
        <StoreOrders token={token} />
      </Tabs.Panel>
    </Tabs>
  );
}
