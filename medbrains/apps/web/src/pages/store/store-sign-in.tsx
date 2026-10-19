import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { PortalPerson, StoreNewCustomer } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Select, TextArea } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { type StoredPortalSession, storePortalSession } from "../portal/portal-session";
import { personLabel } from "./storefront";

/** Digits in a phone number, at least and at most, as the server checks. */
const PHONE_DIGITS = { min: 10, max: 15 };

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  address: z.string().trim().min(5, "Enter your address"),
  pincode: z.string().trim(),
  gender: z.string(),
});
type Details = z.infer<typeof detailsSchema>;

interface StoreSignInProps {
  tenantCode: string;
  onSignedIn: (session: StoredPortalSession) => void;
}

/**
 * Sign in to order with a mobile and a code. Somebody new gives their name
 * and address; a family sharing one mobile picks who is ordering — the
 * pharmacy never picks for them.
 */
export function StoreSignIn({ tenantCode, onSignedIn }: StoreSignInProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [people, setPeople] = useState<PortalPerson[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [needsDetails, setNeedsDetails] = useState(false);
  const digits = phone.replace(/\D/g, "").length;

  const send = useMutation({
    mutationFn: () => portalService.requestStoreCode(tenantCode, phone.trim()),
    onSuccess: () => setSent(true),
  });
  const signIn = useMutation({
    mutationFn: (customer?: StoreNewCustomer) =>
      portalService.storeSignIn(tenantCode, {
        phone: phone.trim(),
        code: code.trim(),
        ...(chosen ? { patient_id: chosen } : {}),
        ...(customer ? { customer } : {}),
      }),
    onSuccess: (result) => {
      if (result.session) onSignedIn(storePortalSession(result.session));
      setNeedsDetails(result.needs_details);
      setPeople(result.choose);
    },
  });
  const failed = send.error ?? signIn.error;

  return (
    <Stack gap="sm">
      <Text size="sm">Sign in with your mobile number to order. We'll send you a code.</Text>
      <Input
        label="Mobile number"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.currentTarget.value)}
      />
      <Button
        tone={sent ? "secondary" : "primary"}
        loading={send.isPending}
        disabled={digits < PHONE_DIGITS.min || digits > PHONE_DIGITS.max}
        onClick={() => send.mutate()}
      >
        {sent ? "Send a new code" : "Send code"}
      </Button>
      {sent && (
        <Input
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
        />
      )}
      {people.length > 0 && (
        <Select
          label="Who is ordering?"
          description="More than one person uses this mobile."
          data={people.map((p) => ({ value: p.id, label: personLabel(p) }))}
          value={chosen}
          onChange={setChosen}
        />
      )}
      {needsDetails ? (
        <NewCustomerForm loading={signIn.isPending} onSubmit={(c) => signIn.mutate(c)} />
      ) : (
        sent && (
          <Button
            tone="primary"
            loading={signIn.isPending}
            disabled={code.trim().length < 4 || (people.length > 0 && !chosen)}
            onClick={() => signIn.mutate(undefined)}
          >
            Sign in
          </Button>
        )
      )}
      {failed && (
        <Alert tone="warning" title="We couldn't sign you in">
          {failed.message}
        </Alert>
      )}
    </Stack>
  );
}

function NewCustomerForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (c: StoreNewCustomer) => void;
}) {
  const { control, handleSubmit } = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", address: "", pincode: "", gender: "" },
  });
  const submit = handleSubmit((v) =>
    onSubmit({
      name: v.name,
      address: v.address,
      ...(v.pincode ? { pincode: v.pincode } : {}),
      ...(v.gender ? { gender: v.gender as "male" | "female" | "other" } : {}),
    }),
  );
  return (
    <Stack component="form" gap="sm" onSubmit={submit}>
      <Text size="sm">You're new here. Tell us who you are and where you live.</Text>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <Input
            label="Full name"
            required
            autoComplete="name"
            {...field}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="address"
        render={({ field, fieldState }) => (
          <TextArea
            label="Address"
            required
            autoComplete="street-address"
            {...field}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="pincode"
        render={({ field }) => (
          <Input
            label="PIN code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="postal-code"
            {...field}
          />
        )}
      />
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <Select
            label="Gender (optional)"
            clearable
            data={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
              { value: "other", label: "Other" },
            ]}
            value={field.value || null}
            onChange={(v) => field.onChange(v ?? "")}
          />
        )}
      />
      <Button type="submit" tone="primary" loading={loading}>
        Continue
      </Button>
    </Stack>
  );
}
