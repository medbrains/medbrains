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
    pub patient_name: String,
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
