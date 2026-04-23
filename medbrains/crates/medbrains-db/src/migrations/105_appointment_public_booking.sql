-- 105_appointment_public_booking.sql — Public booking + kiosk check-in support

-- Add booking source tracking
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'walk_in';
