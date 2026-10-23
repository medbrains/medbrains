//! Print data routes for Admin/HR forms.
//!
//! Phase 5: Employee ID, Duty Roster, Leave, Attendance, Training, Credentials, Visitor Register.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::Datelike;
use chrono::Utc;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AttendanceRecord, AttendanceSummary, CredentialDetail, DailyAttendance, DayShift,
    DutyRosterPrintData, EmployeeIdCardPrintData, LeaveApplicationPrintData, RosterEntry,
    ShiftDefinition, StaffAttendanceReportPrintData, StaffCredentialFormPrintData,
    TrainingCertificatePrintData, VisitorEntry, VisitorRegisterPrintData,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── Employee ID Card ──────────────────────────────────────────────────────────

/// GET /print-data/employee-id-card/{employee_id}
pub async fn get_employee_id_card_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<EmployeeIdCardPrintData>, AppError> {
    require_permission(&claims, permissions::hr::employees::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct EmployeeRow {
        employee_code: String,
        full_name: String,
        designation: String,
        department_name: String,
        date_of_joining: Option<chrono::NaiveDate>,
        blood_group: Option<String>,
        emergency_contact: Option<String>,
        photo_url: Option<String>,
    }

    let emp = sqlx::query_as::<_, EmployeeRow>(
        r"
        SELECT
            u.employee_code,
            u.full_name,
            COALESCE(d.name, 'Staff') as designation,
            COALESCE(dept.name, 'General') as department_name,
            u.date_of_joining,
            u.blood_group,
            u.emergency_contact,
            u.photo_url
        FROM users u
        LEFT JOIN designations d ON u.designation_id = d.id
        LEFT JOIN departments dept ON u.department_id = dept.id
        WHERE u.id = $1
        ",
    )
    .bind(employee_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(&mut conn, &claims.tenant_id).await?;

    let now = Utc::now();
    let valid_from = now.with_timezone(&tz).format("%d-%m-%Y").to_string();
    let valid_until = (now + chrono::Duration::days(365))
        .with_timezone(&tz)
        .format("%d-%m-%Y")
        .to_string();

    Ok(Json(EmployeeIdCardPrintData {
        employee_id: emp.employee_code.clone(),
        employee_name: emp.full_name,
        designation: emp.designation,
        department: emp.department_name,
        date_of_joining: emp
            .date_of_joining
            .map(|d| d.format("%d-%m-%Y").to_string())
            .unwrap_or_default(),
        blood_group: emp.blood_group,
        emergency_contact: emp.emergency_contact,
        photo_url: emp.photo_url,
        access_zones: vec!["Main Building".to_string(), "Department".to_string()],
        valid_from,
        valid_until,
        barcode_data: emp.employee_code,
        hospital_name: hospital.name,
        hospital_logo_url: hospital.logo_url,
    }))
}

// ── Duty Roster ───────────────────────────────────────────────────────────────

/// GET /print-data/duty-roster/{department_id}/{period}
#[derive(Debug, sqlx::FromRow)]
struct ShiftRow {
    name: String,
    start_time: chrono::NaiveTime,
    end_time: chrono::NaiveTime,
}

#[derive(Debug, sqlx::FromRow)]
struct RosterDayRow {
    employee_id: Uuid,
    roster_date: chrono::NaiveDate,
    is_on_call: Option<bool>,
    shift_code: Option<String>,
}

pub async fn get_duty_roster_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((department_id, period)): Path<(Uuid, String)>,
) -> Result<Json<DutyRosterPrintData>, AppError> {
    require_permission(&claims, permissions::hr::roster::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let dept_name = sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
        .bind(department_id)
        .fetch_optional(&mut *conn)
        .await?
        .unwrap_or_else(|| "Department".to_string());

    let hospital = get_hospital_info(&mut conn, &claims.tenant_id).await?;

    // Parse period (format: YYYY-MM)
    let parts: Vec<&str> = period.split('-').collect();
    let (year, month) = if parts.len() == 2 {
        (
            parts[0].parse::<i32>().unwrap_or(2026),
            parts[1].parse::<u32>().unwrap_or(1),
        )
    } else {
        (2026, 1)
    };

    let period_start = format!("01-{month:02}-{year}");
    let days_in_month = days_in_month(year, month);
    let period_end = format!("{days_in_month:02}-{month:02}-{year}");

    // The hospital's own shifts, not three invented ones.
    //
    // This printed Morning 07:00, Evening 15:00 and Night 23:00 with fixed
    // colours regardless of how the hospital actually runs its day.
    // `shift_definitions` is where its shifts live.
    let shifts = sqlx::query_as!(
        ShiftRow,
        "SELECT name AS \"name!\", start_time AS \"start_time!\", end_time AS \"end_time!\" \
           FROM shift_definitions \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
          ORDER BY start_time",
        claims.tenant_id,
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|row| ShiftDefinition {
        shift_name: row.name,
        start_time: row.start_time.format("%H:%M").to_string(),
        end_time: row.end_time.format("%H:%M").to_string(),
        color_code: None,
    })
    .collect::<Vec<_>>();

    // Get staff in department
    #[derive(sqlx::FromRow)]
    struct StaffRow {
        id: Uuid,
        employee_code: String,
        full_name: String,
        designation: Option<String>,
    }

    let staff = sqlx::query_as::<_, StaffRow>(
        r"
        SELECT
            u.id,
            u.employee_code,
            u.full_name,
            d.name as designation
        FROM users u
        LEFT JOIN designations d ON u.designation_id = d.id
        WHERE u.department_id = $1 AND u.is_active = true
        ORDER BY d.name, u.full_name
        ",
    )
    .bind(department_id)
    .fetch_all(&mut *conn)
    .await?;

    // Who is actually rostered.
    //
    // This used to deal shifts out with `(staff_index + day) % 4`: Morning,
    // Evening, Night, week off, round and round, for every named member of
    // staff for the whole month. A duty roster tells a nurse when to come to
    // work, and is what a hospital shows for its staffing ratios. An invented
    // one is a rota nobody agreed to, printed with their name on it.
    //
    // `duty_rosters` holds the real assignments. A day nobody rostered prints
    // blank, because an empty rota is one that has not been written yet.
    let rostered = sqlx::query_as!(
        RosterDayRow,
        "SELECT r.employee_id AS \"employee_id!\", r.roster_date AS \"roster_date!\", \
                r.is_on_call AS \"is_on_call?\", \
                COALESCE(sd.code, sd.name) AS \"shift_code?\" \
           FROM duty_rosters r \
           LEFT JOIN shift_definitions sd ON sd.id = r.shift_id AND sd.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND r.department_id = $2 \
            AND EXTRACT(YEAR FROM r.roster_date)::int = $3 \
            AND EXTRACT(MONTH FROM r.roster_date)::int = $4 \
            AND r.deleted_at IS NULL",
        claims.tenant_id,
        department_id,
        year,
        i32::try_from(month).unwrap_or(1),
    )
    .fetch_all(&mut *conn)
    .await?;

    let roster_entries: Vec<RosterEntry> = staff
        .into_iter()
        .map(|s| {
            let mine: Vec<&RosterDayRow> =
                rostered.iter().filter(|r| r.employee_id == s.id).collect();
            let schedule: Vec<DayShift> = (1..=days_in_month)
                .map(|day| {
                    let entry = mine.iter().find(|r| Datelike::day(&r.roster_date) == day);
                    DayShift {
                        date: format!("{day:02}-{month:02}-{year}"),
                        // Blank, not "WO". A day with no roster row is a day
                        // nobody rostered, which is not a day off and must not
                        // read as one.
                        shift: entry.map_or_else(String::new, |r| {
                            let code = r.shift_code.clone().unwrap_or_default();
                            if r.is_on_call.unwrap_or(false) {
                                format!("{code} (on call)")
                            } else {
                                code
                            }
                        }),
                        is_off: false,
                    }
                })
                .collect();

            RosterEntry {
                employee_name: s.full_name,
                employee_id: s.employee_code,
                designation: s.designation.unwrap_or_else(|| "Staff".to_string()),
                schedule,
            }
        })
        .collect();

    Ok(Json(DutyRosterPrintData {
        department: dept_name,
        period_start,
        period_end,
        generated_date: Utc::now()
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        generated_by: "System".to_string(),
        shifts,
        roster_entries,
        hospital_name: hospital.name,
    }))
}

// ── Leave Application ─────────────────────────────────────────────────────────

/// GET /print-data/leave-application/{leave_id}
///
/// A `leave_requests` row — what the HR leave screen lists and creates.
pub async fn get_leave_application_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(leave_id): Path<Uuid>,
) -> Result<Json<LeaveApplicationPrintData>, AppError> {
    require_permission(&claims, permissions::hr::leave::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct LeaveRow {
        application_date: String,
        employee_name: String,
        employee_code: String,
        department_name: Option<String>,
        designation: Option<String>,
        leave_type: String,
        leave_from: String,
        leave_to: String,
        total_days: f64,
        reason: Option<String>,
        status: String,
        approver_name: Option<String>,
        approval_date: Option<String>,
        remarks: Option<String>,
    }

    // The final word is the admin's when there is one, else the HOD's.
    let leave = sqlx::query_as::<_, LeaveRow>(
        "SELECT \
           to_char(lr.created_at, 'DD-MM-YYYY') AS application_date, \
           concat_ws(' ', e.first_name, e.last_name) AS employee_name, \
           e.employee_code, \
           d.name AS department_name, \
           des.name AS designation, \
           lr.leave_type::text AS leave_type, \
           to_char(lr.start_date, 'DD-MM-YYYY') AS leave_from, \
           to_char(lr.end_date, 'DD-MM-YYYY') AS leave_to, \
           lr.days::float8 AS total_days, \
           lr.reason, \
           lr.status::text AS status, \
           COALESCE(adm.full_name, hod.full_name) AS approver_name, \
           to_char(COALESCE(lr.admin_action_at, lr.hod_action_at), 'DD-MM-YYYY') \
             AS approval_date, \
           COALESCE(lr.admin_remarks, lr.hod_remarks) AS remarks \
         FROM leave_requests lr \
         JOIN employees e ON e.id = lr.employee_id \
         LEFT JOIN departments d ON d.id = e.department_id \
         LEFT JOIN designations des ON des.id = e.designation_id \
         LEFT JOIN users hod ON hod.id = lr.hod_id \
         LEFT JOIN users adm ON adm.id = lr.admin_id \
         WHERE lr.id = $1 AND lr.tenant_id = $2 AND lr.deleted_at IS NULL",
    )
    .bind(leave_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let hospital = get_hospital_info(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(LeaveApplicationPrintData {
        // ponytail: leave requests carry no application number; the record id is
        // the only reference that exists
        application_number: leave_id.to_string(),
        application_date: leave.application_date,
        employee_name: leave.employee_name,
        employee_id: leave.employee_code,
        department: leave.department_name,
        designation: leave.designation,
        leave_type: leave.leave_type,
        leave_from: leave.leave_from,
        leave_to: leave.leave_to,
        total_days: leave.total_days,
        reason: leave.reason.unwrap_or_default(),
        // Not recorded against the request: `leave_balances` holds today's
        // balance, not the balance on the day this was applied for.
        leave_balance_before: None,
        leave_balance_after: None,
        relieving_officer: None,
        contact_during_leave: None,
        approver_name: leave.approver_name,
        approval_status: leave.status,
        approval_date: leave.approval_date,
        remarks: leave.remarks,
        hospital_name: hospital.name,
    }))
}

// ── Staff Attendance Report ───────────────────────────────────────────────────

/// GET /print-data/staff-attendance/{department_id}/{month}/{year}
#[derive(Debug, sqlx::FromRow)]
struct AttendanceMarkRow {
    employee_id: Uuid,
    attendance_date: chrono::NaiveDate,
    status: String,
    check_in: Option<chrono::DateTime<Utc>>,
    check_out: Option<chrono::DateTime<Utc>>,
    is_late: Option<bool>,
}

pub async fn get_staff_attendance_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((department_id, month, year)): Path<(Uuid, u32, i32)>,
) -> Result<Json<StaffAttendanceReportPrintData>, AppError> {
    require_permission(&claims, permissions::hr::attendance::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let dept_name = sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
        .bind(department_id)
        .fetch_optional(&mut *conn)
        .await?
        .unwrap_or_else(|| "Department".to_string());

    let hospital = get_hospital_info(&mut conn, &claims.tenant_id).await?;

    // Get staff in department
    #[derive(sqlx::FromRow)]
    struct StaffRow {
        id: Uuid,
        employee_code: String,
        full_name: String,
        designation: Option<String>,
    }

    let staff = sqlx::query_as::<_, StaffRow>(
        r"
        SELECT
            u.id,
            u.employee_code,
            u.full_name,
            d.name as designation
        FROM users u
        LEFT JOIN designations d ON u.designation_id = d.id
        WHERE u.department_id = $1 AND u.is_active = true
        ORDER BY u.full_name
        ",
    )
    .bind(department_id)
    .fetch_all(&mut *conn)
    .await?;

    let days = days_in_month(year, month);

    // The attendance that was actually recorded.
    //
    // This used to compute it: `(staff_index + day) % 10` decided present,
    // late, leave or absent, and the check-in time alternated between 08:55
    // and 09:15. It produced a complete, plausible monthly register for named
    // staff — a document that feeds payroll, duty-hour limits and an AEBAS
    // submission — out of arithmetic on a loop counter.
    //
    // `attendance_records` is where the real marks live. A month nobody
    // recorded prints as a month of blanks, which is what an empty register
    // looks like and is a thing a hospital needs to be able to see.
    let marks = sqlx::query_as!(
        AttendanceMarkRow,
        "SELECT employee_id AS \"employee_id!\", attendance_date AS \"attendance_date!\", \
                status::text AS \"status!\", check_in AS \"check_in?\", \
                check_out AS \"check_out?\", is_late AS \"is_late?\" \
           FROM attendance_records \
          WHERE tenant_id = $1 \
            AND EXTRACT(YEAR FROM attendance_date)::int = $2 \
            AND EXTRACT(MONTH FROM attendance_date)::int = $3 \
            AND deleted_at IS NULL",
        claims.tenant_id,
        year,
        i32::try_from(month).unwrap_or(1),
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut total_present = 0;
    let mut total_absent = 0;
    let mut total_leave = 0;

    let attendance_records: Vec<AttendanceRecord> = staff
        .into_iter()
        .map(|s| {
            let mine: Vec<&AttendanceMarkRow> =
                marks.iter().filter(|m| m.employee_id == s.id).collect();
            let mut present = 0;
            let mut absent = 0;
            let mut leave = 0;
            let mut late = 0;

            let daily: Vec<DailyAttendance> = (1..=days)
                .map(|day| {
                    let mark = mine
                        .iter()
                        .find(|m| Datelike::day(&m.attendance_date) == day);
                    // No row is no mark. It is not an absence either — nobody
                    // recorded anything, and a register that turns silence
                    // into an "A" against somebody's name is a disciplinary
                    // document written by a loop.
                    let status = match mark.map(|m| m.status.as_str()) {
                        Some("present" | "PRESENT") => {
                            present += 1;
                            "P"
                        }
                        Some("absent" | "ABSENT") => {
                            absent += 1;
                            "A"
                        }
                        Some("leave" | "LEAVE" | "on_leave") => {
                            leave += 1;
                            "L"
                        }
                        Some(_) => "?",
                        None => "",
                    };
                    if mark.is_some_and(|m| m.is_late.unwrap_or(false)) {
                        late += 1;
                    }
                    DailyAttendance {
                        date: format!("{day:02}-{month:02}-{year}"),
                        status: status.to_string(),
                        in_time: mark
                            .and_then(|m| m.check_in)
                            .map(|t| t.with_timezone(&tz).format("%H:%M").to_string()),
                        out_time: mark
                            .and_then(|m| m.check_out)
                            .map(|t| t.with_timezone(&tz).format("%H:%M").to_string()),
                    }
                })
                .collect();

            total_present += present;
            total_absent += absent;
            total_leave += leave;

            AttendanceRecord {
                employee_name: s.full_name,
                employee_id: s.employee_code,
                designation: s.designation.unwrap_or_default(),
                days_present: present,
                days_absent: absent,
                days_leave: leave,
                late_arrivals: late,
                early_departures: 0,
                overtime_hours: 0.0,
                daily_attendance: daily,
            }
        })
        .collect();

    let total_staff = attendance_records.len() as i32;
    let working_days = days as i32 - 4; // Assume 4 holidays
    let avg_attendance = if total_staff > 0 && working_days > 0 {
        (f64::from(total_present) / f64::from(total_staff * working_days)) * 100.0
    } else {
        0.0
    };

    Ok(Json(StaffAttendanceReportPrintData {
        department: dept_name,
        month: chrono::Month::try_from(month as u8)
            .map_or("Unknown", |m| m.name())
            .to_string(),
        year,
        generated_date: Utc::now()
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        attendance_records,
        summary: AttendanceSummary {
            total_staff,
            avg_attendance_percent: (avg_attendance * 10.0).round() / 10.0,
            total_leave_days: total_leave,
            total_absent_days: total_absent,
        },
        hospital_name: hospital.name,
    }))
}

// ── Training Certificate ──────────────────────────────────────────────────────

/// GET /print-data/training-certificate/{training_id}
///
/// A `training_records` row — what the HR training screen lists and creates.
/// Only a completed training earns a certificate.
pub async fn get_training_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(training_id): Path<Uuid>,
) -> Result<Json<TrainingCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::hr::training::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct TrainingRow {
        certificate_no: Option<String>,
        certificate_date: String,
        status: String,
        training_date: String,
        employee_name: String,
        employee_code: String,
        designation: Option<String>,
        department_name: Option<String>,
        training_title: String,
        duration_hours: Option<f64>,
        trainer_name: Option<String>,
        score: Option<f64>,
        valid_until: Option<String>,
    }

    let training = sqlx::query_as::<_, TrainingRow>(
        "SELECT \
           tr.certificate_no, \
           to_char(now(), 'DD-MM-YYYY') AS certificate_date, \
           tr.status::text AS status, \
           to_char(tr.training_date, 'DD-MM-YYYY') AS training_date, \
           concat_ws(' ', e.first_name, e.last_name) AS employee_name, \
           e.employee_code, \
           des.name AS designation, \
           d.name AS department_name, \
           tp.name AS training_title, \
           tp.duration_hours::float8 AS duration_hours, \
           tr.trainer_name, \
           tr.score::float8 AS score, \
           to_char(tr.expiry_date, 'DD-MM-YYYY') AS valid_until \
         FROM training_records tr \
         JOIN training_programs tp ON tp.id = tr.program_id \
         JOIN employees e ON e.id = tr.employee_id \
         LEFT JOIN departments d ON d.id = e.department_id \
         LEFT JOIN designations des ON des.id = e.designation_id \
         WHERE tr.id = $1 AND tr.tenant_id = $2 AND tr.deleted_at IS NULL",
    )
    .bind(training_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if training.status != "completed" {
        return Err(AppError::Conflict(format!(
            "a certificate is issued for a completed training; this one is {}",
            training.status
        )));
    }

    let hospital = get_hospital_info(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;

    // Only what the record holds: no grade scale, topic list, issuing officer
    // or verification link is configured anywhere, so none is printed.
    Ok(Json(TrainingCertificatePrintData {
        certificate_number: training.certificate_no,
        certificate_date: training.certificate_date,
        employee_name: training.employee_name,
        employee_id: training.employee_code,
        designation: training.designation,
        department: training.department_name,
        training_title: training.training_title,
        training_type: None,
        training_date: training.training_date,
        training_duration: training.duration_hours.map(|h| format!("{h} hours")),
        trainer_name: training.trainer_name,
        trainer_organization: None,
        topics_covered: Vec::new(),
        score: training.score,
        grade: None,
        certificate_valid_until: training.valid_until,
        issued_by: None,
        qr_verification_url: None,
        hospital_name: hospital.name,
        hospital_logo_url: hospital.logo_url,
    }))
}

// ── Staff Credential Verification ─────────────────────────────────────────────

/// GET /print-data/staff-credentials/{employee_id}
pub async fn get_staff_credentials_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(employee_id): Path<Uuid>,
) -> Result<Json<StaffCredentialFormPrintData>, AppError> {
    // Credentials are the registration and licence numbers a clinician
    // practises under. Kept to the HR permission rather than a general staff
    // one — a roster does not entitle you to somebody's medical council number.
    require_permission(&claims, permissions::hr::credentials::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct EmployeeRow {
        employee_code: String,
        full_name: String,
        designation: Option<String>,
        department_name: Option<String>,
    }

    // `employee_id` is `employees.id` — the record `employee_credentials`
    // hangs off (written by the HR credentials screen).
    let emp = sqlx::query_as::<_, EmployeeRow>(
        r"
        SELECT
            e.employee_code,
            (e.first_name || COALESCE(' ' || e.last_name, '')) AS full_name,
            des.name AS designation,
            d.name AS department_name
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN designations des ON des.id = e.designation_id
        WHERE e.id = $1 AND e.deleted_at IS NULL
        ",
    )
    .bind(employee_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    #[derive(sqlx::FromRow)]
    struct CredentialRow {
        credential_type: String,
        issuing_authority: String,
        credential_number: String,
        issue_date: Option<chrono::NaiveDate>,
        expiry_date: Option<chrono::NaiveDate>,
        verification_status: String,
        document_attached: bool,
    }

    // "Verified" only when somebody recorded verifying it and the credential
    // is still active and in date; otherwise the lifecycle status prints.
    let creds = sqlx::query_as::<_, CredentialRow>(
        r"
        SELECT
            c.credential_type::text AS credential_type,
            c.issuing_body AS issuing_authority,
            COALESCE(c.credential_number, c.registration_no) AS credential_number,
            c.issued_date AS issue_date,
            c.expiry_date,
            CASE
                WHEN c.status <> 'active' THEN c.status::text
                WHEN c.expiry_date < current_date THEN 'expired'
                WHEN c.verified_at IS NOT NULL THEN 'Verified'
                ELSE 'Pending'
            END AS verification_status,
            (c.document_url IS NOT NULL) AS document_attached
        FROM employee_credentials c
        WHERE c.employee_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.credential_type, c.expiry_date
        LIMIT 500
        ",
    )
    .bind(employee_id)
    .fetch_all(&mut *conn)
    .await?;

    // A credentialing file with nothing in it prints as empty.
    //
    // This used to invent two credentials for any employee who had none: an
    // MBBS from "Medical University", a state council registration, both
    // marked "Verified", both with document attached. Credentialing is what a
    // hospital shows an accreditor to prove the person treating patients is
    // qualified, and NABH audits it. An invented "Verified" is the assertion
    // that somebody checked a doctor's degree when nobody did — and an empty
    // file is a finding the hospital needs to see, not a gap to paper over.
    let credentials: Vec<CredentialDetail> = {
        creds
            .into_iter()
            .map(|c| CredentialDetail {
                credential_type: c.credential_type,
                // ponytail: credential_name not recorded anywhere yet
                credential_name: None,
                issuing_authority: c.issuing_authority,
                credential_number: c.credential_number,
                issue_date: c.issue_date.map(|d| d.format("%d-%m-%Y").to_string()),
                expiry_date: c.expiry_date.map(|d| d.format("%d-%m-%Y").to_string()),
                verification_status: c.verification_status,
                document_attached: c.document_attached,
            })
            .collect()
    };

    // `.all()` on an empty list is true, so a file with nothing in it would
    // print "Complete" — the same false assurance the invented credentials
    // gave, reached a different way.
    let has_credentials = !credentials.is_empty();
    let all_verified = has_credentials
        && credentials
            .iter()
            .all(|c| c.verification_status == "Verified");
    let hospital = get_hospital_info(&mut conn, &claims.tenant_id).await?;

    Ok(Json(StaffCredentialFormPrintData {
        verification_number: format!("CV-{}", Utc::now().with_timezone(&tz).format("%Y%m%d%H%M")),
        verification_date: Utc::now().with_timezone(&tz).format("%d-%m-%Y").to_string(),
        employee_name: emp.full_name,
        employee_id: emp.employee_code,
        // Blank when the employee record has none — not "Staff"/"General".
        designation: emp.designation.unwrap_or_default(),
        department: emp.department_name.unwrap_or_default(),
        credentials,
        verification_status: if !has_credentials {
            "No credentials on file"
        } else if all_verified {
            "Complete"
        } else {
            "Pending"
        }
        .to_string(),
        // Nothing records who checked these, so nobody is named. It used to
        // say "HR Department" on every sheet.
        verified_by: None,
        remarks: None,
        hospital_name: hospital.name,
    }))
}

// ── Visitor Register ──────────────────────────────────────────────────────────

/// GET /print-data/visitor-register/{date}
pub async fn get_visitor_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(date): Path<String>,
) -> Result<Json<VisitorRegisterPrintData>, AppError> {
    // The visitor register belongs to front office, not HR, despite living
    // in this file — it records who came to see which patient.
    require_permission(&claims, permissions::front_office::visitors::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // A malformed date is refused rather than silently printing today's register.
    let register_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("date must be YYYY-MM-DD".to_string()))?;

    #[derive(sqlx::FromRow)]
    struct VisitorRow {
        serial_no: i64,
        visitor_name: String,
        visitor_phone: Option<String>,
        id_type: Option<String>,
        id_number: Option<String>,
        purpose: String,
        patient_name: Option<String>,
        patient_uhid: Option<String>,
        ward: Option<String>,
        in_time: chrono::DateTime<Utc>,
        out_time: Option<chrono::DateTime<Utc>>,
        badge_number: Option<String>,
    }

    // One line per gate check-in (`visitor_logs`) on the day, with the pass and
    // the registration it was issued against.
    let visitors = sqlx::query_as::<_, VisitorRow>(
        r"
        SELECT
            ROW_NUMBER() OVER (ORDER BY l.check_in_at) AS serial_no,
            r.visitor_name,
            r.phone AS visitor_phone,
            r.id_type,
            r.id_number,
            COALESCE(r.purpose, '') AS purpose,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            p.uhid AS patient_uhid,
            w.name AS ward,
            l.check_in_at AS in_time,
            COALESCE(l.check_out_at, l.checked_out_at) AS out_time,
            vp.pass_number AS badge_number
        FROM visitor_logs l
        JOIN visitor_passes vp ON vp.id = l.pass_id AND vp.deleted_at IS NULL
        JOIN visitor_registrations r ON r.id = vp.registration_id AND r.deleted_at IS NULL
        LEFT JOIN patients p ON p.id = r.patient_id AND p.deleted_at IS NULL
        LEFT JOIN locations w ON w.id = r.ward_id AND w.deleted_at IS NULL
        WHERE l.check_in_at >= $1::date AND l.check_in_at < $1::date + 1
          AND l.deleted_at IS NULL
        ORDER BY l.check_in_at
        LIMIT 5000
        ",
    )
    .bind(register_date)
    .fetch_all(&mut *conn)
    .await?;

    // A visitor register with no entries prints as empty.
    //
    // It used to invent one: "Sample Visitor", a masked Aadhaar number, a
    // "Patient Name" at "UHID001", in at 10:30 and out at 12:15. The register
    // is a security record — it is what a hospital reads back after an
    // incident to say who was in the building — so an invented row is a
    // person who was never there, with an ID number that belongs to nobody.
    let entries: Vec<VisitorEntry> = {
        visitors
            .into_iter()
            .map(|v| VisitorEntry {
                serial_no: v.serial_no as i32,
                visitor_name: v.visitor_name,
                visitor_phone: v.visitor_phone,
                visitor_id_type: v.id_type,
                visitor_id_number: v.id_number,
                purpose: v.purpose,
                // ponytail: visiting department/person not recorded anywhere
                // yet — a registration names only a ward, printed as `ward`.
                visiting_department: None,
                visiting_person: None,
                ward: v.ward,
                patient_name: v.patient_name,
                patient_uhid: v.patient_uhid,
                in_time: v.in_time.with_timezone(&tz).format("%H:%M").to_string(),
                out_time: v
                    .out_time
                    .map(|t| t.with_timezone(&tz).format("%H:%M").to_string()),
                badge_number: v.badge_number,
            })
            .collect()
    };

    let total = entries.len() as i32;
    let hospital = get_hospital_info(&mut conn, &claims.tenant_id).await?;

    Ok(Json(VisitorRegisterPrintData {
        register_date: register_date.format("%d-%m-%Y").to_string(),
        // ponytail: register location not recorded anywhere yet (gate is per
        // check-in, not per register).
        location: None,
        entries,
        total_visitors: total,
        hospital_name: hospital.name,
    }))
}

// ── Helper Functions ──────────────────────────────────────────────────────────

struct HospitalInfo {
    name: String,
    logo_url: Option<String>,
}

async fn get_hospital_info(
    conn: &mut sqlx::PgConnection,
    tenant_id: &Uuid,
) -> Result<HospitalInfo, AppError> {
    // The caller's own hospital — this once read whichever active tenant came
    // first, which put another hospital's name on the form.
    let (name, logo_url) = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, logo_url FROM tenants WHERE id = $1",
    )
    .bind(tenant_id)
    .fetch_one(conn)
    .await?;
    Ok(HospitalInfo { name, logo_url })
}

const fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

/// hr print-data routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/employee-id-card/{employee_id}",
            get(get_employee_id_card_print_data),
        )
        .route(
            "/api/print-data/duty-roster/{department_id}/{period}",
            get(get_duty_roster_print_data),
        )
        .route(
            "/api/print-data/leave-application/{leave_id}",
            get(get_leave_application_print_data),
        )
        .route(
            "/api/print-data/staff-attendance/{department_id}/{month}/{year}",
            get(get_staff_attendance_print_data),
        )
        .route(
            "/api/print-data/training-certificate/{training_id}",
            get(get_training_certificate_print_data),
        )
        .route(
            "/api/print-data/staff-credentials/{employee_id}",
            get(get_staff_credentials_print_data),
        )
        .route(
            "/api/print-data/visitor-register/{date}",
            get(get_visitor_register_print_data),
        )
}
