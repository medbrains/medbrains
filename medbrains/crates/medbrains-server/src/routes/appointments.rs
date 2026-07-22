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
pub use public::{
    kiosk_checkin, public_available_slots, public_book_appointment, request_public_booking_otp,
};
pub use reminders::{get_reminder_config, update_reminder_config};
pub use schedules::{
    create_exception, create_schedule, delete_exception, delete_schedule, get_available_slots,
    list_exceptions, list_schedules, update_schedule,
};
pub use types::{
    AppointmentWithPatient, BookAppointmentRequest, CancelRequest, CreateExceptionRequest,
    CreateScheduleRequest, KioskCheckinRequest, KioskCheckinResponse, ListAppointmentsQuery,
    ListExceptionsQuery, ListSchedulesQuery, ListSlotsQuery, PublicBookingOtpRequest,
    PublicBookingRequest, PublicBookingResponse, PublicSlotsQuery, ReminderConfig,
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
) -> Result<String, crate::error::AppError> {
    let token_seq: i32 = sqlx::query_scalar(  // allow-raw-sql: helper runs on the caller's tenant-scoped transaction
        "SELECT COALESCE(MAX(token_seq), 0) + 1 FROM queue_tokens \
         WHERE department_id = $1 AND token_date = CURRENT_DATE",
    )
    .bind(department_id)
    .fetch_one(&mut **tx)
    .await?;
    let token_number = format!("T-{token_seq:03}");

    sqlx::query(  // allow-raw-sql: helper runs on the caller's tenant-scoped transaction
        "INSERT INTO queue_tokens \
         (tenant_id, department_id, patient_id, token_date, token_seq, token_number, status) \
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'waiting')",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(patient_id)
    .bind(token_seq)
    .bind(&token_number)
    .execute(&mut **tx)
    .await?;

    Ok(token_number)
}
