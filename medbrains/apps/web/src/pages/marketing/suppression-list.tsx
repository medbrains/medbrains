import { Group, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingSuppression } from "@medbrains/types";
import { P, SUPPRESSION_REASONS } from "@medbrains/types";
import { IconBan } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Card, Select, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  SUPPRESSION_REASONS.map((r) => [r.value, r.label]),
);

const CHANNELS = [
  { value: "phone", label: "Calls" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
];

/**
 * Never contact this number again.
 *
 * The endpoints have existed since the consent ledger landed and nothing
 * reached them, so the only way to stop contacting somebody was to withdraw
 * consent on their enquiry record — which is keyed on the record. Retention
 * deletes it, the next inbound call manufactures a fresh contact with the
 * flags at false, and "not yet asked" is indistinguishable from "asked and
 * refused". Somebody who said never again would quietly become contactable.
 *
 * A suppression hangs off the number instead and does not cascade, so it
 * outlives the record it was recorded against. That is the whole reason it is
 * a separate thing from consent, and until now the durable half was the one
 * nobody could use.
 */
export function SuppressionList() {
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.MARKETING.CONSENT_VIEW);
  const canManage = useHasPermission(P.MARKETING.SUPPRESSION_MANAGE);

  const [channel, setChannel] = useState<string | null>("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<string | null>("opted_out");
  const [scope, setScope] = useState<string | null>("promotional");

  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "suppressions"],
    queryFn: () => marketingService.listSuppressions(),
    // Reads gate the query, not only the control.
    enabled: canView,
  });

  const add = useMutation({
    mutationFn: () =>
      marketingService.addSuppression({
        channel: channel ?? "phone",
        value: value.trim(),
        reason: reason ?? "opted_out",
        scope: scope ?? "promotional",
      }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "suppressions"] });
      setValue("");
      toast.success(
        row.scope === "all"
          ? `${row.value} will not be contacted at all`
          : `${row.value} will get no more offers`,
        { title: "Added to the do-not-contact list" },
      );
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not add it" }),
  });

  if (!canView) return null;

  const columns = [
    {
      key: "value",
      label: "Number or address",
      render: (row: MarketingSuppression) => (
        <Text fw={500} ff="monospace" size="sm">
          {row.value}
        </Text>
      ),
    },
    {
      key: "channel",
      label: "Channel",
      render: (row: MarketingSuppression) => (
        <Text size="sm">{CHANNELS.find((c) => c.value === row.channel)?.label ?? row.channel}</Text>
      ),
    },
    {
      key: "scope",
      label: "Extent",
      render: (row: MarketingSuppression) =>
        // Not colour alone: the two scopes mean very different things and the
        // words carry it.
        row.scope === "all" ? (
          <Badge tone="danger" size="sm">
            Nothing at all
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            No offers
          </Badge>
        ),
    },
    {
      key: "reason",
      label: "Why",
      render: (row: MarketingSuppression) => (
        <Stack gap={0}>
          <Text size="sm">{REASON_LABELS[row.reason] ?? row.reason}</Text>
          {row.note && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {row.note}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "since",
      label: "Since",
      render: (row: MarketingSuppression) => (
        <Text size="sm" c="dimmed">
          {new Date(row.since).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  return (
    <Card>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={600} size="sm">
            Do not contact
          </Text>
          <Text size="xs" c="dimmed">
            Kept against the number, not the enquiry record, so it survives the record being deleted
            and recreated. Withdrawing consent on one enquiry does not.
          </Text>
        </Stack>

        {canManage && (
          <Group align="flex-end" gap="xs">
            <Select
              label="Channel"
              data={CHANNELS}
              value={channel}
              onChange={setChannel}
              allowDeselect={false}
              w={130}
            />
            <TextInput
              label="Number or email"
              placeholder="10-digit mobile"
              style={{ flex: 1 }}
              value={value}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
            <Select
              label="Why"
              data={[...SUPPRESSION_REASONS]}
              value={reason}
              onChange={setReason}
              allowDeselect={false}
              w={210}
            />
            <Select
              label="Extent"
              // Two genuinely different requests. A bereaved family asking for
              // everything to stop is not the same as somebody who only wants
              // no more offers, and defaulting to the wider one would silence
              // appointment reminders somebody still needs.
              data={[
                { value: "promotional", label: "No offers" },
                { value: "all", label: "Nothing at all" },
              ]}
              value={scope}
              onChange={setScope}
              allowDeselect={false}
              w={160}
            />
            <Button
              tone="danger"
              leftSection={<IconBan size={14} />}
              disabled={value.trim().length === 0}
              loading={add.isPending}
              onClick={() => add.mutate()}
            >
              Add
            </Button>
          </Group>
        )}

        {scope === "all" && canManage && (
          <Alert tone="warning" title="This stops appointment reminders too">
            Use it when somebody wants no contact of any kind — a bereavement, or a repeated
            complaint. "No offers" leaves reminders, reports and bills working.
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          rowKey={(row: MarketingSuppression) => row.id}
          emptyTitle={
            isError ? "The do-not-contact list could not be loaded" : "Nobody has asked us to stop"
          }
          emptyDescription={
            isError
              ? // An empty list and a failed one look identical, and one of them
                // ends with somebody being contacted who asked not to be.
                "This is not a statement that nobody opted out — the list failed to load."
              : "Numbers added here are excluded from every campaign, and stay excluded."
          }
        />
      </Stack>
    </Card>
  );
}
