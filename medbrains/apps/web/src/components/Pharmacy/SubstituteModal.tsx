import { Group, Stack, Text } from "@mantine/core";
import type { PharmacyCatalog, PharmacyOrderItem } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Input, Modal, Select, Switch, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";
import { pharmacyService } from "@/services/pharmacy.service";

interface Props {
  opened: boolean;
  onClose: () => void;
  item: PharmacyOrderItem;
  catalog: PharmacyCatalog[];
}

/**
 * Generic substitution — pharmacist swaps a prescribed drug for an
 * equivalent (with reason + patient consent). INN match is auto-derived
 * from `inn_name`; the swap is recorded in `pharmacy_substitutions`.
 */
export function SubstituteModal({ opened, onClose, item, catalog }: Props) {
  const queryClient = useQueryClient();
  const original = useMemo(
    () => catalog.find((c) => c.id === item.catalog_item_id),
    [catalog, item.catalog_item_id],
  );

  const [substituteId, setSubstituteId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);

  const substitute = catalog.find((c) => c.id === substituteId);
  const innMatch = Boolean(
    original?.inn_name && substitute?.inn_name && original.inn_name === substitute.inn_name,
  );

  // NLEM (government-essential / Jan Aushadhi) generics — guide cost-saving swaps.
  const { data: nlemList = [] } = useQuery({
    queryKey: ["ckb-nlem-generics"],
    queryFn: () => ckbService.listNlemGenerics(),
    staleTime: 600_000,
    enabled: opened,
  });
  const nlemSet = useMemo(() => new Set(nlemList), [nlemList]);
  const isNlem = (c?: PharmacyCatalog) => {
    const g = (c?.generic_name ?? c?.inn_name ?? "").trim().toLowerCase();
    return g.length > 0 && nlemSet.has(g);
  };
  const originalGeneric = (original?.generic_name ?? original?.inn_name ?? "").trim();
  const nlemAvailable = isNlem(original) && !isNlem(substitute);

  const options = useMemo(
    () =>
      catalog
        .filter((c) => c.id !== item.catalog_item_id)
        .map((c) => ({
          value: c.id,
          label: c.generic_name ? `${c.name} · ${c.generic_name}` : c.name,
        })),
    [catalog, item.catalog_item_id],
  );

  const mutation = useMutation({
    mutationFn: () =>
      pharmacyService.createSubstitution({
        pharmacy_order_item_id: item.id,
        original_drug_id: item.catalog_item_id ?? "",
        substituted_drug_id: substituteId ?? "",
        reason,
        inn_match: innMatch,
        patient_consent_obtained: consent,
      }),
    onSuccess: () => {
      toast.success("Substitution recorded", { title: "Substituted" });
      queryClient.invalidateQueries({ queryKey: ["substitutions", item.id] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Substitution failed" }),
  });

  const canSubmit = Boolean(item.catalog_item_id && substituteId && reason.trim());

  return (
    <Modal opened={opened} onClose={onClose} title="Substitute medication" size="md">
      <Stack gap="sm">
        <Text size="sm">
          Prescribed: <strong>{item.drug_name}</strong>
          {original?.inn_name ? ` (${original.inn_name})` : ""}
        </Text>
        {!item.catalog_item_id && (
          <Alert tone="warning">
            This line is not linked to a catalog drug — substitution cannot be recorded.
          </Alert>
        )}
        {nlemAvailable && (
          <Alert tone="success">
            <strong>{originalGeneric}</strong> is on the NLEM (government-essential / Jan Aushadhi)
            list — substituting the generic can reduce patient cost.
          </Alert>
        )}
        <Select
          label="Substitute with"
          placeholder="Search catalog"
          data={options}
          value={substituteId}
          onChange={setSubstituteId}
          searchable
          disabled={!item.catalog_item_id}
        />
        {substitute && (
          <Group gap="xs">
            <Badge tone={innMatch ? "success" : "warning"} size="sm">
              {innMatch ? "Same INN" : "Different INN — therapeutic substitution"}
            </Badge>
            {isNlem(substitute) && (
              <Badge tone="success" size="sm">
                NLEM generic
              </Badge>
            )}
          </Group>
        )}
        <Input
          label="Reason"
          placeholder="Out of stock / formulary preference / cost"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          required
        />
        <Switch
          label="Patient consent obtained"
          checked={consent}
          onChange={(e) => setConsent(e.currentTarget.checked)}
        />
        {!innMatch && substitute && !consent && (
          <Alert tone="info">
            Therapeutic (non-INN) substitution — patient consent is recommended.
          </Alert>
        )}
        <Group justify="flex-end" mt="xs">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={mutation.isPending}
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            Record substitution
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
