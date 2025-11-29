-- Fix Office Ally payer IDs based on production database
-- The original seed data had incorrect/placeholder IDs

-- Update existing payers with correct Office Ally IDs
UPDATE payers SET oa_professional_837p_id = '60054' WHERE name = 'Aetna';
UPDATE payers SET oa_professional_837p_id = '62308' WHERE name = 'Cigna';
UPDATE payers SET oa_professional_837p_id = 'HLPUH' WHERE name = 'UnitedHealthcare';
UPDATE payers SET oa_professional_837p_id = 'SX107' WHERE name = 'Select Health';
UPDATE payers SET oa_professional_837p_id = 'SX109' WHERE name = 'Molina Healthcare';
UPDATE payers SET oa_professional_837p_id = '00910' WHERE name = 'Regence BlueCross BlueShield';
UPDATE payers SET oa_professional_837p_id = 'U7632' WHERE name = 'MotivHealth';

-- Add missing payers from production
INSERT INTO payers (name, oa_professional_837p_id, is_active) VALUES
  ('Anthem Blue Cross of California', 'BC001', true),
  ('First Health Network', '76251', true),
  ('HealthyU (UUHP)', 'SX155', true),
  ('Idaho Medicaid', 'MCDID', true),
  ('International Benefits Administrators (First Health Network)', '11329', true),
  ('Optum Salt Lake and Tooele County Medicaid Network', 'U6885', true),
  ('SelectHealth Integrated', 'SX107', true),
  ('Signature', '60054', true),
  ('TRICARE West', '99726', true),
  ('University of Utah Health Plans (UUHP)', 'SX155', true),
  ('Utah Medicaid Fee-for-Service', 'SKUT0', true)
ON CONFLICT (name) DO UPDATE SET
  oa_professional_837p_id = EXCLUDED.oa_professional_837p_id,
  is_active = EXCLUDED.is_active;

-- Rename "Medicaid Utah" to match production naming
UPDATE payers SET
  name = 'Utah Medicaid Fee-for-Service',
  oa_professional_837p_id = 'SKUT0'
WHERE name = 'Medicaid Utah';

-- Rename "Molina Healthcare" to "Molina Utah" to match production
UPDATE payers SET name = 'Molina Utah' WHERE name = 'Molina Healthcare';

-- Rename "Select Health" to "SelectHealth" (no space) to match production
UPDATE payers SET name = 'SelectHealth' WHERE name = 'Select Health';

-- Add payer name mappings for common IntakeQ variations
INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, p.id, 'high'
FROM payers p
CROSS JOIN (VALUES
  ('United Healthcare'),
  ('UnitedHealthcare'),
  ('United Health Care'),
  ('UHC'),
  ('United')
) AS aliases(alias)
WHERE p.name = 'UnitedHealthcare'
ON CONFLICT DO NOTHING;

INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, p.id, 'high'
FROM payers p
CROSS JOIN (VALUES
  ('SelectHealth'),
  ('Select Health'),
  ('Selecthealth'),
  ('IHC')
) AS aliases(alias)
WHERE p.name = 'SelectHealth'
ON CONFLICT DO NOTHING;

INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, p.id, 'high'
FROM payers p
CROSS JOIN (VALUES
  ('Regence'),
  ('Regence BCBS'),
  ('Regence Blue Cross'),
  ('Regence BlueCross')
) AS aliases(alias)
WHERE p.name = 'Regence BlueCross BlueShield'
ON CONFLICT DO NOTHING;

INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, p.id, 'high'
FROM payers p
CROSS JOIN (VALUES
  ('TRICARE'),
  ('Tricare West'),
  ('Tricare')
) AS aliases(alias)
WHERE p.name = 'TRICARE West'
ON CONFLICT DO NOTHING;

INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, p.id, 'high'
FROM payers p
CROSS JOIN (VALUES
  ('Molina'),
  ('Molina Utah'),
  ('Molina Healthcare')
) AS aliases(alias)
WHERE p.name = 'Molina Utah'
ON CONFLICT DO NOTHING;

INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, p.id, 'high'
FROM payers p
CROSS JOIN (VALUES
  ('UUHP'),
  ('University of Utah Health Plans'),
  ('U of U Health Plans'),
  ('HealthyU')
) AS aliases(alias)
WHERE p.name IN ('HealthyU (UUHP)', 'University of Utah Health Plans (UUHP)')
ON CONFLICT DO NOTHING;

-- Verify the updates
SELECT name, oa_professional_837p_id FROM payers ORDER BY name;
