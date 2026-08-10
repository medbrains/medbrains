/**
 * Book an appointment without an account.
 *
 * The three endpoints behind this — directory, slots, book — have existed with
 * nothing calling them, so a hospital could not offer online booking however
 * much it wanted to. This is the page that makes them reachable.
 *
 * Built as one scrolling column rather than a wizard. A patient abandoning a
 * booking halfway is a phone call to reception, and a wizard hides how much is
 * left. Everything chosen so far stays on screen.
 *
 * Off by default: the directory 404s unless the hospital has turned public
 * booking on, and this page says so plainly rather than looking broken.
 */

import { Loader, Select, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import type { PublicBookingResponse } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Alert, Button, Card } from "@/components/ui";
import { appointmentsService } from "@/services/appointments.service";
import {
  bookableSlots,
  bookingProblem,
  canRequestOtp,
  groupByDepartment,
  isoDate,
  lastBookableDate,
  OTP_LENGTH,
  slotLabel,
} from "./public-booking-model";

export function PublicBookingPage() {
  const { tenantCode = "" } = useParams<{ tenantCode: string }>();

  const directory = useQuery({
    queryKey: ["public-directory", tenantCode],
    queryFn: () => appointmentsService.getPublicBookableDoctors(tenantCode),
    enabled: Boolean(tenantCode),
    retry: false,
  });

  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [date, setDate] = useState(isoDate(new Date()));
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [booked, setBooked] = useState<PublicBookingResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const doctors = directory.data?.doctors ?? [];
  const otpRequired = directory.data?.otp_required ?? false;
  const groups = useMemo(() => groupByDepartment(doctors), [doctors]);
  const doctor = useMemo(
    () => doctors.find((entry) => entry.doctor_id === doctorId) ?? null,
    [doctors, doctorId],
  );

  const slots = useQuery({
    queryKey: ["public-slots", tenantCode, doctorId, date],
    queryFn: () =>
      appointmentsService.getPublicAppointmentSlots({
        tenant_code: tenantCode,
        doctor_id: doctorId ?? "",
        date,
      }),
    enabled: Boolean(tenantCode && doctorId && date),
    retry: false,
  });

  const open = useMemo(() => bookableSlots(slots.data ?? []), [slots.data]);
  const chosen = open.find((slot) => slot.start_time === slotStart) ?? null;
  const problem = bookingProblem({ patientName, patientPhone, otpRequired, otp });

  const book = useMutation({
    mutationFn: () => {
      if (!doctor || !chosen) {
        throw new Error("Choose a doctor and a time first.");
      }
      return appointmentsService.bookPublicAppointment({
        tenant_code: tenantCode,
        doctor_id: doctor.doctor_id,
        department_id: doctor.department_id,
        appointment_date: date,
        slot_start: chosen.start_time,
        slot_end: chosen.end_time,
        patient_name: patientName.trim(),
        patient_phone: patientPhone.trim(),
        reason: reason.trim() || undefined,
        otp: otpRequired ? otp.replace(/\D/g, "") : undefined,
      });
    },
    onSuccess: setBooked,
    onError: (error: Error) => setFailure(error.message),
  });

  const sendCode = useMutation({
    mutationFn: () =>
      appointmentsService.requestPublicBookingOtp({
        tenant_code: tenantCode,
        patient_phone: patientPhone.trim(),
      }),
    // The server answers the same whether or not it knows the number, so that
    // a stranger cannot use this to test which phones a hospital holds. The
    // page keeps that promise: it never says "sent" as though delivery were
    // confirmed.
    onSuccess: () => {
      setCodeSent(true);
      setFailure(null);
    },
    onError: (error: Error) => setFailure(error.message),
  });

  if (directory.isLoading) {
    return (
      <Frame>
        <Loader />
      </Frame>
    );
  }

  // The directory 404s both for an unknown hospital and for one that has not
  // enabled booking. Saying which would let somebody probe the setting.
  if (directory.isError || doctors.length === 0) {
    return (
      <Frame>
        <Title order={2}>Online booking is not available here</Title>
        <Alert tone="info" title="Please call the hospital">
          This hospital does not take appointments through this page. Reception can book one for
          you.
        </Alert>
      </Frame>
    );
  }

  if (booked) {
    return (
      <Frame>
        <Booked booking={booked} />
      </Frame>
    );
  }

  return (
    <Frame>
      <Title order={2}>Book an appointment</Title>

      <Select
        label="Doctor"
        placeholder="Choose a department and doctor"
        value={doctorId}
        onChange={(value) => {
          setDoctorId(value);
          // A time from the previous doctor's day is not a time in this one's.
          setSlotStart(null);
        }}
        data={groups.map((group) => ({
          group: group.departmentName,
          items: group.doctors.map((entry) => ({
            value: entry.doctor_id,
            label: entry.doctor_name,
          })),
        }))}
        searchable
        w="100%"
      />

      <TextInput
        label="Date"
        type="date"
        value={date}
        min={isoDate(new Date())}
        max={lastBookableDate(new Date())}
        onChange={(event) => {
          setDate(event.currentTarget.value);
          setSlotStart(null);
        }}
        w="100%"
      />

      {doctorId && (
        <SlotPicker
          loading={slots.isLoading}
          failed={slots.isError}
          slots={open}
          selected={slotStart}
          onSelect={setSlotStart}
        />
      )}

      {chosen && (
        <>
          <TextInput
            label="Patient's full name"
            value={patientName}
            onChange={(event) => setPatientName(event.currentTarget.value)}
            autoComplete="name"
            w="100%"
          />
          <TextInput
            label="Mobile number"
            description="The hospital uses this to confirm and to send reminders."
            value={patientPhone}
            onChange={(event) => setPatientPhone(event.currentTarget.value)}
            inputMode="tel"
            autoComplete="tel"
            w="100%"
          />
          {otpRequired && (
            <VerifyPhone
              phone={patientPhone}
              otp={otp}
              onOtp={setOtp}
              codeSent={codeSent}
              sending={sendCode.isPending}
              onSend={() => sendCode.mutate()}
            />
          )}

          <Textarea
            label="Reason for the visit (optional)"
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            autosize
            minRows={2}
            w="100%"
          />

          {failure && (
            <Alert tone="danger" title="We could not book that time">
              {failure}
            </Alert>
          )}

          <Button
            tone="primary"
            size="lg"
            fullWidth
            loading={book.isPending}
            disabled={book.isPending || problem !== null}
            onClick={() => {
              setFailure(null);
              book.mutate();
            }}
          >
            {problem ?? `Book ${slotLabel(chosen.start_time)} with ${doctor?.doctor_name}`}
          </Button>
        </>
      )}
    </Frame>
  );
}

