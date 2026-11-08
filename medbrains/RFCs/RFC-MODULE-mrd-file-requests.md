# RFC: MRD file requests (the paper-file wait)

Status: built (migration 1417, `crates/medbrains-mrd/src/file_requests/`).

## The problem

Every hospital that still keeps paper keeps a medical records (MRD) room. When an OPD patient
registers, someone walks to the room, finds the folder and carries it to the clinic. Nothing in the
system asks for it, so the request travels by word of mouth and patients wait 30–60 minutes.

## How the work is done today (research)

- **Requisition.** Registration produces a file requisition (a slip, a phone call, or a list the MRD
  clerk prints every half hour). It names the patient, the MRD number and the clinic.
- **Retrieval.** Files are filed by MRD number, usually terminal-digit, on racks and shelves. The
  runner ("file boy") pulls the folder and leaves an out-guide (tracer card) in its place saying
  where it went. The out-guide is what `mrd_record_movements` already models: issued to a user or
  department, returned later.
- **Pre-pulling.** For booked appointments the MRD pulls the files the evening before, sorted by
  doctor and time, so the morning run is delivery only.
- **Missing and out files.** A folder may be with another clinic (a second visit the same day, an
  admission, a coding query) or simply lost. The out-guide says where it is; a lost file is the
  supervisor's problem, not the runner's.
- **Measure.** NABH treats record retrieval time as an MRD quality indicator (commonly a target of
  15–30 minutes for OPD). It is measured from registration to the file reaching the clinic.
- **Back-scanning.** Hospitals digitising their records scan the files of patients who are coming
  soon first, so the next visit opens on a digital record.

## Scenarios (Given / When / Then)

1. **Walk-in.** Given a patient with a shelved file, when the desk registers an OPD visit, then a
   request is written in the same transaction with the file's rack/shelf/bin, the clinic and the
   doctor, requested now and due in the tenant's due time (default 10 minutes).
2. **Appointment, pre-pulled.** Given a booked appointment tomorrow, when the evening pull list runs
   (or MRD presses Build pull list), then a pre-pulled request due at the slot time is written once;
   when the patient checks in, the visit takes over that request instead of asking again.
3. **File not found / missing.** Given the file is marked missing, the visit's request is written as
   not found. When a runner cannot find a requested file, they mark it not found. Either way the
   supervisors are told; a later pick-up scan still closes it as found.
4. **File out with another clinic.** Given the file's open movement is with another department, the
   queue says "Out with Orthopaedics OPD — ask them to return it to MRD first", and a pick-up scan
   is refused (409, naming the holder) until the clinic returns it. A scan never takes a file out
   of another clinic's hands.
5. **Second visit the same day.** Given the patient already had a visit today, a second visit is a
   second request (the file must travel again); asking again for the same visit returns the same
   request.
6. **Cancellation and day end.** When the visit is cancelled (or the patient is a no-show, or a
   pre-pulled appointment is cancelled), the open request is closed as cancelled. A request still
   open after its visit day is closed as `cancelled` / `day_ended`, so today's queue holds today's
   errands only. Teleconsultation and back-dated visits ask for no file.
7. **Wrong file.** When the runner scans another file's barcode, the scan is refused (409) and
   nothing changes. A file cannot be delivered before it was picked.
8. **Late.** When a request passes its due time, everyone holding `mrd.file_request.supervise` gets
   one in-app notification naming the file number and the clinic (not the patient). With nobody to
   tell, the request stays unescalated and is retried; no hospital gets more than 20 of a pass.
9. **The doctor does not wait.** The consultation shows "File: requested / on the way / arrived /
   not found", or "File: not requested" for a paper file with no request, and nothing for a patient
   with no paper file. Beside it, a summary from the digital record (allergies, recent diagnoses,
   current medicines, abnormal results in the last 90 days), each list saying how many it left out.
   A mental-health diagnosis the doctor may not see (MHCA 2017 s.23) reads "Restricted entry", as on
   the diagnosis list. The consultation is open in every state.
