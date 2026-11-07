//! OPD Appointment routes — doctor schedules, slot availability, booking.

mod bookings;
mod public;
mod reminders;
mod schedules;
mod types;

pub use bookings::{
    book_appointment, cancel_appointment, check_in_appointment, complete_appointment,
    get_appointment, list_appointments, mark_appointment_no_show, reschedule_appointment,
};
pub(crate) use public::{Caller, OnlineBooking, book_online, find_or_register};
pub use public::{
    kiosk_checkin, public_available_slots, public_book_appointment, public_bookable_doctors,
    public_token_status, queue_token_status_link, request_public_booking_otp,
};
pub use reminders::{get_reminder_config, update_reminder_config};
pub use schedules::{
    create_exception, create_schedule, delete_exception, delete_schedule, get_available_slots,
    list_exceptions, list_schedules, update_schedule,
};
/// Doctor schedules, slots and booked appointments: the OPD app's own routes, put behind the
/// `opd` brick switch. The kiosk, public booking and reminder routes are mounted elsewhere.
pub fn router() -> axum::Router<crate::state::AppState> {
    use axum::routing::{delete, get, put};
    axum::Router::new()
        .route(
            "/api/opd/schedules",
            get(list_schedules).post(create_schedule),
        )
        .route(
            "/api/opd/schedules/{id}",
            put(update_schedule).delete(delete_schedule),
        )
        .route(
            "/api/opd/schedule-exceptions",
            get(list_exceptions).post(create_exception),
        )
        .route(
            "/api/opd/schedule-exceptions/{id}",
            delete(delete_exception),
        )
        .route(
            "/api/opd/doctors/{doctor_id}/slots",
            get(get_available_slots),
        )
        .route(
            "/api/opd/appointments",
            get(list_appointments).post(book_appointment),
        )
        .route("/api/opd/appointments/{id}", get(get_appointment))
        .route(
            "/api/opd/appointments/{id}/reschedule",
            put(reschedule_appointment),
        )
        .route("/api/opd/appointments/{id}/cancel", put(cancel_appointment))
        .route(
            "/api/opd/appointments/{id}/check-in",
            put(check_in_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/complete",
            put(complete_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/no-show",
            put(mark_appointment_no_show),
        )
}

pub use types::{
    AppointmentWithPatient, BookAppointmentRequest, CancelRequest, CreateExceptionRequest,
    CreateScheduleRequest, KioskCheckinRequest, KioskCheckinResponse, ListAppointmentsQuery,
    ListExceptionsQuery, ListSchedulesQuery, ListSlotsQuery, PublicBookableDoctor,
    PublicBookingDirectory, PublicBookingOtpRequest, PublicBookingRequest, PublicBookingResponse,
    PublicDirectoryQuery, PublicSlotsQuery, PublicTokenLink, PublicTokenStatus, ReminderConfig,
    RescheduleRequest, UpdateScheduleRequest,
};

/// Issue the next OPD queue token for a department (today's sequence)
/// and return its display number. Shared by kiosk and receptionist
/// check-in so both paths land the patient in the doctor's queue.
pub(crate) async fn issue_queue_token(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: uuid::Uuid,
    department_id: uuid::Uuid,
    patient_id: uuid::Uuid,
) -> Result<(uuid::Uuid, String), crate::error::AppError> {
    let token_seq: i32 = sqlx::query_scalar(
        // allow-raw-sql: helper runs on the caller's tenant-scoped transaction
        "SELECT COALESCE(MAX(token_seq), 0) + 1 FROM queue_tokens \
         WHERE department_id = $1 AND token_date = CURRENT_DATE",
    )
    .bind(department_id)
    .fetch_one(&mut **tx)
    .await?;
    let token_number = format!("T-{token_seq:03}");

    // The id comes back so a caller can hand the patient an opaque reference to
    // follow this token on their phone; the number alone cannot address a row.
    let id: uuid::Uuid = sqlx::query_scalar(
        // allow-raw-sql: helper runs on the caller's tenant-scoped transaction
        "INSERT INTO queue_tokens \
         (tenant_id, department_id, patient_id, token_date, token_seq, token_number, status) \
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'waiting') \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(patient_id)
    .bind(token_seq)
    .bind(&token_number)
    .fetch_one(&mut **tx)
    .await?;

    Ok((id, token_number))
}
