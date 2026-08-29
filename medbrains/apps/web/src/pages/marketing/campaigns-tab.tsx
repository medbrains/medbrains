import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { MarketingCampaign, UpsertMarketingCampaignRequest } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, Drawer, IconButton, Select, toast } from "@/components/ui";
import {
  CAMPAIGN_CHANNEL_OPTIONS,
  type MarketingCampaignFormInput,
  marketingCampaignSchema,
  paiseToRupees,
  rupeesToPaise,
} from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";

const EMPTY: MarketingCampaignFormInput = {
  name: "",
  channel: "google_ads",
  source: "",
  external_ref: "",
  spend_rupees: 0,
  started_on: "",
  ended_on: "",
};

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export function MarketingCampaignsTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [drawerOpen, drawer] = useDisclosure(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<MarketingCampaignFormInput>({
    resolver: zodResolver(marketingCampaignSchema),
    defaultValues: EMPTY,
  });

  const {
    data: campaigns = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "campaigns"],
    queryFn: () => marketingService.listCampaigns(),
  });

  const close = () => {
    drawer.close();
    setEditing(null);
    reset(EMPTY);
  };

  const saveMutation = useMutation({
    mutationFn: (values: MarketingCampaignFormInput) => {
      // The PUT is a full replace, so every field goes back on the wire.
      // Omitting one writes NULL over whatever was there.
      const body: UpsertMarketingCampaignRequest = {
        name: values.name.trim(),
        channel: values.channel,
        source: values.source.trim(),
        external_ref: optionalText(values.external_ref),
        spend_minor: rupeesToPaise(values.spend_rupees),
        started_on: optionalText(values.started_on),
        ended_on: optionalText(values.ended_on),
      };
      return editing
        ? marketingService.updateCampaign(editing.id, body)
        : marketingService.createCampaign(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
      toast.success(editing ? "Campaign updated" : "Campaign created");
      close();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not save campaign" }),
  });

  const openEdit = (row: MarketingCampaign) => {
    setEditing(row);
    reset({
      name: row.name,
      channel: (CAMPAIGN_CHANNEL_OPTIONS.find((o) => o.value === row.channel)?.value ??
        "other") as MarketingCampaignFormInput["channel"],
      source: row.source,
      external_ref: row.external_ref ?? "",
      spend_rupees: paiseToRupees(row.spend_minor),
      started_on: row.started_on ?? "",
      ended_on: row.ended_on ?? "",
    });
    drawer.open();
  };

  const columns = [
    {
      key: "name",
      label: "Campaign",
      render: (row: MarketingCampaign) => <Text fw={500}>{row.name}</Text>,
    },
    {
      key: "channel",
      label: "Channel",
      render: (row: MarketingCampaign) => (
        <Text size="sm">
          {CAMPAIGN_CHANNEL_OPTIONS.find((o) => o.value === row.channel)?.label ?? row.channel}
        </Text>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (row: MarketingCampaign) => <Text size="sm">{row.source}</Text>,
    },
    {
      key: "spend",
      label: "Spend",
      render: (row: MarketingCampaign) => (
        <Text size="sm">
          {row.currency} {paiseToRupees(row.spend_minor).toLocaleString("en-IN")}
        </Text>
      ),
    },
    {
      key: "ran",
      label: "Ran",
      render: (row: MarketingCampaign) => (
        <Text size="sm" c="dimmed">
          {row.started_on ?? "—"} → {row.ended_on ?? "open"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      // Read-only: the server does not accept `is_active` on the upsert, so a
      // switch here would be a control that silently does nothing.
      render: (row: MarketingCampaign) => (
        <Badge tone={row.is_active ? "success" : "neutral"} size="sm">
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (row: MarketingCampaign) => (
              <IconButton
                tone="default"
                aria-label={`Edit ${row.name}`}
                onClick={() => openEdit(row)}
              >
                <IconPencil size={14} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setEditing(null);
              reset(EMPTY);
              drawer.open();
            }}
          >
            New campaign
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={campaigns}
        loading={isLoading}
        rowKey={(row: MarketingCampaign) => row.id}
        emptyTitle={isError ? "Campaigns could not be loaded" : "No campaigns yet"}
        emptyDescription={
          isError
            ? "This is not a statement that there are none — the list failed to load."
            : "Create one to start attributing enquiries to where they came from."
        }
      />

      <Drawer
        opened={drawerOpen}
        onClose={close}
        title={editing ? `Edit ${editing.name}` : "New campaign"}
        position="right"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        >
          <TextInput label="Campaign name" error={errors.name?.message} {...register("name")} />
          <Controller
            control={control}
            name="channel"
            render={({ field }) => (
              <Select
                label="Channel"
                data={CAMPAIGN_CHANNEL_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "other")}
                error={errors.channel?.message}
                searchable
                allowDeselect={false}
              />
            )}
          />
          <TextInput
            label="Source"
            description="How the enquiry describes where it came from — matched against contacts."
            error={errors.source?.message}
            {...register("source")}
          />
          <TextInput
            label="External reference"
            description="The campaign id in the ad platform, if there is one."
            error={errors.external_ref?.message}
            {...register("external_ref")}
          />
          <Controller
            control={control}
            name="spend_rupees"
            render={({ field }) => (
              <NumberInput
                label="Spend (₹)"
                description="Entered in rupees; stored in paise."
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={(value) => field.onChange(Number(value) || 0)}
                error={errors.spend_rupees?.message}
              />
            )}
          />
          <Group grow>
            <TextInput
              label="Started on"
              placeholder="YYYY-MM-DD"
              error={errors.started_on?.message}
              {...register("started_on")}
            />
            <TextInput
              label="Ended on"
              placeholder="YYYY-MM-DD"
              error={errors.ended_on?.message}
              {...register("ended_on")}
            />
          </Group>
          <Group justify="flex-end">
            <Button tone="secondary" size="xs" onClick={close} type="button">
              Cancel
            </Button>
            <Button tone="primary" size="xs" type="submit" loading={saveMutation.isPending}>
              {editing ? "Save changes" : "Create campaign"}
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
