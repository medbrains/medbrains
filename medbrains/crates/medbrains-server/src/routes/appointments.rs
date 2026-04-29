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
pub use public::{kiosk_checkin, public_available_slots, public_book_appointment};
pub use reminders::{get_reminder_config, update_reminder_config};
pub use schedules::{
    create_exception, create_schedule, delete_exception, delete_schedule, get_available_slots,
    list_exceptions, list_schedules, update_schedule,
};
pub use types::{
    AppointmentWithPatient, BookAppointmentRequest, CancelRequest, CreateExceptionRequest,
    CreateScheduleRequest, KioskCheckinRequest, KioskCheckinResponse, ListAppointmentsQuery,
    ListExceptionsQuery, ListSchedulesQuery, ListSlotsQuery, PublicBookingRequest,
    PublicBookingResponse, PublicSlotsQuery, ReminderConfig, RescheduleRequest,
    UpdateScheduleRequest,
};
