-- Seed billing providers for Moonlit PLLC
-- Run this after 001_claims_foundation.sql

-- Add is_bookable column to track which providers can be selected as rendering providers
ALTER TABLE billing_providers ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN DEFAULT FALSE;

-- Insert all providers
INSERT INTO billing_providers (name, npi, type, is_active, is_bookable) VALUES
  ('Mitchell Allen', '1467155135', 'individual', true, false),
  ('Gisele Braga', '1861197931', 'individual', true, false),
  ('Tatiana Kaehler', '1568102390', 'individual', true, true),
  ('Travis Norseth', '1124778121', 'individual', true, true),
  ('Anthony Privratsky', '1336726843', 'individual', true, true),
  ('Merrick Reynolds', '1295302339', 'individual', true, true),
  ('Kyle Roller', '1295297810', 'individual', true, true),
  ('Rufus Sweeney', '1023711348', 'individual', true, true),
  ('Doug Sirutis', '1255035077', 'individual', true, false),
  ('MOONLIT PLLC', '1275348807', 'organization', false, false)
ON CONFLICT (npi) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active,
  is_bookable = EXCLUDED.is_bookable;
