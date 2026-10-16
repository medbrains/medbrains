/**
 * The jurisdictional police contact every MLC police intimation is sent to
 * (SMS + email, through the outbox). Without it, intimations are recorded but
 * not sent, and each intimation row says so.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Input, toast } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

const CATEGORY = "emergency";
const KEY = "police_contact";
const QUERY_KEY = ["tenant-settings", CATEGORY] as const;

/** A number the SMS gateway accepts: +country digits, or a bare Indian mobile. */
const PHONE = /^(\+\d[\d\s-]{9,17}|\d{10})$/;

const contactSchema = z
  .object({
    station: z.string().trim().min(1, "Name the police station"),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || PHONE.test(v), "Use +91XXXXXXXXXX or a 10-digit mobile"),
    email: z.union([z.literal(""), z.email("Enter a valid email")]),
  })
  .refine((v) => v.phone !== "" || v.email !== "", {
    message: "Give a phone or an email — otherwise nothing can be sent",
    path: ["phone"],
  });
type ContactInput = z.infer<typeof contactSchema>;

function readContact(value: unknown): ContactInput {
  const v = (value ?? {}) as Partial<Record<keyof ContactInput, unknown>>;
  const text = (x: unknown) => (typeof x === "string" ? x : "");
  return { station: text(v.station), phone: text(v.phone), email: text(v.email) };
}

export function PoliceContactSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL_MANAGE);
  const canRead = useHasPermission(P.ADMIN.SETTINGS.READ);
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => tenantSettingsService.getTenantSettings(CATEGORY),
    enabled: canManage && canRead,
  });
  const stored = readContact(settings.data?.find((row) => row.key === KEY)?.value);
  const isConfigured = stored.phone !== "" || stored.email !== "";
  const { control, handleSubmit, formState } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    values: stored,
  });
  const save = useMutation({
    mutationFn: (value: ContactInput) =>
      tenantSettingsService.updateTenantSetting({ category: CATEGORY, key: KEY, value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Police intimations will be sent to this contact.", {
        title: "Police contact saved",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the police contact" }),
  });

  if (!canManage || !canRead) return null;

  return (
    <Card withBorder padding="md">
      <Stack
        component="form"
        gap="sm"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        aria-label="Police station contact"
      >
        <Text fw={700}>Police station contact for MLC intimations</Text>
        {settings.isError ? (
          <Alert tone="danger">
            The police contact could not be loaded. This does not mean none is set — retry.
          </Alert>
        ) : (
          !settings.isLoading &&
          !isConfigured && (
            <Alert tone="warning">
              No police contact is configured. Police intimations are recorded but not sent.
            </Alert>
          )
        )}
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {(["station", "phone", "email"] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <Input
                  label={{ station: "Police station", phone: "SMS number", email: "Email" }[name]}
                  required={name === "station"}
                  {...field}
                  error={formState.errors[name]?.message}
                />
              )}
            />
          ))}
        </SimpleGrid>
        <Button type="submit" tone="primary" loading={save.isPending} disabled={settings.isError}>
          Save police contact
        </Button>
      </Stack>
    </Card>
  );
}
