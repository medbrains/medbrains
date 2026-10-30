//! One upsert per Humanex entity. `$1` tenant, `$2` the document, `$3` the
//! system user. Each reads the document as `jsonb` in SQL: Humanex already
//! speaks our column names, enum values and business codes.

use serde_json::Value;

/// Upsert one Humanex document. `$1` tenant, `$2` doc, `$3` system user.
pub fn upsert_sql(entity: &str, doc: &Value) -> Option<&'static str> {
    Some(match entity {
        "departments" => {
            "INSERT INTO departments (tenant_id, code, name, department_type, external_source, external_ref, external_synced_at)
             VALUES ($1, $2->>'code', $2->>'name', ($2->>'department_type')::department_type, 'humanex', $2->>'external_ref', now())
             ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO UPDATE SET
                 name = EXCLUDED.name, department_type = EXCLUDED.department_type,
                 external_source = EXCLUDED.external_source, external_ref = EXCLUDED.external_ref,
                 external_synced_at = now(), updated_at = now()"
        }
        "designations" => {
            "INSERT INTO designations (tenant_id, code, name, level, category, is_active, external_source, external_ref, external_synced_at)
             VALUES ($1, $2->>'code', $2->>'name', coalesce(($2->>'level')::int, 0),
                     coalesce($2->>'category', 'clinical'), coalesce(($2->>'is_active')::boolean, true),
                     'humanex', $2->>'external_ref', now())
             ON CONFLICT (tenant_id, code) DO UPDATE SET
                 name = EXCLUDED.name, level = EXCLUDED.level, category = EXCLUDED.category,
                 is_active = EXCLUDED.is_active, external_source = EXCLUDED.external_source,
                 external_ref = EXCLUDED.external_ref, external_synced_at = now(), updated_at = now()"
        }
        // user_id (MedBrains login link) is never touched by the sync.
        "employees" => {
            "INSERT INTO employees (tenant_id, employee_code, first_name, last_name, date_of_birth, gender, phone,
                 email, employment_type, status, department_id, designation_id, date_of_joining,
                 date_of_leaving, qualifications, external_source, external_ref, external_synced_at)
             SELECT $1, d->>'employee_code',
                    coalesce(nullif(split_part(trim(d->>'full_name'), ' ', 1), ''), d->>'employee_code'),
                    nullif(trim(substr(trim(d->>'full_name'), length(split_part(trim(d->>'full_name'), ' ', 1)) + 1)), ''),
                    (d->>'date_of_birth')::date, d->>'gender', d->>'phone', d->>'email',
                    (d->>'employment_type')::employment_type, (d->>'status')::employee_status,
                    (SELECT id FROM departments WHERE tenant_id = $1 AND code = d->>'department_code' AND deleted_at IS NULL),
                    (SELECT id FROM designations WHERE tenant_id = $1 AND code = d->>'designation_code'),
                    coalesce((d->>'date_of_joining')::date, current_date), (d->>'date_of_leaving')::date,
                    coalesce(d->'qualifications', '[]'::jsonb), 'humanex', d->>'external_ref', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
                 first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                 date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender, phone = EXCLUDED.phone,
                 email = EXCLUDED.email, employment_type = EXCLUDED.employment_type, status = EXCLUDED.status,
                 department_id = EXCLUDED.department_id, designation_id = EXCLUDED.designation_id,
                 date_of_joining = EXCLUDED.date_of_joining, date_of_leaving = EXCLUDED.date_of_leaving,
                 qualifications = EXCLUDED.qualifications, external_source = EXCLUDED.external_source,
                 external_ref = EXCLUDED.external_ref, external_synced_at = now(), updated_at = now()"
        }
        "credentials" => {
            "INSERT INTO employee_credentials (tenant_id, employee_id, credential_type, issuing_body, registration_no,
                 state_code, issued_date, expiry_date, status, verified_at, external_source, external_ref, external_synced_at)
             SELECT $1, (SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = d->>'employee_code'),
                    (d->>'credential_type')::credential_type, coalesce(d->>'issuing_body', ''),
                    coalesce(d->>'registration_no', ''), d->>'state_code', (d->>'issued_date')::date,
                    (d->>'expiry_date')::date, (d->>'status')::credential_status, (d->>'verified_at')::timestamptz,
                    'humanex', d->>'external_ref', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, external_source, external_ref) WHERE external_ref IS NOT NULL DO UPDATE SET
                 credential_type = EXCLUDED.credential_type, issuing_body = EXCLUDED.issuing_body,
                 registration_no = EXCLUDED.registration_no, state_code = EXCLUDED.state_code,
                 issued_date = EXCLUDED.issued_date, expiry_date = EXCLUDED.expiry_date,
                 status = EXCLUDED.status, verified_at = EXCLUDED.verified_at,
                 external_synced_at = now(), updated_at = now()"
        }
        "shifts" => {
            "INSERT INTO shift_definitions (tenant_id, code, name, shift_type, start_time, end_time, break_minutes,
                 is_night, external_source, external_ref, external_synced_at)
             VALUES ($1, $2->>'code', $2->>'name', ($2->>'shift_type')::shift_type, ($2->>'start_time')::time,
                     ($2->>'end_time')::time, coalesce(($2->>'break_minutes')::int, 0),
                     coalesce(($2->>'is_night')::boolean, false), 'humanex', $2->>'external_ref', now())
             ON CONFLICT (tenant_id, code) DO UPDATE SET
                 name = EXCLUDED.name, shift_type = EXCLUDED.shift_type, start_time = EXCLUDED.start_time,
                 end_time = EXCLUDED.end_time, break_minutes = EXCLUDED.break_minutes, is_night = EXCLUDED.is_night,
                 external_source = EXCLUDED.external_source, external_ref = EXCLUDED.external_ref,
                 external_synced_at = now(), updated_at = now()"
        }
        "leaves" => {
            "INSERT INTO leave_requests (tenant_id, employee_id, leave_type, start_date, end_date, days, is_half_day,
                 reason, status, external_source, external_ref, external_synced_at)
             SELECT $1, (SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = d->>'employee_code'),
                    (d->>'leave_type')::leave_type, (d->>'start_date')::date, (d->>'end_date')::date,
                    (d->>'days')::numeric, coalesce((d->>'is_half_day')::boolean, false), d->>'reason',
                    (d->>'status')::leave_status, 'humanex', d->>'external_ref', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, external_source, external_ref) WHERE external_ref IS NOT NULL DO UPDATE SET
                 leave_type = EXCLUDED.leave_type, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
                 days = EXCLUDED.days, is_half_day = EXCLUDED.is_half_day, reason = EXCLUDED.reason,
                 status = EXCLUDED.status, external_synced_at = now(), updated_at = now()"
        }
        "leave_balances" => {
            "INSERT INTO leave_balances (tenant_id, employee_id, leave_type, year, opening, earned, used, balance,
                 external_source, external_synced_at)
             SELECT $1, (SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = d->>'employee_code'),
                    (d->>'leave_type')::leave_type, (d->>'year')::int, (d->>'opening')::numeric,
                    (d->>'earned')::numeric, (d->>'used')::numeric, (d->>'balance')::numeric, 'humanex', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, employee_id, leave_type, year) DO UPDATE SET
                 opening = EXCLUDED.opening, earned = EXCLUDED.earned, used = EXCLUDED.used,
                 balance = EXCLUDED.balance, external_source = EXCLUDED.external_source,
                 external_synced_at = now(), updated_at = now()"
        }
        "roster" if doc.get("is_on_call").and_then(Value::as_bool) == Some(true) => {
            "INSERT INTO on_call_schedules (tenant_id, employee_id, department_id, schedule_date, start_time, end_time,
                 is_primary, contact_number, created_by, external_source, external_ref, external_synced_at)
             SELECT $1, (SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = d->>'employee_code'),
                    (SELECT id FROM departments WHERE tenant_id = $1 AND code = d->>'department_code' AND deleted_at IS NULL),
                    (d->>'schedule_date')::date, (d->>'start_time')::time, (d->>'end_time')::time,
                    coalesce((d->>'is_primary')::boolean, true), d->>'contact_number', $3,
                    'humanex', d->>'external_ref', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, external_source, external_ref) WHERE external_ref IS NOT NULL DO UPDATE SET
                 department_id = EXCLUDED.department_id, schedule_date = EXCLUDED.schedule_date,
                 start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, is_primary = EXCLUDED.is_primary,
                 contact_number = EXCLUDED.contact_number, external_synced_at = now(), updated_at = now()"
        }
        "roster" => {
            "INSERT INTO duty_rosters (tenant_id, employee_id, department_id, shift_id, roster_date, created_by,
                 external_source, external_ref, external_synced_at)
             SELECT $1, (SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = d->>'employee_code'),
                    (SELECT id FROM departments WHERE tenant_id = $1 AND code = d->>'department_code' AND deleted_at IS NULL),
                    (SELECT id FROM shift_definitions WHERE tenant_id = $1 AND code = d->>'shift_code'),
                    (d->>'roster_date')::date, $3, 'humanex', d->>'external_ref', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, employee_id, roster_date) DO UPDATE SET
                 department_id = EXCLUDED.department_id, shift_id = EXCLUDED.shift_id,
                 external_source = EXCLUDED.external_source, external_ref = EXCLUDED.external_ref,
                 external_synced_at = now(), updated_at = now()"
        }
        // Humanex-derived attendance never overwrites a row MedBrains
        // recorded itself (self-service shift sessions, manual entries).
        "attendance" => {
            "INSERT INTO attendance_records (tenant_id, employee_id, attendance_date, shift_id, check_in, check_out,
                 is_late, late_minutes, is_early_out, early_minutes, overtime_minutes, status, source,
                 recorded_by, external_source, external_synced_at)
             SELECT $1, (SELECT id FROM employees WHERE tenant_id = $1 AND employee_code = d->>'employee_code'),
                    (d->>'attendance_date')::date,
                    (SELECT id FROM shift_definitions WHERE tenant_id = $1 AND code = d->>'shift_code'),
                    (d->>'check_in')::timestamptz, (d->>'check_out')::timestamptz,
                    coalesce((d->>'is_late')::boolean, false), coalesce((d->>'late_minutes')::int, 0),
                    coalesce((d->>'is_early_out')::boolean, false), coalesce((d->>'early_minutes')::int, 0),
                    coalesce((d->>'overtime_minutes')::int, 0), d->>'status', 'humanex', $3, 'humanex', now()
             FROM (SELECT $2::jsonb AS d) x
             ON CONFLICT (tenant_id, employee_id, attendance_date) DO UPDATE SET
                 shift_id = EXCLUDED.shift_id, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
                 is_late = EXCLUDED.is_late, late_minutes = EXCLUDED.late_minutes,
                 is_early_out = EXCLUDED.is_early_out, early_minutes = EXCLUDED.early_minutes,
                 overtime_minutes = EXCLUDED.overtime_minutes, status = EXCLUDED.status,
                 external_synced_at = now(), updated_at = now()
             WHERE attendance_records.source = 'humanex'"
        }
        _ => return None,
    })
}

