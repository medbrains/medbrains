import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type QuarantineRow } from "@medbrains/types";
import { IconFlame } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Checkbox, Input, Modal, Select, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { storefrontService } from "@/services/storefront.service";
import { type DestroyForm, destroyProblem, quarantineReasonLabel } from "../store/storefront-p2";

/**
 * Returned medicines that may not go back on the shelf — opened, expired,
 * cold-chain, controlled — held until destroyed on a certificate in the
 * destruction register: biomedical waste (Yellow, category d) handed to an
 * authorised CBMWTF, or a controlled drug before a second person, in the
 * NDPS register.
 */
export function QuarantinePage() {
  useRequirePermission(P.PHARMACY.QUARANTINE.MANAGE);
  const canManage = useHasPermission(P.PHARMACY.QUARANTINE.MANAGE);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [destroying, setDestroying] = useState(false);
  const rows = useQuery({
    queryKey: ["pharmacy-quarantine"],
    queryFn: () => storefrontService.listQuarantine(),
    enabled: canManage,
  });
  const picked = useMemo(
    () => (rows.data ?? []).filter((r) => chosen.has(r.id)),
    [rows.data, chosen],
  );
  const toggle = (id: string, on: boolean) =>
    setChosen((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const columns = [
    {
      key: "pick",
      label: "",
      render: (r: QuarantineRow) =>
        r.status === "quarantined" ? (
          <Checkbox
            aria-label={`Choose ${r.drug_name}`}
            checked={chosen.has(r.id)}
            onChange={(e) => toggle(r.id, e.currentTarget.checked)}
          />
        ) : null,
    },
    {
      key: "what",
      label: "Medicine",
      render: (r: QuarantineRow) => (
        <Text size="sm">
          {r.drug_name} × {r.quantity}
          {r.batch_number ? ` · batch ${r.batch_number}` : ""}
        </Text>
      ),
    },
    {
      key: "why",
      label: "Why",
      render: (r: QuarantineRow) => (
        <Text size="sm">{r.reasons.map(quarantineReasonLabel).join(", ")}</Text>
      ),
    },
    {
      key: "route",
      label: "Destroyed by",
      render: (r: QuarantineRow) => (
        <Badge size="sm" tone={r.route === "ndps" ? "danger" : "warning"}>
          {r.route === "ndps" ? "NDPS register, witnessed" : "Biomedical waste (yellow)"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: QuarantineRow) => (
        <Text size="sm">
          {r.status === "destroyed" ? `Destroyed · ${r.certificate_number ?? ""}` : "Waiting"}
        </Text>
      ),
    },
  ];
  return (
    <Stack>
      <PageHeader
        title="Returns quarantine"
        subtitle="Returned medicines held until they are destroyed on record"
        icon={<IconFlame size={20} stroke={1.5} />}
        actions={
          <Button tone="danger" disabled={picked.length === 0} onClick={() => setDestroying(true)}>
            Destroy chosen ({picked.length})
          </Button>
        }
      />
      {rows.isError ? (
        <Alert tone="danger" title="The quarantine could not be loaded">
          This is not an empty list. Try again in a moment.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={rows.data ?? []}
          loading={rows.isLoading}
          rowKey={(r) => r.id}
          emptyTitle="Nothing in quarantine"
        />
      )}
      <Modal opened={destroying} onClose={() => setDestroying(false)} title="Destroy on record">
        {destroying && (
          <DestroyBody
            rows={picked}
            onDone={() => {
              setDestroying(false);
              setChosen(new Set());
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

function DestroyBody({ rows, onDone }: { rows: QuarantineRow[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const canPickWitness = useHasPermission(P.PHARMACY.STOREFRONT.MANAGE);
  const ndps = rows.some((r) => r.route === "ndps");
  const [form, setForm] = useState<DestroyForm>({
    witnessUserId: null,
    witnessName: "",
    cbmwtfName: "",
    manifestNumber: "",
  });
  const pharmacists = useQuery({
    queryKey: ["storefront-pharmacists"],
    queryFn: () => storefrontService.listStorefrontPharmacists(),
    enabled: ndps && canPickWitness,
  });
  const destroy = useMutation({
    mutationFn: () => {
      const problem = destroyProblem(rows, form);
      if (problem) throw new Error(problem);
      return storefrontService.destroyQuarantine({
        ids: rows.map((r) => r.id),
        witness_name: form.witnessName,
        ...(form.witnessUserId ? { witness_user_id: form.witnessUserId } : {}),
        ...(ndps
          ? {}
          : { cbmwtf_name: form.cbmwtfName, cbmwtf_manifest_number: form.manifestNumber }),
      });
    },
    onSuccess: (d) => {
      toast.success(`Certificate ${d.certificate_number}`, { title: "Destroyed on record" });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-quarantine"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not destroyed" }),
  });
  const set = (k: keyof DestroyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.currentTarget.value }));
  return (
    <Stack gap="sm">
      <Text size="sm">{rows.map((r) => `${r.drug_name} × ${r.quantity}`).join(", ")}</Text>
      {ndps && (
        <Select
          label="Witness (a second person)"
          data={(pharmacists.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
          value={form.witnessUserId}
          onChange={(v) => {
            const who = pharmacists.data?.find((p) => p.id === v);
            setForm((f) => ({
              ...f,
              witnessUserId: v,
              witnessName: who?.full_name ?? f.witnessName,
            }));
          }}
        />
      )}
      <Input label="Witness name" value={form.witnessName} onChange={set("witnessName")} />
      {!ndps && (
        <Group grow>
          <Input
            label="Biomedical waste facility (CBMWTF)"
            value={form.cbmwtfName}
            onChange={set("cbmwtfName")}
          />
          <Input
            label="Manifest number"
            value={form.manifestNumber}
            onChange={set("manifestNumber")}
          />
        </Group>
      )}
      <Button tone="danger" loading={destroy.isPending} onClick={() => destroy.mutate()}>
        Destroy and record
      </Button>
    </Stack>
  );
}
