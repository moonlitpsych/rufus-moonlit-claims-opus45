-- ============================================
-- Moonlit Claims App - Complete Database Schema
-- V2: Foundation + Reconciliation
-- ============================================

-- ============================================
-- FOUNDATION TABLES (V1)
-- ============================================

-- Billing Providers (separate from existing providers table)
CREATE TABLE IF NOT EXISTS billing_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  npi TEXT UNIQUE NOT NULL,           -- 10-digit NPI
  type TEXT NOT NULL CHECK (type IN ('individual', 'organization')),
  taxonomy_code TEXT,                 -- e.g., '207Q00000X' for psychiatry

  -- Contact (for claim forms)
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,                 -- 2-letter code
  address_zip TEXT,                   -- 5 or 9 digit
  tax_id TEXT,                        -- TIN/EIN

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for NPI lookups
CREATE INDEX IF NOT EXISTS idx_billing_providers_npi ON billing_providers(npi);

-- Payers table (insurance companies)
CREATE TABLE IF NOT EXISTS payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  -- Office Ally payer ID for 837P routing
  office_ally_payer_id TEXT,
  oa_professional_837p_id TEXT,       -- Alternative column name

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for payer lookups
CREATE INDEX IF NOT EXISTS idx_payers_name ON payers(name);

-- Claims table (submitted claims with CMS-1500 data)
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to source appointment
  intakeq_appointment_id TEXT NOT NULL,

  -- Patient Information (Box 2, 3, 5)
  patient_first_name TEXT NOT NULL,
  patient_last_name TEXT NOT NULL,
  patient_dob DATE NOT NULL,
  patient_gender TEXT CHECK (patient_gender IN ('M', 'F', 'U')),
  patient_address_street TEXT,
  patient_address_city TEXT,
  patient_address_state TEXT,
  patient_address_zip TEXT,

  -- Insurance Information (Box 1a, 4, 7, 11)
  payer_id UUID REFERENCES payers(id),
  member_id TEXT NOT NULL,
  group_number TEXT,
  subscriber_name TEXT,
  subscriber_dob DATE,
  subscriber_relationship TEXT CHECK (subscriber_relationship IN ('self', 'spouse', 'child', 'other')),

  -- Diagnosis Codes (Box 21) - stored as JSON array
  diagnosis_codes JSONB NOT NULL DEFAULT '[]',
  -- Format: [{"code": "F41.1", "description": "GAD", "isPrimary": true}]

  -- Service Lines (Box 24) - stored as JSON array
  service_lines JSONB NOT NULL DEFAULT '[]',
  -- Format: [{"dos": "2024-10-15", "cpt": "99214", "modifier": null, "units": 1, "charge": 150.00, "diagnosis_pointers": [1]}]

  -- Provider Information (Box 17, 24J, 33)
  rendering_provider_npi TEXT NOT NULL,
  billing_provider_npi TEXT NOT NULL,

  -- Claim totals
  total_charge DECIMAL(10,2) NOT NULL,

  -- Submission tracking
  status TEXT NOT NULL DEFAULT 'draft',
  -- Valid statuses: draft, submitted, acknowledged, accepted, rejected, pending, paid, denied, failed

  submitted_at TIMESTAMPTZ,
  edi_filename TEXT,              -- e.g., MOONLIT_20241015_153045.837
  edi_content TEXT,               -- Store the raw EDI for debugging
  submission_error TEXT,          -- Error message if failed

  -- V2: Reconciliation fields
  control_number TEXT,            -- Our unique control number for matching responses
  payer_claim_number TEXT,        -- Payer's claim ID from 277/835
  acknowledgment_date TIMESTAMPTZ,-- When 999 received
  accepted_date TIMESTAMPTZ,      -- When 277 showed acceptance
  rejected_date TIMESTAMPTZ,      -- When 277/835 showed rejection
  paid_date TIMESTAMPTZ,          -- When 835 payment received
  paid_amount DECIMAL(10,2),      -- Amount from 835
  rejection_reason TEXT,          -- Reason from 277/835
  rejection_codes TEXT[],         -- Array of rejection codes
  submission_source TEXT DEFAULT 'moonlit' CHECK (submission_source IN ('moonlit', 'intakeq', 'manual', 'unknown')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for claims
CREATE INDEX IF NOT EXISTS idx_claims_appointment ON claims(intakeq_appointment_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at);
CREATE INDEX IF NOT EXISTS idx_claims_control_number ON claims(control_number);
CREATE INDEX IF NOT EXISTS idx_claims_payer_claim_number ON claims(payer_claim_number);

-- ============================================
-- V2: RECONCILIATION TABLES
-- ============================================

-- EDI Response Files (downloaded from Office Ally)
CREATE TABLE IF NOT EXISTS edi_response_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  filename TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL CHECK (file_type IN ('999', '277', '835')),
  file_content TEXT,              -- Raw EDI content

  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed')),
  processing_error TEXT,
  claims_matched INTEGER DEFAULT 0,
  claims_updated INTEGER DEFAULT 0,

  -- Timestamps
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edi_response_files_type ON edi_response_files(file_type);
CREATE INDEX IF NOT EXISTS idx_edi_response_files_status ON edi_response_files(processing_status);

-- Claim Status Events (audit trail)
CREATE TABLE IF NOT EXISTS claim_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  response_file_id UUID REFERENCES edi_response_files(id),

  previous_status TEXT,
  new_status TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('submission', '999', '277', '835', 'manual')),

  response_code TEXT,
  response_description TEXT,
  payment_amount DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_status_events_claim ON claim_status_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_status_events_created ON claim_status_events(created_at);

