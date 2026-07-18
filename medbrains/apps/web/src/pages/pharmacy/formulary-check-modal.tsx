// IPD FormularyCheckModal — split from pharmacy.tsx (pure move).

import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Alert, Badge, Button } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { Card, Group, Modal, Stack, Text } from "@mantine/core";
import type { FormularyCheckResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export function FormularyCheckModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [drugId, setDrugId] = useState("");

  const checkMutation = useMutation({
    mutationFn: (data: { drug_id: string }) => pharmacyService.formularyCheck(data),
  });

  const result = checkMutation.data as FormularyCheckResult | undefined;

  return (
    <Modal opened={opened} onClose={onClose} title="Formulary Check" size="lg">
      <Stack>
        <DrugSearchSelect value={drugId} onChange={(id) => setDrugId(id)} label="Drug" required />
        <Button
          tone="primary"
          onClick={() => checkMutation.mutate({ drug_id: drugId })}
          loading={checkMutation.isPending}
          disabled={!drugId.trim()}
        >
          Check Formulary Status
        </Button>

        {result && (
          <Card withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>{result.drug_name}</Text>
                <Badge tone={result.is_formulary ? "success" : "danger"} variant="filled">
                  {result.is_formulary ? "In Formulary" : "Not in Formulary"}
                </Badge>
              </Group>
              {result.requires_approval && (
                <Alert tone="warning">
                  <Text size="sm">This drug requires DTC approval before prescribing.</Text>
                </Alert>
              )}
              {result.alternative_drugs?.length > 0 && (
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    Formulary Alternatives:
                  </Text>
                  <Group gap={4}>
                    {result.alternative_drugs.map((alt) => (
                      <Badge key={alt} tone="primary" size="sm">
                        {alt}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              )}
            </Stack>
          </Card>
        )}
      </Stack>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
//  Catalog Tab
// ══════════════════════════════════════════════════════════