10. **Permission denied.** Without the code, every route answers 403 and the screen sends no read.
    The summary needs `opd.diagnoses.list` and `patients.view`; the MRD officer, who holds the chip's
    code only, is refused it.
    Diagnoses are withheld (with a count) for a role whose `opd.diagnosis` field access is masked
    or hidden.
11. **Outage.** A failed read is shown as a fault with a retry, never as "no files waiting" or as a
    missing chip.

## Permissions

| Code | Who | What |
|---|---|---|
| `mrd.file_request.view` | MRD officer | The queue, pull list, back-scanning order, file wait |
| `mrd.file_request.fulfil` | MRD officer | Scans, not found, build the pull list |
| `mrd.file_request.supervise` | MRD officer | Receives late / not-found escalations |
| `mrd.file_request.status` | Doctor, MRD officer | The consultation chip (nothing clinical) |
| `opd.diagnoses.list` + `patients.view` | Doctor, nurse (existing) | The digital summary |

## Data

`mrd_file_requests` (tenant-scoped, forced RLS, audit trigger, soft delete). SQL functions
`mrd_current_file`, `mrd_file_request_due_minutes`, `mrd_request_file_for_visit`; triggers on
`encounters` (insert; status → cancelled) and `appointments` (status → cancelled / no-show).
Setting: `tenant_settings` category `mrd`, key `file_request_due_minutes`.

## API

| Method | Path | Permission |
|---|---|---|
| GET | `/api/mrd/file-requests[?date=]` | view |
| POST | `/api/mrd/file-requests/{id}/scan` | fulfil |
| POST | `/api/mrd/file-requests/{id}/not-found` | fulfil |
| POST | `/api/mrd/file-requests/pull-list` | fulfil |
| GET | `/api/mrd/file-requests/backscan?days=` | view |
| GET | `/api/mrd/file-requests/delivery-times?from=&to=` | view |
| GET | `/api/mrd/file-requests/by-encounter/{id}` | status + encounter access |
| GET | `/api/mrd/file-requests/by-encounter/{id}/summary` | `opd.diagnoses.list` + `patients.view` + encounter access, audited |

Jobs (`file_requests::jobs::spawn`): escalation every minute (at most 20 per hospital per pass);
day-end close and the pull list every 15 minutes, the pull list from 18:00 on the hospital's clock. KPIs `mrd_file_delivery_minutes` and `mrd_file_delivery_p90_minutes` in
the management catalogue (per OPD).

## UI plan

- **MRD → File room → File requests** (`/mrd#file-requests`). "Waiting now" / "Pull list" segmented
  control. Waiting now: one card per request, soonest due first, refreshed every 15 s: patient,
  UHID and file number (mono), shelf, destination, status badge, a live "N min left / N min late"
  badge, "Out with …" when the file is elsewhere, and the runner's next action (Scan at shelf /
  Scan at clinic / Not found). Cards, not a table, so it works on a phone between the racks
  (checked at 390 px). Scanning opens a small `Modal` whose field takes a barcode scanner's input
  and Enter; a refusal is shown in the modal. Pull list: date picker, Build pull list (fulfil only),
  requests grouped by doctor and slot.
- **MRD → File room → File wait**: median and 90th percentile, hospital / per OPD / per runner,
  over a date range.
- **MRD → Digital MRD → Scan first**: the back-scanning order for the next 7 days.
- **OPD visit → Consultation**: a card at the top with the file chip and the digital summary; the
  case sheet below is unchanged and usable at once.
- States: loading, empty (worded as a fact about the queue), fault (QueryError with retry),
  permission (controls hidden, reads not sent). Seam components only; colour from tones;
  targets ≥ 24 px (buttons are 36 px).

## Not done (named)

- The due time is per hospital, not per clinic.
- "Current medicines" is active prescriptions from the last 90 days: a course's duration is free
  text, so a finished short course shows until it ages out.
- The pull-list hour is fixed at 18:00.
- No outbox handler for a late file; the in-app notification is the delivery.
