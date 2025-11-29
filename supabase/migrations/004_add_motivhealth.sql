-- Add MotivHealth payer and aliases
-- MotivHealth is a Utah-based health insurance company

-- First, add MotivHealth to payers table
-- NOTE: The oa_professional_837p_id may need verification with Office Ally's payer list
INSERT INTO payers (name, oa_professional_837p_id, is_active) VALUES
  ('MotivHealth', 'MOTIV', true)
ON CONFLICT (name) DO UPDATE SET
  oa_professional_837p_id = EXCLUDED.oa_professional_837p_id,
  is_active = EXCLUDED.is_active;

-- Add aliases for MotivHealth to payer_name_mappings
-- Get the payer_id for MotivHealth
WITH motivhealth_payer AS (
  SELECT id FROM payers WHERE name = 'MotivHealth'
)
INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence)
SELECT alias, mp.id, 'high'
FROM motivhealth_payer mp
CROSS JOIN (VALUES
  ('MotivHealth'),
  ('Motiv Health'),
  ('MOTIVHEALTH'),
  ('Motiv'),
  ('MotivHealth Insurance'),
  ('Motiv Health Insurance')
) AS aliases(alias)
ON CONFLICT (intakeq_carrier_name) DO UPDATE SET
  payer_id = EXCLUDED.payer_id,
  confidence = EXCLUDED.confidence;

-- Verify the additions
SELECT p.name, p.oa_professional_837p_id, COUNT(m.id) as alias_count
FROM payers p
LEFT JOIN payer_name_mappings m ON m.payer_id = p.id
WHERE p.name = 'MotivHealth'
GROUP BY p.id, p.name, p.oa_professional_837p_id;
