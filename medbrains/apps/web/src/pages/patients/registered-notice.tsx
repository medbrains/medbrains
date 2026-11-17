import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { TFunction } from "i18next";
import { OpdCardPrintMenu } from "@/components/Print/OpdCardPrintMenu";

/**
 * Long enough to reach for the printer while the patient is still at the
 * desk; hovering the notice pauses it.
 */
const REGISTERED_NOTICE_MS = 20_000;

export interface RegisteredNotice {
  title: string;
  message: string;
  color: string;
  patientId: string;
  /** The OPD visit registration opened, if it opened one. */
  encounterId?: string;
  /** The visit's token; null when the queue refused one. */
  tokenNumber?: string | null;
}

/**
 * The "patient registered" notice, with the token ticket and ID card prints on it.
 *
 * Registration navigates straight on to the visit or the record, so the
 * notice is the success state that survives the move; both are printed
 * from it while the patient is still standing at the counter.
 */
export function showRegisteredNotice({
  message,
  patientId,
  encounterId,
  tokenNumber,
  ...rest
}: RegisteredNotice) {
  notifications.show({
    ...rest,
    autoClose: REGISTERED_NOTICE_MS,
    message: (
      <Stack gap="xs">
        <Text size="sm">{message}</Text>
        <Group>
          <OpdCardPrintMenu patientId={patientId} encounterId={encounterId} token={tokenNumber} />
        </Group>
      </Stack>
    ),
  });
}

export interface RegistrationOutcome {
  uhid: string;
  /** Why the queue gave the visit no number (outside its hours, paused, full). */
  tokenRefused?: string | null;
  /** Why the visit could not be queued at all. */
  queueWarning?: string;
  tokenNumber?: string | null;
}

/**
 * What the notice says. A refused token says why, so the desk can tell the
 * patient when to return; a queue failure is a warning, not a success.
 */
export function registeredNoticeText(t: TFunction, outcome: RegistrationOutcome) {
  const { uhid, tokenRefused, queueWarning, tokenNumber } = outcome;
  if (tokenRefused) {
    return {
      title: t("notify.patientRegisteredNoToken"),
      message: t("notify.patientRegisteredTokenRefused", { uhid, reason: tokenRefused }),
      color: "warning",
    };
  }
  if (queueWarning) {
    return {
      title: t("notify.patientRegisteredOpdQueuePending"),
      message: t("notify.patientRegisteredQueueWarning", { queueWarning, uhid }),
      color: "warning",
    };
  }
  return {
    title: t("notify.patientRegistered"),
    message: tokenNumber
      ? t("notify.patientRegisteredWithToken", { token: tokenNumber, uhid })
      : t("notify.patientRegisteredWithUhid", { uhid }),
    color: "success",
  };
}
