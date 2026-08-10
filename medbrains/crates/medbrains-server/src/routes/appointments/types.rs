use chrono::{NaiveDate, NaiveTime};
use medbrains_core::appointment::{Appointment, AppointmentType};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub doctor_id: Uuid,
    pub department_id: Option<Uuid>,
    pub day_of_week: i32,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub slot_duration_mins: Option<i32>,
    pub max_patients: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub slot_duration_mins: Option<i32>,
    pub max_patients: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExceptionRequest {
    pub doctor_id: Uuid,
    pub exception_date: NaiveDate,
    pub is_available: Option<bool>,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListSlotsQuery {
    pub date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct BookAppointmentRequest {
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
    pub appointment_type: Option<AppointmentType>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub recurrence_pattern: Option<String>,
    pub recurrence_count: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RescheduleRequest {
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
}

#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    pub cancel_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListAppointmentsQuery {
    pub date: Option<NaiveDate>,
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppointmentWithPatient {
    #[serde(flatten)]
    pub appointment: Appointment,
    pub patient_name: Option<String>,
    pub doctor_name: String,
}

#[derive(Debug, Deserialize)]
pub struct ListSchedulesQuery {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ListExceptionsQuery {
    pub doctor_id: Uuid,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct PublicBookingRequest {
    pub tenant_code: String,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
    pub patient_name: String,
    pub patient_phone: String,
    pub patient_dob: Option<NaiveDate>,
    pub reason: Option<String>,
    /// Required when the tenant enables appointments.public_booking_otp_required.
    pub otp: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PublicBookingOtpRequest {
    pub tenant_code: String,
    pub patient_phone: String,
}

#[derive(Debug, Serialize)]
pub struct PublicBookingResponse {
    pub appointment_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub doctor_name: String,
    pub department_name: String,
    pub qr_code_data: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct PublicSlotsQuery {
    pub tenant_code: String,
    pub doctor_id: Uuid,
    pub date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct KioskCheckinRequest {
    pub qr_data: String,
}

#[derive(Debug, Serialize)]
pub struct KioskCheckinResponse {
    pub appointment_id: Uuid,
    pub patient_name: String,
    pub doctor_name: String,
    pub department_name: String,
    pub token_number: String,
    pub status: String,
    pub message: String,
    /// Opaque handle the patient keeps on their phone to follow this token.
    /// Encrypted and expiring; it addresses the queue row without exposing it.
    pub status_token: String,
}

/// The opaque handle staff hand to a patient so they can follow their token.
#[derive(Debug, Serialize, Deserialize)]
pub struct PublicTokenLink {
    pub status_token: String,
}

/// What a patient may see about their own token from an unauthenticated phone.
///
/// Deliberately no name, no UHID, no patient or department id: this is reached
/// with a link and nothing else, so it must reveal no more than the waiting-room
/// screen already shows to everyone standing in front of it.
#[derive(Debug, Serialize, Deserialize)]
pub struct PublicTokenStatus {
    pub token_number: String,
    pub department_name: String,
    pub status: String,
    /// How many are called before this one. `None` once it is no longer waiting.
    pub ahead: Option<i64>,
    pub estimated_wait_minutes: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReminderConfig {
    pub sms_enabled: bool,
    pub whatsapp_enabled: bool,
    pub email_enabled: bool,
    pub remind_hours_before: Vec<i32>,
    pub sms_template: String,
    pub whatsapp_template: String,
}

#[derive(Debug, Deserialize)]
pub struct PublicDirectoryQuery {
    pub tenant_code: String,
}

/// A doctor a member of the public may book with.
///
/// Deliberately thin. This is served to anyone who knows a hospital's code, so
/// it carries what somebody needs to choose an appointment and nothing more —
/// no contact details, no employee id, no roster.
/// What a booking page needs before it can show anything.
///
/// Bundled with the doctor list rather than served separately: the page cannot
/// render a correct form without knowing whether a code is required, and a
/// second round trip to learn one boolean is a second thing to fail.
#[derive(Debug, Serialize)]
pub struct PublicBookingDirectory {
    pub otp_required: bool,
    pub doctors: Vec<PublicBookableDoctor>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PublicBookableDoctor {
    pub doctor_id: Uuid,
    pub doctor_name: String,
    pub department_id: Uuid,
    pub department_name: String,
}
