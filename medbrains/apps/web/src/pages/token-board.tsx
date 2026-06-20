import { Card, Group, Stack } from "@mantine/core";
import { P } from "@medbrains/types";
import { useState } from "react";
import { PageHeader } from "@/components";
import { TokenBoardLive } from "@/components/TokenBoardLive";
import { Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

const MODULES = [
  { value: "registration", label: "Registration" },
  { value: "opd", label: "OPD" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "billing", label: "Billing" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "dispatch", label: "Dispatch" },
];

/** Live token board — pick a module and watch its queue update in real time. */
export function TokenBoardPage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE_LIST);
  const [module, setModule] = useState("opd");
  const label = MODULES.find((entry) => entry.value === module)?.label ?? module;

  return (
    <Stack>
      <PageHeader title="Token board" subtitle="Live queue display — any module" />
      <Group>
        <Select
          label="Module"
          data={MODULES}
          value={module}
          onChange={(value) => setModule(value ?? "opd")}
          style={{ width: 220 }}
        />
      </Group>
      <Card withBorder>
        <TokenBoardLive title={`${label} Queue`} module={module} />
      </Card>
    </Stack>
  );
}
