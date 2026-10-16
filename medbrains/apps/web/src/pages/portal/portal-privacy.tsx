/**
 * The patient's own privacy page (DPDP Act s.6(4), s.11-14): the notice in
 * their language and the purposes they agree to — changeable here, as easily
 * as at the desk — what the hospital holds about them, and their requests.
 */
import { Checkbox, List, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import type { DpdpNoticeLanguage, DpdpPurpose } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DPDP_LANGUAGES,
  DPDP_NOTICE,
  DPDP_NOTICE_VERSION,
  DPDP_PURPOSES,
} from "@/components/Patient/dpdp-notice";
import { NewPrivacyRequestForm } from "@/components/Patient/NewPrivacyRequestForm";
import { daysLeft, PRIVACY_TYPE_LABEL } from "@/components/Patient/privacy-request-labels";
import { Alert, Badge, Button, Card, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";

export function PortalPrivacy({ token }: { token: string }) {
  const qc = useQueryClient();
  const queryKey = ["portal-privacy", token];
  const privacy = useQuery({ queryKey, queryFn: () => portalService.getPortalPrivacy(token) });
  const current = privacy.data?.consent.history[0];
  const [language, setLanguage] = useState<DpdpNoticeLanguage | null>(null);
  const [choices, setChoices] = useState<DpdpPurpose[] | null>(null);
  const [asking, setAsking] = useState(false);
  const lang = language ?? current?.notice_language ?? "en";
  const chosen = choices ?? current?.purposes ?? [];
  const notice = DPDP_NOTICE[lang];
  const save = useMutation({
    mutationFn: () =>
      portalService.setPortalDpdpConsent(token, {
        notice_version: DPDP_NOTICE_VERSION,
        notice_language: lang,
        purposes: chosen,
      }),
    onSuccess: () => {
      setChoices(null);
      void qc.invalidateQueries({ queryKey });
      toast.success("Your choices are saved");
    },
  });
  const ask = useMutation({
    mutationFn: (data: Parameters<typeof portalService.createPortalPrivacyRequest>[1]) =>
      portalService.createPortalPrivacyRequest(token, data),
    onSuccess: () => {
      setAsking(false);
      void qc.invalidateQueries({ queryKey });
      toast.success("Request sent — the hospital answers within 90 days");
    },
  });

  if (privacy.isError) return <Alert tone="danger">{privacy.error.message}</Alert>;
  const changed = choices !== null;
  return (
    <Stack gap="lg">
      <Card withBorder data-testid="portal-consent">
        <Stack gap="sm">
          <Title order={4}>How the hospital may use your information</Title>
          <SegmentedControl
            aria-label="Language"
            data={DPDP_LANGUAGES}
            value={lang}
            onChange={(v) => setLanguage(v as DpdpNoticeLanguage)}
          />
          <Text size="sm" lang={lang}>
            {notice.collected}
          </Text>
          <Text size="sm" fw={600} lang={lang}>
            {notice.purposesIntro}
          </Text>
          <Checkbox.Group
            aria-label="I agree to"
            value={chosen}
            onChange={(v) => setChoices(v as DpdpPurpose[])}
          >
            <Stack gap="xs" lang={lang}>
              {DPDP_PURPOSES.map((p) => (
                <Checkbox key={p} value={p} label={notice.purposes[p]} />
              ))}
            </Stack>
          </Checkbox.Group>
          <Text size="xs" c="dimmed" lang={lang}>
            {notice.rights}
          </Text>
          <Button
            tone="primary"
            disabled={!changed}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save my choices
          </Button>
          {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
        </Stack>
      </Card>

      <Card withBorder data-testid="portal-held">
        <Title order={4} mb="xs">
          What the hospital holds about you
        </Title>
        <List size="sm">
          {(privacy.data?.held.held ?? [])
            .filter((h) => h.count > 0)
            .map((h) => (
              <List.Item key={h.category}>
                {h.category}: {h.count}
              </List.Item>
            ))}
        </List>
      </Card>

      <Card withBorder data-testid="portal-requests">
        <Stack gap="sm">
          <Title order={4}>Your requests</Title>
          {(privacy.data?.requests ?? []).length === 0 && (
            <Text size="sm" c="dimmed">
              You have not made any requests.
            </Text>
          )}
          {(privacy.data?.requests ?? []).map((r) => (
            <Stack key={r.id} gap={2}>
              <Text size="sm" fw={600}>
                {PRIVACY_TYPE_LABEL.get(r.request_type)}
              </Text>
              {r.status === "open" ? (
                <Badge tone="info">Answer due within {Math.max(daysLeft(r.due_at), 0)} days</Badge>
              ) : (
                <Text size="sm">
                  {r.status === "completed" ? "Done" : "Refused"}: {r.decision}
                </Text>
              )}
            </Stack>
          ))}
          {asking ? (
            <NewPrivacyRequestForm
              byPatient
              patientId=""
              saving={ask.isPending}
              error={ask.error}
              onSubmit={({
                request_type,
                details,
                nominee_name,
                nominee_relation,
                nominee_contact,
              }) =>
                ask.mutate({
                  request_type,
                  details,
                  nominee_name,
                  nominee_relation,
                  nominee_contact,
                })
              }
            />
          ) : (
            <Button tone="secondary" onClick={() => setAsking(true)}>
              Make a request
            </Button>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
