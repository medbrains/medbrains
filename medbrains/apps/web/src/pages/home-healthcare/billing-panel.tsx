// Home-healthcare BillingPanel — split from home-healthcare.tsx (pure move).

import { Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function BillingPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [visits, setVisits] = useState<number | "">(10);
  const [price, setPrice] = useState<number | "">("");

  const { data = [] } = useQuery({
    queryKey: ["home-packages", patientId],
    queryFn: () => homeHealthService.listHomeCarePackages(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["home-packages", patientId] });
  };
  const buy = useMutation({
    mutationFn: () =>
      homeHealthService.createHomeCarePackage({
        patient_id: patientId,
        name,
        total_visits: typeof visits === "number" ? visits : 0,
        price: typeof price === "number" ? price : 0,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Package sold & charged", { title: "Home healthcare" });
      setName("");
      setPrice("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const consume = useMutation({
    mutationFn: (id: string) => homeHealthService.consumePackageVisit(id),
    onSuccess: () => {
      invalidate();
      toast.success("Visit deducted", { title: "Home healthcare" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Home care billing
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <TextInput
            label="Package"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Post-op home care"
            style={{ flex: 1 }}
          />
          <NumberInput
            label="Visits"
            value={visits}
            onChange={(v) => setVisits(typeof v === "number" ? v : "")}
            min={1}
            w={90}
          />
          <NumberInput
            label="Price ₹"
            value={price}
            onChange={(v) => setPrice(typeof v === "number" ? v : "")}
            min={0}
            w={120}
          />
          <Button
            onClick={() => buy.mutate()}
            loading={buy.isPending}
            disabled={!name.trim() || !visits || !price}
          >
            Sell & charge
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No packages.
        </Text>
      ) : (
        data.map((pk) => (
          <Group key={pk.id} justify="space-between">
            <Group gap={6}>
              <Text size="sm">{pk.name}</Text>
              <Badge tone={pk.status === "active" ? "success" : "neutral"} size="xs">
                {pk.used_visits}/{pk.total_visits}
              </Badge>
              <Text size="xs" c="dimmed">
                ₹{pk.price}
              </Text>
            </Group>
            {canManage && pk.status === "active" && pk.used_visits < pk.total_visits && (
              <Button size="xs" tone="secondary" onClick={() => consume.mutate(pk.id)}>
                Use a visit
              </Button>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}
