//! Print data routes for Admin/HR forms.
//!
//! Phase 5: Employee ID, Duty Roster, Leave, Attendance, Training, Credentials, Visitor Register.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use axum::routing::get;
use chrono::Datelike;
use chrono::Utc;
use sqlx::PgPool;
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
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

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

    let hospital = get_hospital_info(&state.db).await?;

    let now = Utc::now();
    let valid_from = now.format("%d-%m-%Y").to_string();
    let valid_until = (now + chrono::Duration::days(365))
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
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    let dept_name = sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
        .bind(department_id)
        .fetch_optional(&mut *conn)
        .await?
        .unwrap_or_else(|| "Department".to_string());

    let hospital = get_hospital_info(&state.db).await?;

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
        generated_date: Utc::now().format("%d-%m-%Y %H:%M").to_string(),
        generated_by: "System".to_string(),
        shifts,
        roster_entries,
        hospital_name: hospital.name,
    }))
}

// ── Leave Application ─────────────────────────────────────────────────────────

/// GET /print-data/leave-application/{leave_id}
pub async fn get_leave_application_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(leave_id): Path<Uuid>,
) -> Result<Json<LeaveApplicationPrintData>, AppError> {
    require_permission(&claims, permissions::hr::leave::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct LeaveRow {
        application_number: Option<String>,
        application_date: Option<chrono::DateTime<Utc>>,
        employee_name: String,
        employee_code: String,
        department_name: Option<String>,
        designation: Option<String>,
        leave_type: String,
        leave_from: chrono::NaiveDate,
        leave_to: chrono::NaiveDate,
        reason: Option<String>,
        status: String,
        approved_by_name: Option<String>,
        approved_at: Option<chrono::DateTime<Utc>>,
        remarks: Option<String>,
    }

    let leave = sqlx::query_as::<_, LeaveRow>(
        r"
        SELECT
            la.application_number,
            la.created_at as application_date,
            u.full_name as employee_name,
            u.employee_code,
            d.name as department_name,
            des.name as designation,
            lt.name as leave_type,
            la.leave_from,
            la.leave_to,
            la.reason,
            la.status,
            approver.full_name as approved_by_name,
            la.approved_at,
            la.remarks
        FROM leave_applications la
        JOIN users u ON la.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN designations des ON u.designation_id = des.id
        JOIN leave_types lt ON la.leave_type_id = lt.id
        LEFT JOIN users approver ON la.approved_by = approver.id
        WHERE la.id = $1
        ",
    )
    .bind(leave_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let total_days = (leave.leave_to - leave.leave_from).num_days() as i32 + 1;
    let hospital = get_hospital_info(&state.db).await?;

    Ok(Json(LeaveApplicationPrintData {
        application_number: leave
            .application_number
            .unwrap_or_else(|| format!("LA-{leave_id}")),
        application_date: leave
            .application_date
            .map(|d| d.format("%d-%m-%Y").to_string())
            .unwrap_or_default(),
        employee_name: leave.employee_name,
        employee_id: leave.employee_code,
        department: leave
            .department_name
            .unwrap_or_else(|| "General".to_string()),
        designation: leave.designation.unwrap_or_else(|| "Staff".to_string()),
        leave_type: leave.leave_type,
        leave_from: leave.leave_from.format("%d-%m-%Y").to_string(),
        leave_to: leave.leave_to.format("%d-%m-%Y").to_string(),
        total_days,
        reason: leave.reason.unwrap_or_default(),
        leave_balance_before: 20,
        leave_balance_after: 20 - total_days,
        relieving_officer: None,
        contact_during_leave: None,
        approver_name: leave.approved_by_name,
        approval_status: leave.status,
        approval_date: leave.approved_at.map(|d| d.format("%d-%m-%Y").to_string()),
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
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    let dept_name = sqlx::query_scalar::<_, String>("SELECT name FROM departments WHERE id = $1")
        .bind(department_id)
        .fetch_optional(&mut *conn)
        .await?
        .unwrap_or_else(|| "Department".to_string());

    let hospital = get_hospital_info(&state.db).await?;

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
                        Some("present") | Some("PRESENT") => {
                            present += 1;
                            "P"
                        }
                        Some("absent") | Some("ABSENT") => {
                            absent += 1;
                            "A"
                        }
                        Some("leave") | Some("LEAVE") | Some("on_leave") => {
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
                            .map(|t| t.format("%H:%M").to_string()),
                        out_time: mark
                            .and_then(|m| m.check_out)
                            .map(|t| t.format("%H:%M").to_string()),
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
            .map(|m| m.name())
            .unwrap_or("Unknown")
            .to_string(),
        year,
        generated_date: Utc::now().format("%d-%m-%Y %H:%M").to_string(),
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
pub async fn get_training_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(training_id): Path<Uuid>,
) -> Result<Json<TrainingCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::hr::training::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct TrainingRow {
        certificate_number: Option<String>,
        training_date: chrono::NaiveDate,
        employee_name: String,
        employee_code: String,
        designation: Option<String>,
        department_name: Option<String>,
        training_title: String,
        training_type: Option<String>,
        duration_hours: Option<f64>,
        trainer_name: Option<String>,
        trainer_org: Option<String>,
        score: Option<f64>,
        issued_by: Option<String>,
    }

    let training = sqlx::query_as::<_, TrainingRow>(
        r"
        SELECT
            ta.certificate_number,
            t.training_date,
            u.full_name as employee_name,
            u.employee_code,
            des.name as designation,
            d.name as department_name,
            t.title as training_title,
            t.training_type,
            t.duration_hours,
            t.trainer_name,
            t.trainer_organization as trainer_org,
            ta.score,
            issuer.full_name as issued_by
        FROM training_attendance ta
        JOIN trainings t ON ta.training_id = t.id
        JOIN users u ON ta.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN designations des ON u.designation_id = des.id
        LEFT JOIN users issuer ON ta.issued_by = issuer.id
        WHERE ta.id = $1
        ",
    )
    .bind(training_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(&state.db).await?;

    let duration = training
        .duration_hours
        .map_or_else(|| "1 day".to_string(), |h| format!("{h} hours"));

    let grade = training.score.map(|s| {
        if s >= 90.0 {
            "A+"
        } else if s >= 80.0 {
            "A"
        } else if s >= 70.0 {
            "B"
        } else if s >= 60.0 {
            "C"
        } else {
            "D"
        }
        .to_string()
    });

    Ok(Json(TrainingCertificatePrintData {
        certificate_number: training
            .certificate_number
            .unwrap_or_else(|| format!("TC-{training_id}")),
        certificate_date: Utc::now().format("%d-%m-%Y").to_string(),
        employee_name: training.employee_name,
        employee_id: training.employee_code,
        designation: training.designation.unwrap_or_else(|| "Staff".to_string()),
        department: training
            .department_name
            .unwrap_or_else(|| "General".to_string()),
        training_title: training.training_title,
        training_type: training
            .training_type
            .unwrap_or_else(|| "Internal".to_string()),
        training_date: training.training_date.format("%d-%m-%Y").to_string(),
        training_duration: duration,
        trainer_name: training.trainer_name,
        trainer_organization: training.trainer_org,
        topics_covered: vec![
            "Key Concepts".to_string(),
            "Practical Application".to_string(),
            "Best Practices".to_string(),
        ],
        score: training.score,
        grade,
        certificate_valid_until: None,
        issued_by: training
            .issued_by
            .unwrap_or_else(|| "HR Department".to_string()),
        qr_verification_url: Some(format!(
            "https://hospital.com/verify/training/{training_id}"
        )),
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
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct EmployeeRow {
        employee_code: String,
        full_name: String,
        designation: Option<String>,
        department_name: Option<String>,
    }

    let emp = sqlx::query_as::<_, EmployeeRow>(
        r"
        SELECT
            u.employee_code,
            u.full_name,
            des.name as designation,
            d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN designations des ON u.designation_id = des.id
        WHERE u.id = $1
        ",
    )
    .bind(employee_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    #[derive(sqlx::FromRow)]
    struct CredentialRow {
        credential_type: String,
        credential_name: String,
        issuing_authority: String,
        credential_number: String,
        issue_date: Option<chrono::NaiveDate>,
        expiry_date: Option<chrono::NaiveDate>,
        verification_status: String,
        document_attached: bool,
    }

    let creds = sqlx::query_as::<_, CredentialRow>(
        r"
        SELECT
            credential_type,
            credential_name,
            issuing_authority,
            credential_number,
            issue_date,
            expiry_date,
            verification_status,
            document_attached
        FROM staff_credentials
        WHERE user_id = $1
        ORDER BY credential_type, credential_name
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
                credential_name: c.credential_name,
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
    let hospital = get_hospital_info(&state.db).await?;

    Ok(Json(StaffCredentialFormPrintData {
        verification_number: format!("CV-{}", Utc::now().format("%Y%m%d%H%M")),
        verification_date: Utc::now().format("%d-%m-%Y").to_string(),
        employee_name: emp.full_name,
        employee_id: emp.employee_code,
        designation: emp.designation.unwrap_or_else(|| "Staff".to_string()),
        department: emp.department_name.unwrap_or_else(|| "General".to_string()),
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
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;

    let register_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());

    #[derive(sqlx::FromRow)]
    struct VisitorRow {
        serial_no: i64,
        visitor_name: String,
        visitor_phone: Option<String>,
        id_type: Option<String>,
        id_number: Option<String>,
        purpose: String,
        visiting_department: Option<String>,
        visiting_person: Option<String>,
        patient_name: Option<String>,
        patient_uhid: Option<String>,
        in_time: chrono::DateTime<Utc>,
        out_time: Option<chrono::DateTime<Utc>>,
        badge_number: Option<String>,
    }

    let visitors = sqlx::query_as::<_, VisitorRow>(
        r"
        SELECT
            ROW_NUMBER() OVER (ORDER BY in_time) as serial_no,
            visitor_name,
            visitor_phone,
            id_type,
            id_number,
            purpose,
            d.name as visiting_department,
            u.full_name as visiting_person,
            (p.first_name || ' ' || p.last_name) as patient_name,
            p.uhid as patient_uhid,
            v.in_time,
            v.out_time,
            v.badge_number
        FROM visitor_register v
        LEFT JOIN departments d ON v.department_id = d.id
        LEFT JOIN users u ON v.visiting_user_id = u.id
        LEFT JOIN patients p ON v.patient_id = p.id
        WHERE DATE(v.in_time) = $1
        ORDER BY v.in_time
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
                visiting_department: v.visiting_department,
                visiting_person: v.visiting_person,
                patient_name: v.patient_name,
                patient_uhid: v.patient_uhid,
                in_time: v.in_time.format("%H:%M").to_string(),
                out_time: v.out_time.map(|t| t.format("%H:%M").to_string()),
                badge_number: v.badge_number,
            })
            .collect()
    };

    let total = entries.len() as i32;
    let hospital = get_hospital_info(&state.db).await?;

    Ok(Json(VisitorRegisterPrintData {
        register_date: register_date.format("%d-%m-%Y").to_string(),
        location: "Main Security Desk".to_string(),
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

async fn get_hospital_info(pool: &PgPool) -> Result<HospitalInfo, AppError> {
    #[derive(sqlx::FromRow)]
    struct TenantRow {
        name: String,
        logo_url: Option<String>,
    }

    let tenant = sqlx::query_as::<_, TenantRow>(
        "SELECT name, logo_url FROM tenants WHERE is_active = true LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .unwrap_or(TenantRow {
        name: "Hospital".to_string(),
        logo_url: None,
    });

    Ok(HospitalInfo {
        name: tenant.name,
        logo_url: tenant.logo_url,
    })
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
