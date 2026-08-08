// IPD StoresTransfersTab — split from pharmacy.tsx (pure move).

import { SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";
import { PharmacyRegistry } from "@/components/Pharmacy/PharmacyRegistry";
import { Alert } from "@/components/ui";
import { TransfersView } from "./transfers-view";

function PharmacyLocationsView({ canViewStores }: { canViewStores: boolean }) {
  return canViewStores ? (
    <PharmacyRegistry />
  ) : (
    <Alert tone="warning">
      Pharmacy locations require `pharmacy.stores.list` or `pharmacy.stores.manage`.
    </Alert>
  );
}

export function StoresTransfersTab({
  canViewStores,
  canManageStores,
}: {
  canViewStores: boolean;
  canManageStores: boolean;
}) {
  const [view, setView] = useState("locations");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Pharmacy Locations", value: "locations" },
          { label: "Transfers", value: "transfers" },
        ]}
      />
      {view === "locations" && (
        <PharmacyLocationsView canViewStores={canViewStores || canManageStores} />
      )}
      {view === "transfers" && (
        <TransfersView
          canViewStores={canViewStores || canManageStores}
          canManage={canManageStores}
        />
      )}
    </Stack>
  );
}