/// The business key a failed row is reported under.
pub fn record_key(entity: &str, doc: &Value) -> String {
    let f = |k: &str| doc.get(k).and_then(Value::as_str).unwrap_or("");
    match entity {
        "departments" | "designations" | "shifts" => f("code").into(),
        "employees" => f("employee_code").into(),
        "attendance" => format!("{}:{}", f("employee_code"), f("attendance_date")),
        _ => doc
            .get("external_ref")
            .and_then(Value::as_str)
            .map(String::from)
            .unwrap_or_else(|| f("employee_code").into()),
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::{record_key, upsert_sql};
    use serde_json::json;

    #[test]
    fn roster_routes_on_call_rows_to_on_call_table() {
        let duty = json!({"employee_code": "A1", "is_on_call": false});
        let call = json!({"employee_code": "A1", "is_on_call": true});
        assert!(
            upsert_sql("roster", &duty)
                .unwrap()
                .contains("duty_rosters")
        );
        assert!(
            upsert_sql("roster", &call)
                .unwrap()
                .contains("on_call_schedules")
        );
        assert!(upsert_sql("bogus", &duty).is_none());
    }

    #[test]
    fn record_keys_use_business_codes() {
        assert_eq!(
            record_key("employees", &json!({"employee_code": "AMCH1"})),
            "AMCH1"
        );
        assert_eq!(
            record_key(
                "attendance",
                &json!({"employee_code": "AMCH1", "attendance_date": "2026-10-05"})
            ),
            "AMCH1:2026-10-05"
        );
        assert_eq!(record_key("leaves", &json!({"external_ref": "x"})), "x");
    }
}
