import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { AbdmBridgeRegistration, AbdmBridgeStatus, AbdmCampusBridge } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Card, Input, Table, toast } from "@/components/ui";
import { abdmSettingsService } from "@/services/abdmSettings.service";

const KEY = ["abdm", "bridge"];
/** HFR: at most 15 letters, digits or spaces. */
const HIP_NAME = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;

const schema = z.object({
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\/\S+$/, "Enter the https address ABDM should call"),
  hip_names: z.record(
    z.string(),
    z
      .string()
      .trim()
      .max(15, "At most 15 characters")
      .regex(HIP_NAME, "Letters, digits and single spaces only"),
  ),
});
type FormValues = z.infer<typeof schema>;

function boundBadge(campus: AbdmCampusBridge) {
  if (campus.bound === null) return <Badge tone="neutral">Unknown</Badge>;
  if (!campus.bound) return <Badge tone="warning">Not bound</Badge>;
  return <Badge tone="success">Bound · {campus.types.join(", ") || "active"}</Badge>;
}

function defaults(data: AbdmBridgeStatus | undefined): FormValues {
  return {
    url: data?.gateway.url ?? data?.suggested_url ?? "",
    hip_names: Object.fromEntries((data?.campuses ?? []).map((c) => [c.facility_id, c.hip_name])),
  };
}

/** What each step of the last registration did — every step shown, none hidden. */
function RegistrationResult({ result }: { result: AbdmBridgeRegistration }) {
  return (
    <Stack gap="xs">
      <Alert tone={result.url.ok ? "success" : "danger"} title="Callback URL at the ABDM gateway">
        {result.url.message}
      </Alert>
      {result.campuses.map((c) => (
        <Alert key={c.facility_id} tone={c.ok ? "success" : "danger"} title={c.hfr_facility_id}>
          {c.message}
        </Alert>
      ))}
    </Stack>
  );
}

/**
 * Settings → ABDM → Bridge. Where ABDM delivers this hospital's consents,
 * record requests and Scan & Share, and which campuses (HFR IDs) the bridge
 * serves. When ABDM cannot be asked the state is "unknown" — never shown as
 * "not registered".
 */
export function AbdmBridgeCard() {
  const canRegister = useHasPermission(P.ABDM.BRIDGE.REGISTER);
  const queryClient = useQueryClient();
  const [result, setResult] = useState<AbdmBridgeRegistration | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: KEY,
    queryFn: abdmSettingsService.bridge,
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: defaults(data) });
  const register = useMutation({
    mutationFn: (v: FormValues) => abdmSettingsService.registerBridge(v),
    onSuccess: (done) => {
      setResult(done);
      queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not register the bridge" }),
  });

  if (isError) {
    return (
      <Alert tone="danger" title="Could not load the ABDM bridge">
        This does not mean the bridge is unregistered — the screen failed to load.
      </Alert>
    );
  }
  const gateway = data?.gateway;

  return (
    <Card>
      <Stack component="form" onSubmit={form.handleSubmit((v) => register.mutate(v))}>
        <Stack gap={4}>
          <Text fw={600}>ABDM bridge</Text>
          <Text size="sm" c="dimmed">
            Where ABDM sends consents, record requests and Scan &amp; Share for this hospital. The
            bridge ID is your ABDM client ID; each campus is bound to it by its HFR facility ID.
          </Text>
        </Stack>
        {isLoading && <Text size="sm">Asking ABDM…</Text>}
        {data && !data.configured && (
          <Alert tone="info" title="Set up the ABDM keys first">
            Save and test the client ID and secret above, then register the bridge here.
          </Alert>
        )}
        {data?.configured && gateway?.state === "unknown" && (
          <Alert tone="warning" title="Could not ask ABDM">
            {gateway.message ?? "ABDM did not answer."} This says nothing about whether the bridge
            is registered.
          </Alert>
        )}
        {gateway?.state === "ok" && (
          <Group gap="xs">
            <Text size="sm">Bridge {data?.bridge_id} calls</Text>
            <Text size="sm" ff="monospace">
              {gateway.url ?? "a URL ABDM does not report back"}
            </Text>
            {gateway.active === false && <Badge tone="warning">Inactive</Badge>}
            {gateway.blocklisted && <Badge tone="danger">Blocklisted by ABDM</Badge>}
          </Group>
        )}
        {data && data.campuses.length === 0 && (
          <Alert tone="info" title="No campus has an HFR facility ID">
            Add each campus's HFR ID under Settings → Facilities before registering.
          </Alert>
        )}
        {data && data.campuses.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Campus</Table.Th>
                <Table.Th>HFR ID</Table.Th>
                <Table.Th>HIP ID at ABDM</Table.Th>
                <Table.Th>Name in the patient's app</Table.Th>
                <Table.Th>At ABDM</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.campuses.map((c) => (
                <Table.Tr key={c.facility_id}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td ff="monospace">{c.hfr_facility_id}</Table.Td>
                  <Table.Td>
                    {c.service_id ? (
                      <Text size="sm" ff="monospace">
                        {c.service_id}
                      </Text>
                    ) : (
                      <Badge tone="warning">Not issued yet</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Controller
                      control={form.control}
                      name={`hip_names.${c.facility_id}`}
                      render={({ field, fieldState }) => (
                        <Input
                          {...field}
                          aria-label={`Name in the patient's app for ${c.name}`}
                          maxLength={15}
                          disabled={!canRegister}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                  </Table.Td>
                  <Table.Td>{boundBadge(c)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {canRegister && data?.configured && (
          <>
            <Controller
              control={form.control}
              name="url"
              render={({ field }) => (
                <Input
                  {...field}
                  label="Callback URL"
                  description="This server's public https address; ABDM adds /api/v3/… to it. One URL per client ID: registering here replaces whatever any other system set with these keys."
                  autoComplete="off"
                  error={form.formState.errors.url?.message}
                />
              )}
            />
            <Group>
              <Button type="submit" tone="primary" loading={register.isPending}>
                Register bridge
              </Button>
            </Group>
          </>
        )}
        {result && <RegistrationResult result={result} />}
      </Stack>
    </Card>
  );
}
