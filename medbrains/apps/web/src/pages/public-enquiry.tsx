/**
 * Ask the hospital a question, without an account.
 *
 * Every enquiry in the system arrives by telephone, because a phone call is
 * the only way one can arrive. So the funnel measures one channel while the
 * spend is attributed across all of them: a campaign driving a hundred form
 * fills and thirty calls is credited with thirty enquiries, and the
 * cost-per-enquiry it reports is more than three times the truth.
 *
 * One column, no wizard. Somebody abandoning this halfway is a phone call to
 * reception, which is the outcome the page exists to avoid.
 *
 * The message field is labelled for logistics — when they want to come, which
 * department — rather than inviting symptoms. It cannot be prevented, but it
 * need not be invited: what lands here is enquiry text and never becomes part
 * of a clinical record.
 */

import { Stack, Text, Textarea, TextInput, Title, VisuallyHidden } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Alert, Button, Card } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

const MAX_MESSAGE = 2_000;

export function PublicEnquiryPage() {
  const { tenantCode = "" } = useParams<{ tenantCode: string }>();
  const [params] = useSearchParams();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot. Hidden from people, filled by the cheapest bots. Never shown,
  // never focusable, and excluded from the tab order.
  const [website, setWebsite] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      marketingService.submitPublicEnquiry({
        tenant_code: tenantCode,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        message: message.trim() || undefined,
        // Whatever the landing page carried, so the campaign gets credit for
        // the enquiry it produced.
        campaign_ref: params.get("campaign") ?? undefined,
        external_ref: params.get("gclid") ?? params.get("utm_source") ?? undefined,
        source: params.get("utm_medium") ?? undefined,
        website: website || undefined,
      }),
  });

  const reachable = phone.trim().length > 0 || email.trim().length > 0;
  const canSubmit = name.trim().length > 0 && reachable && !submit.isPending;

  if (submit.isSuccess) {
    return (
      <Card maw={520} mx="auto" mt="xl">
        <Stack gap="sm">
          <Title order={3}>Thank you</Title>
          <Text>{submit.data.message}</Text>
          <Text size="sm" c="dimmed">
            If it is urgent, please call the hospital directly rather than waiting for us to ring
            back.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card maw={520} mx="auto" mt="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={3}>Ask us a question</Title>
          <Text size="sm" c="dimmed">
            Leave your details and someone from the hospital will call you back.
          </Text>
        </Stack>

        {submit.isError && (
          <Alert tone="danger" title="We could not send that">
            {/* The server's message is written for the person reading it —
                "please leave a phone number or an email so we can reply" —
                so it is shown rather than replaced with a generic failure. */}
            {submit.error instanceof Error
              ? submit.error.message
              : "Something went wrong. Please try again, or call the hospital directly."}
          </Alert>
        )}

        <TextInput
          label="Your name"
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <TextInput
          label="Phone number"
          placeholder="10-digit mobile"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
        />
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        {!reachable && (name.length > 0 || email.length > 0) && (
          <Text size="xs" c="dimmed">
            Please give a phone number or an email, so there is a way to reply.
          </Text>
        )}

        <Textarea
          label="What can we help with?"
          description="Which department, and when suits you. Please do not describe symptoms here."
          autosize
          minRows={3}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
        />

        {/* Hidden from everyone who is not a bot. VisuallyHidden rather than
            display:none, with tabIndex -1 and aria-hidden so a screen reader
            never announces it and a keyboard never lands on it. */}
        <VisuallyHidden>
          <TextInput
            label="Website"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.currentTarget.value)}
          />
        </VisuallyHidden>

        <Button
          tone="primary"
          disabled={!canSubmit}
          loading={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Send
        </Button>

        <Text size="xs" c="dimmed">
          We will use these details only to answer your enquiry.
        </Text>
      </Stack>
    </Card>
  );
}
