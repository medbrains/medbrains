import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { StoreOrderLine } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Button,
  Input,
  Modal,
  SegmentedControl,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";

const schema = z
  .object({
    substitute_item_id: z.string().min(1, "Choose the substitute"),
    reason: z.string().trim().min(1, "Say why"),
    method: z.enum(["sign_off", "phone"]),
    phone_note: z.string(),
    patient_agreed_by_phone: z.string(),
  })
  .refine((v) => v.method !== "phone" || v.phone_note.trim().length > 0, {
    path: ["phone_note"],
    message: "Write down what the doctor agreed",
  });
type Form = z.infer<typeof schema>;

interface SubstitutePanelProps {
  orderId: string;
  line: StoreOrderLine | null;
  onClose: () => void;
}

/**
 * A substitute for a line the pharmacy can't fill: only a match (same salt,
 * strength, form and release type) is offered, and it goes to the
 * prescribing doctor — their sign-off queue, or a phone agreement they
 * confirm within 24 hours. The patient consents in the portal, or here when
 * they agreed on the phone.
 */
export function SubstitutePanel({ orderId, line, onClose }: SubstitutePanelProps) {
  return (
    <Modal opened={line !== null} onClose={onClose} title="Find a substitute" size="lg">
      {line && <PanelBody key={line.line_id} orderId={orderId} line={line} onDone={onClose} />}
    </Modal>
  );
}

function PanelBody({
  orderId,
  line,
  onDone,
}: {
  orderId: string;
  line: StoreOrderLine;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const options = useQuery({
    queryKey: ["storefront-substitutes", orderId, line.catalog_item_id],
    queryFn: () => storefrontService.listStorefrontSubstitutes(orderId, line.catalog_item_id),
  });
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      substitute_item_id: "",
      reason: "Out of stock",
      method: "sign_off",
      phone_note: "",
      patient_agreed_by_phone: "",
    },
  });
  const method = useWatch({ control, name: "method" });
  const propose = useMutation({
    mutationFn: (v: Form) =>
      storefrontService.proposeStorefrontSubstitution(orderId, {
        catalog_item_id: line.catalog_item_id,
        substitute_item_id: v.substitute_item_id,
        reason: v.reason,
        method: v.method,
        ...(v.method === "phone" ? { phone_note: v.phone_note } : {}),
        ...(v.patient_agreed_by_phone.trim()
          ? { patient_agreed_by_phone: v.patient_agreed_by_phone }
          : {}),
      }),
    onSuccess: () => {
      toast.success("The doctor and the patient will be asked", { title: "Substitute proposed" });
      void queryClient.invalidateQueries({ queryKey: ["storefront-orders"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not proposed" }),
  });

  if (options.isError) {
    return (
      <Alert tone="danger" title="Substitutes could not be loaded">
        This is not "no substitutes". Try again in a moment.
      </Alert>
    );
  }
  if (options.data?.blocked) {
    return (
      <Alert tone="warning" title="This medicine is never substituted">
        {options.data.blocked}. Offer the outside-pharmacy print instead.
      </Alert>
    );
  }
  const choices = (options.data?.candidates ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} · ${c.price ? `₹${c.price}` : "unpriced"} · ${c.stock === "out" ? "out of stock" : "in stock"}`,
    disabled: c.stock === "out",
  }));
  return (
    <Stack component="form" gap="sm" onSubmit={handleSubmit((v) => propose.mutate(v))}>
      <Text size="sm">
        Instead of{" "}
        <Text span fw={600}>
          {line.drug_name}
        </Text>{" "}
        × {line.quantity}
      </Text>
      {options.data && choices.length === 0 && (
        <Alert tone="info" title="No matching medicine in stock">
          Nothing here has the same salt, strength, form and release type.
        </Alert>
      )}
      <Controller
        control={control}
        name="substitute_item_id"
        render={({ field, fieldState }) => (
          <Select
            label="Substitute"
            data={choices}
            value={field.value || null}
            onChange={(v) => field.onChange(v ?? "")}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="reason"
        render={({ field, fieldState }) => (
          <Input label="Why" {...field} error={fieldState.error?.message} />
        )}
      />
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <SegmentedControl
            aria-label="How the doctor decides"
            data={[
              { value: "sign_off", label: "Doctor's sign-off queue" },
              { value: "phone", label: "Doctor agreed by phone" },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {method === "phone" && (
        <Controller
          control={control}
          name="phone_note"
          render={({ field, fieldState }) => (
            <TextArea
              label="What the doctor said, and when"
              description="The doctor must confirm in their sign-offs within 24 hours, or the line goes back"
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="patient_agreed_by_phone"
        render={({ field }) => (
          <Input
            label="The patient agreed on the phone"
            description="Leave empty and the patient is asked in the portal"
            {...field}
          />
        )}
      />
      <Button type="submit" tone="primary" loading={propose.isPending}>
        Propose substitute
      </Button>
    </Stack>
  );
}