/**
 * Phone verification, when the hospital requires it.
 *
 * The code is requested from this page rather than assumed, because the number
 * being verified is the one just typed — asking earlier would verify a number
 * the patient then corrected.
 *
 * The wording never claims the message arrived. The server deliberately answers
 * identically whether or not it recognises the number, so that nobody can use
 * this to discover which phones a hospital holds, and a page that said "sent"
 * would quietly undo that.
 */
function VerifyPhone({
  phone,
  otp,
  onOtp,
  codeSent,
  sending,
  onSend,
}: {
  phone: string;
  otp: string;
  onOtp: (value: string) => void;
  codeSent: boolean;
  sending: boolean;
  onSend: () => void;
}) {
  return (
    <Stack gap="xs" w="100%">
      <Button
        tone={codeSent ? "secondary" : "primary"}
        fullWidth
        loading={sending}
        disabled={sending || !canRequestOtp(phone)}
        onClick={onSend}
      >
        {codeSent ? "Send the code again" : "Send verification code"}
      </Button>

      {codeSent && (
        <>
          <TextInput
            label="Verification code"
            description={`Enter the ${OTP_LENGTH} digits sent to ${phone}. The code expires in 10 minutes.`}
            value={otp}
            onChange={(event) => onOtp(event.currentTarget.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH + 2}
            w="100%"
          />
          <Text size="xs" c="dimmed">
            If nothing arrives, check the number above and send it again.
          </Text>
        </>
      )}
    </Stack>
  );
}

function SlotPicker({
  loading,
  failed,
  slots,
  selected,
  onSelect,
}: {
  loading: boolean;
  failed: boolean;
  slots: ReturnType<typeof bookableSlots>;
  selected: string | null;
  onSelect: (start: string) => void;
}) {
  if (loading) {
    return <Loader size="sm" />;
  }
  if (failed) {
    return (
      <Alert tone="warning" title="We could not load times for that day">
        Please try another date.
      </Alert>
    );
  }
  if (slots.length === 0) {
    return (
      <Alert tone="info" title="Nothing free that day">
        This doctor has no open times on the date you picked. Try another day.
      </Alert>
    );
  }

  return (
    <Stack gap="xs" w="100%">
      <Text size="sm" fw={600}>
        Available times
      </Text>
      <Stack gap="xs">
        {slots.map((slot) => (
          <Button
            key={slot.start_time}
            tone={selected === slot.start_time ? "primary" : "secondary"}
            fullWidth
            onClick={() => onSelect(slot.start_time)}
            aria-pressed={selected === slot.start_time}
          >
            {slotLabel(slot.start_time)}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}

function Booked({ booking }: { booking: PublicBookingResponse }) {
  return (
    <Card w="100%">
      <Stack align="center" gap="sm" py="md">
        <Title order={3}>You are booked</Title>
        <Text size="lg" ta="center">
          {booking.doctor_name} · {booking.department_name}
        </Text>
        <Text size="xl" fw={700}>
          {booking.appointment_date} at {slotLabel(booking.slot_start)}
        </Text>

        {/*
          The kiosk reads this on arrival. Shown rather than only emailed
          because the phone in the patient's hand is the one thing certain to
          be with them at the door.
        */}
        <QRCodeSVG
          value={booking.qr_code_data}
          size={180}
          level="M"
          role="img"
          aria-label="Show this code at the check-in kiosk"
        />
        <Text size="sm" ta="center">
          Show this code at the check-in kiosk when you arrive.
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          Take a screenshot — this page will not remember your booking.
        </Text>
      </Stack>
    </Card>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Stack align="center" gap="md" p="lg" mx="auto" maw={520} mih="100vh">
      {children}
    </Stack>
  );
}
