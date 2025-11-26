-- Moonlit Claims V1 MVP Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- PAYERS TABLE
-- Insurance companies with Office Ally IDs
-- ============================================

CREATE TABLE IF NOT EXISTS payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  office_ally_payer_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payers_name ON payers(name);

-- ============================================
-- CLAIMS TABLE
-- Submitted claims with CMS-1500 data
-- ============================================

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intakeq_appointment_id TEXT NOT NULL,

  -- Patient Information
  patient_first_name TEXT NOT NULL,
  patient_last_name TEXT NOT NULL,
  patient_dob DATE NOT NULL,
  patient_gender TEXT CHECK (patient_gender IN ('M', 'F', 'U')),
  patient_address_street TEXT,
  patient_address_city TEXT,
  patient_address_state TEXT,
  patient_address_zip TEXT,

  -- Insurance Information
  payer_id UUID REFERENCES payers(id),
  member_id TEXT NOT NULL,
  group_number TEXT,
  subscriber_name TEXT,
  subscriber_dob DATE,
  subscriber_relationship TEXT DEFAULT 'self',

  -- Clinical Data (JSONB for flexibility)
  diagnosis_codes JSONB NOT NULL DEFAULT '[]',
  service_lines JSONB NOT NULL DEFAULT '[]',

  -- Provider Information
  rendering_provider_npi TEXT NOT NULL,
  billing_provider_npi TEXT NOT NULL,

  -- Financials
  total_charge DECIMAL(10,2) NOT NULL,

  -- Submission Tracking
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  edi_filename TEXT,
  edi_content TEXT,
  submission_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_appointment ON claims(intakeq_appointment_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at);

-- ============================================
-- SEED DATA: Common Utah Payers
-- IMPORTANT: Verify these Office Ally Payer IDs!
-- ============================================

INSERT INTO payers (name, office_ally_payer_id) VALUES
  ('Blue Cross Blue Shield of Utah', 'BCBSUT'),
  ('UnitedHealthcare', 'UHC00'),
  ('Aetna', 'AETNA'),
  ('Cigna', 'CIGNA'),
  ('Medicare', 'MCARE'),
  ('Medicaid Utah', 'UTMED'),
  ('Select Health', 'SELHL'),
  ('DMBA', 'DMBA0'),
  ('PEHP', 'PEHP0'),
  ('Regence BlueCross BlueShield', 'RGBSU'),
  ('Molina Healthcare', 'MOLIN'),
  ('Humana', 'HUMAN')
ON CONFLICT DO NOTHING;

-- ============================================
-- AUTO-UPDATE TRIGGER for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claims_updated_at ON claims;
CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VERIFY
-- ============================================

-- Check tables exist
SELECT 'payers' as table_name, count(*) as row_count FROM payers
UNION ALL
SELECT 'claims' as table_name, count(*) as row_count FROM claims;
