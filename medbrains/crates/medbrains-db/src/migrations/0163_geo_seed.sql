-- Seed geographic reference data (countries + Indian states/UTs). The geo
-- backend (/api/geo/countries, /states, …) and the onboarding address forms
-- exist, but the geo_* tables were empty so the dropdowns returned nothing.
-- Global reference data; idempotent. Districts/sub-districts/towns/PIN codes
-- are large datasets loaded via CSV import (separate ticket), not seeded here.

INSERT INTO public.geo_countries
    (code, name, phone_code, currency, default_locale, default_timezone,
     date_format, measurement_system)
VALUES
    ('IN', 'India',                '+91',  'INR', 'en', 'Asia/Kolkata',  'DD/MM/YYYY', 'metric'),
    ('AE', 'United Arab Emirates', '+971', 'AED', 'en', 'Asia/Dubai',    'DD/MM/YYYY', 'metric'),
    ('SA', 'Saudi Arabia',         '+966', 'SAR', 'ar', 'Asia/Riyadh',   'DD/MM/YYYY', 'metric'),
    ('QA', 'Qatar',                '+974', 'QAR', 'ar', 'Asia/Qatar',    'DD/MM/YYYY', 'metric'),
    ('KW', 'Kuwait',               '+965', 'KWD', 'ar', 'Asia/Kuwait',   'DD/MM/YYYY', 'metric'),
    ('OM', 'Oman',                 '+968', 'OMR', 'ar', 'Asia/Muscat',   'DD/MM/YYYY', 'metric'),
    ('NP', 'Nepal',                '+977', 'NPR', 'en', 'Asia/Kathmandu','DD/MM/YYYY', 'metric'),
    ('BD', 'Bangladesh',           '+880', 'BDT', 'en', 'Asia/Dhaka',    'DD/MM/YYYY', 'metric'),
    ('LK', 'Sri Lanka',            '+94',  'LKR', 'en', 'Asia/Colombo',  'DD/MM/YYYY', 'metric'),
    ('SG', 'Singapore',            '+65',  'SGD', 'en', 'Asia/Singapore','DD/MM/YYYY', 'metric'),
    ('GB', 'United Kingdom',       '+44',  'GBP', 'en', 'Europe/London', 'DD/MM/YYYY', 'metric'),
    ('US', 'United States',        '+1',   'USD', 'en', 'America/New_York','MM/DD/YYYY','imperial'),
    ('CA', 'Canada',               '+1',   'CAD', 'en', 'America/Toronto','DD/MM/YYYY', 'metric'),
    ('AU', 'Australia',            '+61',  'AUD', 'en', 'Australia/Sydney','DD/MM/YYYY','metric')
ON CONFLICT (code) DO NOTHING;

-- Indian states (28) + Union Territories (8), linked to India.
INSERT INTO public.geo_states (country_id, code, name)
SELECT c.id, s.code, s.name
FROM public.geo_countries c
CROSS JOIN (VALUES
    ('AP', 'Andhra Pradesh'),
    ('AR', 'Arunachal Pradesh'),
    ('AS', 'Assam'),
    ('BR', 'Bihar'),
    ('CG', 'Chhattisgarh'),
    ('GA', 'Goa'),
    ('GJ', 'Gujarat'),
    ('HR', 'Haryana'),
    ('HP', 'Himachal Pradesh'),
    ('JH', 'Jharkhand'),
    ('KA', 'Karnataka'),
    ('KL', 'Kerala'),
    ('MP', 'Madhya Pradesh'),
    ('MH', 'Maharashtra'),
    ('MN', 'Manipur'),
    ('ML', 'Meghalaya'),
    ('MZ', 'Mizoram'),
    ('NL', 'Nagaland'),
    ('OD', 'Odisha'),
    ('PB', 'Punjab'),
    ('RJ', 'Rajasthan'),
    ('SK', 'Sikkim'),
    ('TN', 'Tamil Nadu'),
    ('TS', 'Telangana'),
    ('TR', 'Tripura'),
    ('UP', 'Uttar Pradesh'),
    ('UK', 'Uttarakhand'),
    ('WB', 'West Bengal'),
    ('AN', 'Andaman and Nicobar Islands'),
    ('CH', 'Chandigarh'),
    ('DH', 'Dadra and Nagar Haveli and Daman and Diu'),
    ('DL', 'Delhi'),
    ('JK', 'Jammu and Kashmir'),
    ('LA', 'Ladakh'),
    ('LD', 'Lakshadweep'),
    ('PY', 'Puducherry')
) AS s(code, name)
WHERE c.code = 'IN'
ON CONFLICT (country_id, code) DO NOTHING;
