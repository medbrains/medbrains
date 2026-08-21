import { Group, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasAnyPermission } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { TokenBoardLive } from "@/components/TokenBoardLive";
import { Select } from "@/components/ui";
import { DEPARTMENT_LIST_CODES } from "@/lib/api-permission-sets";
import styles from "./token-display.module.scss";

const MODULES: { value: string; label: string }[] = [
  { value: "registration", label: "Registration" },
  { value: "opd", label: "OPD" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "billing", label: "Billing" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "dispatch", label: "Dispatch" },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text className={styles.clock}>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </Text>
  );
}

/**
 * Full-screen TV / waiting-area display. Pick a module + department from the
 * top bar (also URL-driven via ?module=&scope_id= for fixed kiosks). Token-
 * number-only (no PHI), big, with voice call-outs.
 */
export function TokenDisplayPage() {
  const [params, setParams] = useSearchParams();
  const module = params.get("module") ?? "opd";
  const departmentId = params.get("scope_id");

  // The department picker is the shared setup endpoint, which takes
  // require_any_permission over nineteen codes. Mirror the handler rather than
  // guess one member — gating on one would hide the picker from people the
  // server would allow.
  const canListDepartments = useHasAnyPermission(DEPARTMENT_LIST_CODES);
  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    enabled: canListDepartments,
    staleTime: 600_000,
  });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const moduleLabel = MODULES.find((entry) => entry.value === module)?.label ?? module;
  const departmentName = departments?.find((dept) => dept.id === departmentId)?.name;
  const title = departmentName ? `${moduleLabel} · ${departmentName}` : `${moduleLabel} Queue`;

  return (
    <div className={styles.display}>
      <div className={styles.bar}>
        <Text className={styles.brand}>MedBrains · Live queue</Text>
        <Group gap="sm" align="center">
          <Select
            aria-label="Module"
            data={MODULES}
            value={module}
            onChange={(value) => setParam("module", value)}
            style={{ width: 170 }}
          />
          <Select
            aria-label="Department"
            placeholder="All departments"
            data={(departments ?? []).map((dept) => ({ value: dept.id, label: dept.name }))}
            value={departmentId}
            onChange={(value) => setParam("scope_id", value)}
            searchable
            clearable
            style={{ width: 220 }}
          />
          <Clock />
        </Group>
      </div>
      <div className={styles.board}>
        <TokenBoardLive
          title={title}
          module={module}
          scope={departmentId ? "department" : undefined}
          scopeId={departmentId ?? undefined}
          publicMode
          display
        />
      </div>
    </div>
  );
}
