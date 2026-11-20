# Email reports — per-hospital servers

Last reviewed 2026-11-17. Two emails from the standalone deploy kit (`deploy/standalone/`), built from shell, SQL and
systemd only, so they run on whatever version a hospital is on.

| Email | Sent | To | Units |
|---|---|---|---|
| Backup summary | after every successful `medbrains-pg-backup` (nightly, and before each re-deploy) | `BACKUP_REPORT_TO` | `medbrains-backup-report@success` (`OnSuccess=`) |
| Backup failure | at once, beside the SNS page from `medbrains-alert@` (that page still fires) | `BACKUP_REPORT_TO` | `medbrains-backup-report@failure` (`OnFailure=`) |
| OPD daily report | 21:00 hospital time (`DAILY_REPORT_ONCALENDAR`) | `DAILY_REPORT_TO` | `medbrains-daily-report.timer` |

Both go through `medbrains-send-mail`, which uses curl and the **same SMTP settings as the server's own mail**
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`):
SES SMTP on the AWS tiers (`SES-PRODUCTION-ACCESS.md`), the hospital's own relay anywhere else. The password is
only ever in `/etc/medbrains/env` (mode 600) and reaches curl on stdin, never on a command line.

**Failure is never silent.** If a report email cannot be sent, the unit exits non-zero and its `OnFailure=` pages
through SNS (`ALERT_TOPIC_ARN`). On a tier with no SNS topic that page is only the journal, so set one where you can.

## Privacy rule: counts only

The OPD report carries **counts only: never a patient name, phone number, UHID, ABHA or any other identifier.** It is
enforced twice:

1. The SQL selects only counts, plus department names and doctor display names (staff, not patients).
2. It connects as `medbrains_report`, a read-only role (`default_transaction_read_only`, `NOBYPASSRLS`) that is
   granted SELECT on **count columns only**: `encounters` (ids, type, status, department, doctor, date, created,
   deleted, dummy), `patients` (id, tenant, created, deleted, merged), `departments`/`users` (id, tenant, name),
   `tenants`/`hospital_groups` (what the RLS function `app_visible_tenants()` reads). No identifier column is
   readable by the role, so a changed query cannot leak one either. Row level security applies with
   `app.tenant_id` set per hospital, the same way the app sets it; decoy patients stay hidden by their policy.

Do not add a column grant to this role without a written reason in `DECISIONS.md`.

## What the OPD report counts

Matches the management KPIs (`crates/medbrains-dashboard/src/management_kpis/catalog.rs`), in the hospital's time
zone (`tenants.timezone`):

- **OPD visits**: `encounters` with `encounter_type = 'opd'` on `encounter_date`, not deleted, not cancelled,
  not simulator rows (`is_dummy`).
- **New registrations**: `patients.created_at` that day, not deleted, not a merged duplicate.
- **Repeat patients**: patients seen that day who had any earlier real visit (any encounter type).
- **By department / by doctor**, each against **yesterday** and the **same weekday last week**.
- **Busiest hour**: the clock hour with most OPD visits created today.

If any query fails, the email says **"The daily report couldn't be generated"** with the error class (login
refused, unreachable, permission denied, schema mismatch, timed out) and no figures, and the unit fails. A report of
zeros would read as a fact about the hospital.

Each active hospital in the database gets its own email, subject `[<Hospital>] OPD daily report <YYYY-MM-DD>`.

## Setup (operator, on the server)

1. Put the SMTP settings in `/etc/medbrains/env` if the server's own mail is not configured yet (`env.example`,
   "Email reports"). On SES: `terraform output -raw smtp_password` piped straight in, never pasted.
2. Add the recipients:

   ```
   BACKUP_REPORT_TO=it-head@example-hospital.org
   DAILY_REPORT_TO=md@example-hospital.org,admin@example-hospital.org
   # optional, systemd calendar syntax in the hospital's zone:
   DAILY_REPORT_ONCALENDAR="*-*-* 21:00:00 Asia/Kolkata"
   ```

3. Re-run `install.sh` (it installs the scripts and units, creates `medbrains_report`, writes
   `REPORT_DATABASE_URL` and enables the timer), or by hand:

   ```
   sudo bash deploy/standalone/db-roles.sh --report /etc/medbrains/env
   sudo systemctl daemon-reload
   sudo systemctl enable --now medbrains-daily-report.timer
   ```

4. After each restore drill on the operator's machine, copy the last line it prints into `/etc/medbrains/env`:
   `RESTORE_DRILL_LAST="2026-11-17 passed (<backup name>)"`. The server cannot see the drill (it cannot read its own
   backups, by design), so this is what the backup summary shows.

Needs systemd 249+ for `OnSuccess=` (Ubuntu 22.04 and later).

## Test

```
# Print the emails, send nothing (as root, with the env loaded):
sudo bash -c 'set -a; . /etc/medbrains/env; . /etc/medbrains/.compose-env 2>/dev/null; set +a
  medbrains-daily-report --print
  medbrains-backup-report --success --print
  medbrains-backup-report --failure --print'

# Send for real, through the units the timers use:
sudo systemctl start medbrains-daily-report.service
sudo systemctl start medbrains-backup-report@success.service
journalctl -u medbrains-daily-report -u 'medbrains-backup-report@*' -n 30 --no-pager
systemctl list-timers medbrains-daily-report.timer
```

`--dry-run` is the same as `--print`. A wrong SMTP password shows as a failed unit and an SNS page, not as silence.