-- Payer Name Mappings (for IntakeQ carrier name matching)
CREATE TABLE IF NOT EXISTS payer_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  intakeq_carrier_name TEXT NOT NULL,
  payer_id UUID REFERENCES payers(id),
  confidence TEXT DEFAULT 'manual' CHECK (confidence IN ('high', 'medium', 'low', 'manual')),

  match_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payer_name_mappings_carrier ON payer_name_mappings(intakeq_carrier_name);

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to claims table
DROP TRIGGER IF EXISTS claims_updated_at ON claims;
CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Apply to billing_providers table
DROP TRIGGER IF EXISTS billing_providers_updated_at ON billing_providers;
CREATE TRIGGER billing_providers_updated_at
  BEFORE UPDATE ON billing_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: Common Utah Payers
-- ============================================

INSERT INTO payers (name, office_ally_payer_id, oa_professional_837p_id, is_active) VALUES
  ('Blue Cross Blue Shield of Utah', 'BCBSUT', 'BCBSUT', true),
  ('UnitedHealthcare', 'UHC00', 'UHC00', true),
  ('Aetna', 'AETNA', 'AETNA', true),
  ('Cigna', 'CIGNA', 'CIGNA', true),
  ('Medicare', 'MCARE', 'MCARE', true),
  ('Medicaid Utah', 'UTMED', 'UTMED', true),
  ('Select Health', 'SELHL', 'SELHL', true),
  ('DMBA', 'DMBA0', 'DMBA0', true),
  ('PEHP', 'PEHP0', 'PEHP0', true),
  ('Regence BlueCross BlueShield', 'REGBC', 'REGBC', true),
  ('Molina Healthcare', 'MOLIN', 'MOLIN', true),
  ('Humana', 'HUMAN', 'HUMAN', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED DATA: Payer Name Mappings (aliases)
-- ============================================

-- Get payer IDs for mapping
DO $$
DECLARE
  bcbs_id UUID;
  uhc_id UUID;
  aetna_id UUID;
  cigna_id UUID;
  medicare_id UUID;
  medicaid_id UUID;
  selecthealth_id UUID;
  dmba_id UUID;
  pehp_id UUID;
  regence_id UUID;
  molina_id UUID;
  humana_id UUID;
BEGIN
  SELECT id INTO bcbs_id FROM payers WHERE name = 'Blue Cross Blue Shield of Utah';
  SELECT id INTO uhc_id FROM payers WHERE name = 'UnitedHealthcare';
  SELECT id INTO aetna_id FROM payers WHERE name = 'Aetna';
  SELECT id INTO cigna_id FROM payers WHERE name = 'Cigna';
  SELECT id INTO medicare_id FROM payers WHERE name = 'Medicare';
  SELECT id INTO medicaid_id FROM payers WHERE name = 'Medicaid Utah';
  SELECT id INTO selecthealth_id FROM payers WHERE name = 'Select Health';
  SELECT id INTO dmba_id FROM payers WHERE name = 'DMBA';
  SELECT id INTO pehp_id FROM payers WHERE name = 'PEHP';
  SELECT id INTO regence_id FROM payers WHERE name = 'Regence BlueCross BlueShield';
  SELECT id INTO molina_id FROM payers WHERE name = 'Molina Healthcare';
  SELECT id INTO humana_id FROM payers WHERE name = 'Humana';

  -- BCBS aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('BCBS', bcbs_id, 'high'),
    ('Blue Cross', bcbs_id, 'high'),
    ('BlueCard', bcbs_id, 'high'),
    ('Anthem BCBS', bcbs_id, 'high'),
    ('BlueCross BlueShield', bcbs_id, 'high'),
    ('Blue Cross Blue Shield', bcbs_id, 'high')
  ON CONFLICT DO NOTHING;

  -- UHC aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('United', uhc_id, 'high'),
    ('UHC', uhc_id, 'high'),
    ('United Healthcare', uhc_id, 'high'),
    ('UnitedHealth', uhc_id, 'high'),
    ('Optum', uhc_id, 'medium')
  ON CONFLICT DO NOTHING;

  -- Aetna aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Aetna Health', aetna_id, 'high'),
    ('Aetna Life', aetna_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Cigna aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Cigna Health', cigna_id, 'high'),
    ('Cigna Healthcare', cigna_id, 'high'),
    ('CIGNA', cigna_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Medicare aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Medicare Part B', medicare_id, 'high'),
    ('Traditional Medicare', medicare_id, 'high'),
    ('CMS Medicare', medicare_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Medicaid aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Utah Medicaid', medicaid_id, 'high'),
    ('Medicaid', medicaid_id, 'medium'),
    ('UT Medicaid', medicaid_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Select Health aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('SelectHealth', selecthealth_id, 'high'),
    ('Intermountain Select', selecthealth_id, 'high')
  ON CONFLICT DO NOTHING;

  -- DMBA aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Deseret Mutual', dmba_id, 'high'),
    ('Deseret Mutual Benefit', dmba_id, 'high'),
    ('Deseret Mutual Benefit Administrators', dmba_id, 'high')
  ON CONFLICT DO NOTHING;

  -- PEHP aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Public Employee Health Program', pehp_id, 'high'),
    ('Public Employees Health', pehp_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Regence aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Regence', regence_id, 'high'),
    ('Regence BCBS', regence_id, 'high'),
    ('Regence Blue Cross', regence_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Molina aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Molina', molina_id, 'high'),
    ('Molina Health', molina_id, 'high')
  ON CONFLICT DO NOTHING;

  -- Humana aliases
  INSERT INTO payer_name_mappings (intakeq_carrier_name, payer_id, confidence) VALUES
    ('Humana Health', humana_id, 'high'),
    ('Humana Inc', humana_id, 'high')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE billing_providers IS 'Providers for medical billing (rendering/billing NPIs)';
COMMENT ON TABLE payers IS 'Insurance payers with Office Ally routing IDs';
COMMENT ON TABLE claims IS 'Submitted claims with CMS-1500 data and reconciliation tracking';
COMMENT ON TABLE edi_response_files IS 'Downloaded 999/277/835 files from Office Ally';
COMMENT ON TABLE claim_status_events IS 'Audit trail of claim status changes';
COMMENT ON TABLE payer_name_mappings IS 'IntakeQ carrier name to payer ID mappings';
