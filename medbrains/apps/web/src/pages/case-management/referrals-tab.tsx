// Case-management ReferralsTab — split from case-management.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CaseReferralFormInput, CaseReferralUpdateFormInput } from "@medbrains/schemas";
import { caseReferralFormSchema, caseReferralUpdateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CaseReferral,
  CreateCaseReferralRequest,
  UpdateCaseReferralRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  caseOptionalText,
  caseReferralStatusOptions,
  caseReferralTypeOptions,
  toCaseReferralStatusFormValue,
} from "@/forms/case-management.form";
import { caseManagementService } from "@/services/case-management.service";
import { truncate } from "./shared";

const REFERRAL_STATUS_COLORS: Record<string, BadgeTone> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  completed: "success",
  cancelled: "neutral",
};

export function ReferralsTab() {
  const canManage = useHasPermission(P.CASE_MGMT.REFERRALS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [editing, setEditing] = useState<CaseReferral | null>(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["case-referrals"],
    queryFn: () => caseManagementService.listCaseReferrals(),
  });

  const referralForm = useForm<CaseReferralFormInput>({
    resolver: zodResolver(caseReferralFormSchema),
    defaultValues: {
      case_assignment_id: "",
      referral_type: "post_acute",
      referred_to: "",
      facility_name: "",
    },
  });
  const {
    control: referralControl,
    handleSubmit: handleReferralSubmit,
    reset: resetReferral,
    formState: { errors: referralErrors },
  } = referralForm;
  const referralUpdateForm = useForm<CaseReferralUpdateFormInput>({
    resolver: zodResolver(caseReferralUpdateFormSchema),
    defaultValues: {
      status: "",
      outcome: "",
    },
  });
  const {
    control: referralUpdateControl,
    handleSubmit: handleReferralUpdateSubmit,
    reset: resetReferralUpdate,
    formState: { errors: referralUpdateErrors },
  } = referralUpdateForm;

  const createMut = useMutation({
    mutationFn: (data: CreateCaseReferralRequest) => caseManagementService.createCaseReferral(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-referrals"] });
      createHandlers.close();
      resetReferral();
      notifications.show({
        title: "Referral Created",
        message: "Referral recorded",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: UpdateCaseReferralRequest) => {
      if (!editing) return Promise.reject(new Error("No referral selected"));
      return caseManagementService.updateCaseReferral(editing.id, data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-referrals"] });
      editHandlers.close();
      setEditing(null);
      resetReferralUpdate();
      notifications.show({ title: "Updated", message: "Referral updated", color: "success" });
    },
  });

  const submitReferral = (values: CaseReferralFormInput) => {
    const facilityName = caseOptionalText(values.facility_name);
    createMut.mutate({
      case_assignment_id: values.case_assignment_id.trim(),
      referral_type: values.referral_type,
      referred_to: values.referred_to.trim(),
      facility_details: facilityName ? { name: facilityName } : undefined,
    });
  };

  const submitReferralUpdate = (values: CaseReferralUpdateFormInput) => {
    updateMut.mutate({
      status: values.status || undefined,
      outcome: caseOptionalText(values.outcome),
    });
  };

  const columns: Column<CaseReferral>[] = [
    {
      key: "case_assignment_id",
      label: "Assignment",
      render: (r) => <Text size="sm">{truncate(r.case_assignment_id, 8)}</Text>,
    },
    {
      key: "referral_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {caseReferralTypeOptions.find((t) => t.value === r.referral_type)?.label ??
            r.referral_type}
        </Badge>
      ),
    },
    {
      key: "referred_to",
      label: "Referred To",
      render: (r) => <Text size="sm">{r.referred_to}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={REFERRAL_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "outcome",
      label: "Outcome",
      render: (r) => <Text size="sm">{r.outcome ?? "\u2014"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage ? (
          <IconButton
            tone="default"
            size="sm"
            onClick={() => {
              setEditing(r);
              resetReferralUpdate({
                status: toCaseReferralStatusFormValue(r.status),
                outcome: r.outcome ?? "",
              });
              editHandlers.open();
            }}
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Create Referral
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={referrals} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Create Referral"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleReferralSubmit(submitReferral)}>
          <Controller
            name="case_assignment_id"
            control={referralControl}
            render={({ field }) => (
              <TextInput
                label="Case Assignment ID"
                required
                {...field}
                error={referralErrors.case_assignment_id?.message}
              />
            )}
          />
          <Controller
            name="referral_type"
            control={referralControl}
            render={({ field }) => (
              <Select
                label="Referral Type"
                required
                data={caseReferralTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "post_acute")}
                error={referralErrors.referral_type?.message}
              />
            )}
          />
          <Controller
            name="referred_to"
            control={referralControl}
            render={({ field }) => (
              <TextInput
                label="Referred To"
                required
                {...field}
                error={referralErrors.referred_to?.message}
              />
            )}
          />
          <Controller
            name="facility_name"
            control={referralControl}
            render={({ field }) => (
              <TextInput
                label="Facility Name"
                {...field}
                error={referralErrors.facility_name?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Referral
          </Button>
        </Stack>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Edit Referral"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleReferralUpdateSubmit(submitReferralUpdate)}>
          <Controller
            name="status"
            control={referralUpdateControl}
            render={({ field }) => (
              <Select
                label="Status"
                data={caseReferralStatusOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={referralUpdateErrors.status?.message}
              />
            )}
          />
          <Controller
            name="outcome"
            control={referralUpdateControl}
            render={({ field }) => (
              <Textarea label="Outcome" {...field} error={referralUpdateErrors.outcome?.message} />
            )}
          />
          <Button tone="primary" type="submit" loading={updateMut.isPending}>
            Update Referral
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics Tab
// ══════════════════════════════════════════════════════════
