# Moonlit Claims App - LLM Build Guide

> **Version**: 1.0 MVP  
> **Philosophy**: Build small, test thoroughly, iterate confidently  
> **Last Updated**: November 2024

---

## Table of Contents

1. [Vision & Roadmap](#1-vision--roadmap)
2. [V1 MVP Specification](#2-v1-mvp-specification)
3. [Technical Foundation](#3-technical-foundation)
4. [Database Schema (MVP)](#4-database-schema-mvp)
5. [API Integrations (MVP)](#5-api-integrations-mvp)
6. [Implementation Guide](#6-implementation-guide)
7. [File Structure (MVP)](#7-file-structure-mvp)
8. [Testing Checklist](#8-testing-checklist)
9. [Future Phases (Reference Only)](#9-future-phases-reference-only)

---

## 1. Vision & Roadmap

### 1.1 The Dream (Long-Term)

Build the ultimate revenue cycle management platform for Moonlit psychiatry practice:

```
Patient Visit → Claim Generation → Submission → Reimbursement → Provider Payment
     ↓              ↓                 ↓              ↓               ↓
  IntakeQ      AI-Powered        Office Ally     835 ERA         Reconciliation
              CPT/ICD-10          SFTP          Parsing          Dashboard
```

### 1.2 The Reality (How We Get There)

**We build in phases. Each phase must work reliably before moving to the next.**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  V1 MVP (NOW)                                                           │
│  ─────────────                                                          │
│  • Dashboard: View appointments with claim status                       │
│  • Modal: CMS-1500 form for manual data entry                          │
│  • Submit: Send claim to Office Ally via SFTP                          │
│                                                                         │
│  Success = I can create and submit a claim in under 5 minutes          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  V2 Auto-Population + Reconciliation                                    │
│  ────────────────────────────────────                                   │
│  • Pull patient data from IntakeQ Client API                           │
│  • Auto-fill CMS-1500 fields (name, DOB, address, insurance)           │
│  • Manual override for any field                                        │
│  • **Claim Status Reconciliation**: Parse Office Ally 999/277 response │
│    files to sync claim statuses with external submissions (IntakeQ)    │
│  • Reconcile claims submitted via IntakeQ with our database            │
│                                                                         │
│  Success = 80%+ of fields auto-populated correctly                     │
│  Success = All claim statuses accurate regardless of submission source │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  V3 AI-Powered Coding                                                   │
│  ────────────────────                                                   │
│  • "Code My Note" button fetches clinical note                         │
│  • Gemini extracts diagnoses → ICD-10 codes                            │
│  • Gemini suggests CPT codes based on E/M criteria                     │
│  • One-click accept or manual override                                  │
│                                                                         │
│  Success = AI suggestions accepted 85%+ of the time                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  V4 Provider Selection & Validation                                     │
│  ──────────────────────────────────                                     │
│  • Select rendering provider (visit provider OR supervising doctor)    │
│  • Smart NPI selection based on payer credentialing rules              │
│  • Pre-submission validation against Office Ally requirements          │
│                                                                         │
│  Success = Zero claim rejections due to provider/validation errors     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  V5 Revenue Cycle Management                                            │
│  ───────────────────────────                                            │
│  • Track claim status (submitted → accepted → paid)                    │
│  • Parse 835 ERAs for payment details                                  │
│  • Match payments to claims                                             │
│  • Reconciliation dashboard                                             │
│                                                                         │
│  Success = Complete visibility from appointment to payment             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Current Focus: V1 MVP Only

**Everything in this document focuses on V1 unless marked as "FUTURE".**

Do not build V2+ features until V1 is:
- ✅ Fully functional
- ✅ Tested with real appointments
- ✅ Successfully submitted claims to Office Ally
- ✅ Confirmed claims accepted by payers

---

## 2. V1 MVP Specification

### 2.1 What We're Building

A simple claims submission app with three screens/states:

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPOINTMENTS DASHBOARD                        │
│                                                                  │
│  Filter: [Last 30 Days ▼]  Search: [________________]           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Oct 15, 2024 • 2:00 PM                                     │ │
│  │ Patient: Jane Doe                                          │ │
│  │ Provider: Dr. Smith                                        │ │
│  │ Service: Psychiatric Evaluation                            │ │
│  │                                                            │ │
│  │ [Not Submitted]                        [Make Claim]        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Oct 14, 2024 • 10:00 AM                                    │ │
│  │ Patient: John Smith                                        │ │
│  │ Provider: Dr. Jones                                        │ │
│  │ Service: Follow-up Visit                                   │ │
│  │                                                            │ │
│  │ [Submitted ✓]                          [View Claim]        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                      CMS-1500 CLAIM FORM                         │
│                                                                  │
│  ┌─ Patient Information ─────────────────────────────────────┐  │
│  │ First Name: [____________]  Last Name: [____________]     │  │
│  │ DOB: [__/__/____]  Gender: [M/F/U ▼]                     │  │
│  │ Address: [________________________________]               │  │
│  │ City: [____________] State: [__] ZIP: [_____]            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Insurance Information ───────────────────────────────────┐  │
│  │ Payer: [Select Payer ▼]                                   │  │
│  │ Member ID: [____________]  Group #: [____________]        │  │
│  │ Subscriber Name: [____________]  Relationship: [Self ▼]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Diagnosis Codes ─────────────────────────────────────────┐  │
│  │ 1. [F41.1  ] Generalized Anxiety Disorder (Primary)       │  │
│  │ 2. [F33.0  ] Major Depressive Disorder                    │  │
│  │ [+ Add Diagnosis]                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Service Lines ───────────────────────────────────────────┐  │
│  │ DOS: [10/15/2024]  CPT: [99214]  Charge: [$150.00]       │  │
│  │ [+ Add Service Line]                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Provider Information ────────────────────────────────────┐  │
│  │ Rendering Provider NPI: [__________]                      │  │
│  │ Billing Provider NPI: [__________] (Moonlit PLLC)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│              [Cancel]  [Save Draft]  [Submit Claim]             │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUBMISSION RESULT                           │
│                                                                  │
│                         ✓ Success!                               │
│                                                                  │
│  Claim submitted to Office Ally                                  │
│  File: MOONLIT_20241015_153045.837                              │
│  Transaction ID: 1234567890                                      │
│                                                                  │
│  The claim will be routed to: Blue Cross Blue Shield            │
│                                                                  │
│                    [Back to Dashboard]                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 User Flow

```
1. User opens app → sees Dashboard with appointments from IntakeQ
2. User finds appointment → clicks "Make Claim"
3. Modal opens → user manually enters all claim data
4. User clicks "Submit Claim"
5. System generates X12 837P EDI file
6. System uploads to Office Ally SFTP
7. User sees success/failure message
8. Dashboard updates to show "Submitted" status
```

### 2.3 MVP Scope - What's IN

| Feature | Description |
|---------|-------------|
| Appointment list | Fetch and display from IntakeQ Appointments API |
| Date filtering | Filter appointments by date range |
| Search | Search by patient name or provider |
| Claim status badge | Show: Not Submitted, Submitted, (future: Accepted, Rejected, Paid) |
| CMS-1500 modal | Manual data entry form with all required fields |
| Payer selection | Dropdown with configured payers and their Office Ally IDs |
| X12 837P generation | Convert form data to valid EDI file |
| SFTP submission | Upload EDI file to Office Ally |
| Basic validation | Required fields, format checks (NPI, ICD-10, CPT) |
| Claim storage | Save submitted claims to database |

### 2.4 MVP Scope - What's OUT (for now)

| Feature | Deferred To |
|---------|-------------|
| Auto-population from IntakeQ Client API | V2 |
| AI-powered diagnosis/CPT coding | V3 |
| Rendering provider selection logic | V4 |
| Eligibility verification | V4 |
| 835 ERA parsing | V5 |
| 277 Status tracking | V5 |
| Payment reconciliation | V5 |
| Copay tracking | V5 |

---

## 3. Technical Foundation

### 3.1 Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Framework** | Next.js 14 (App Router) | Full-stack React with API routes |
| **Language** | TypeScript | Type safety prevents bugs |
| **Styling** | Tailwind CSS | Fast UI development |
| **Database** | Supabase (PostgreSQL) | Easy setup, good free tier |
| **SFTP** | ssh2-sftp-client | Reliable SFTP for Office Ally |
| **Validation** | Zod | Schema validation |
| **Date Utils** | date-fns | Date formatting |

### 3.2 External Services (MVP)

| Service | Purpose | What We Use |
|---------|---------|-------------|
| **IntakeQ** | Appointments source | Appointments API only |
| **Office Ally** | Claim submission | SFTP upload only |
| **Supabase** | Data storage | Claims, payers, providers tables |

### 3.3 Environment Variables

```bash
# .env.local

# IntakeQ - for fetching appointments
INTAKEQ_API_KEY=your_api_key_here

# Office Ally SFTP - for submitting claims
OFFICE_ALLY_SFTP_HOST=sftp.officeally.com
OFFICE_ALLY_SFTP_PORT=22
OFFICE_ALLY_SFTP_USER=your_username
OFFICE_ALLY_SFTP_PASSWORD=your_password

# Supabase - for storing claims and config
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App Config
MOONLIT_BILLING_NPI=1234567890
MOONLIT_BILLING_TIN=123456789
MOONLIT_SENDER_ID=MOONLIT
```

---

## 4. Database Schema (MVP)

### 4.1 Overview

For MVP, we need only 3 tables:
- `providers` - Who can render/bill services
- `payers` - Insurance companies and their Office Ally IDs
- `claims` - Submitted claims and their status

### 4.2 Providers Table

```sql
-- Stores provider information for claim generation
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  npi TEXT UNIQUE NOT NULL,           -- 10-digit NPI
  type TEXT NOT NULL CHECK (type IN ('individual', 'organization')),
  
  -- Contact (for claim forms)
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,                 -- 2-letter code
  address_zip TEXT,                   -- 5 or 9 digit
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for NPI lookups
CREATE INDEX idx_providers_npi ON providers(npi);
```

**Seed Data:**
```sql
-- Moonlit organization (billing provider)
INSERT INTO providers (name, npi, type, phone, address_street, address_city, address_state, address_zip)
VALUES (
  'MOONLIT PLLC',
  '1234567890',  -- Replace with actual NPI
  'organization',
  '801-555-0100',
  '123 Medical Plaza',
  'Salt Lake City',
  'UT',
  '84101'
);

-- Add individual providers as needed
```

### 4.3 Payers Table

```sql
-- Insurance payers with Office Ally configuration
CREATE TABLE payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,                        -- Display name
  office_ally_payer_id TEXT NOT NULL,        -- OA's payer ID for 837P
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_payers_name ON payers(name);
```

**Seed Data:**
```sql
-- Common payers - UPDATE THESE WITH YOUR ACTUAL OFFICE ALLY PAYER IDs
INSERT INTO payers (name, office_ally_payer_id) VALUES
  ('Blue Cross Blue Shield of Utah', 'BCBSUT'),
  ('UnitedHealthcare', 'UHC00'),
  ('Aetna', 'AETNA'),
  ('Cigna', 'CIGNA'),
  ('Medicare', 'MCARE'),
  ('Medicaid Utah', 'UTMED'),
  ('Select Health', 'SELHL'),
  ('DMBA', 'DMBA0'),
  ('PEHP', 'PEHP0');

-- IMPORTANT: Verify these payer IDs in your Office Ally account!
-- Wrong payer IDs = claim routing failures
```

### 4.4 Claims Table

```sql
-- Submitted claims with all CMS-1500 data
CREATE TABLE claims (
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
  -- Format: [{"code": "F41.1", "description": "GAD", "is_primary": true}]
  
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
  -- Valid statuses for MVP: draft, submitted, failed
  
  submitted_at TIMESTAMPTZ,
  edi_filename TEXT,              -- e.g., MOONLIT_20241015_153045.837
  edi_content TEXT,               -- Store the raw EDI for debugging
  submission_error TEXT,          -- Error message if failed
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_claims_appointment ON claims(intakeq_appointment_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_submitted_at ON claims(submitted_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 4.5 Running Migrations

Option A: **Supabase Dashboard** (Recommended for setup)
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Paste each CREATE TABLE statement
4. Click Run

Option B: **Supabase CLI**
```bash
supabase db push
```

---

## 5. API Integrations (MVP)

### 5.1 IntakeQ Appointments API

**Purpose:** Fetch appointments to display on dashboard

**Endpoint:** `GET https://intakeq.com/api/v1/appointments`

**Authentication:**
```typescript
headers: {
  'X-Auth-Key': process.env.INTAKEQ_API_KEY
}
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| startDate | string | ISO date (e.g., '2024-01-01') |
| endDate | string | ISO date |
| practitionerId | string | Optional filter |

**Response:**
```typescript
// Returns array directly (not nested)
[
  {
    "Id": "abc123",
    "StartDateIso": "2024-10-15T14:00:00",
    "EndDateIso": "2024-10-15T15:00:00",
    "ClientId": "client456",
    "ClientName": "Jane Doe",
    "PractitionerId": "pract789",
    "PractitionerName": "Dr. Smith",
    "PractitionerEmail": "dr.smith@moonlit.com",
    "ServiceId": "svc001",
    "ServiceName": "Psychiatric Evaluation",
    "Status": "Completed",
    "Price": 250.00
  },
  // ... more appointments
]
```

**Implementation:**
```typescript
// services/intakeq.ts
import axios from 'axios';

const intakeqClient = axios.create({
  baseURL: 'https://intakeq.com/api/v1',
  headers: {
    'X-Auth-Key': process.env.INTAKEQ_API_KEY || '',
  },
  timeout: 30000,
});

export interface IntakeQAppointment {
  Id: string;
  StartDateIso: string;
  EndDateIso: string;
  ClientId: string;
  ClientName: string;
  PractitionerId: string;
  PractitionerName: string;
  ServiceName: string;
  Status: string;
  Price: number;
}

export async function getAppointments(params: {
  startDate: string;
  endDate: string;
}): Promise<IntakeQAppointment[]> {
  try {
    const response = await intakeqClient.get('/appointments', { params });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('IntakeQ API error:', error);
    throw new Error('Failed to fetch appointments');
  }
}
```

### 5.2 Office Ally SFTP

**Purpose:** Submit X12 837P claim files

**Connection:**
```typescript
const sftpConfig = {
  host: process.env.OFFICE_ALLY_SFTP_HOST,
  port: parseInt(process.env.OFFICE_ALLY_SFTP_PORT || '22'),
  username: process.env.OFFICE_ALLY_SFTP_USER,
  password: process.env.OFFICE_ALLY_SFTP_PASSWORD,
};
```

**File Naming Convention:**
```
SENDERID_YYYYMMDD_HHMMSS.837
Example: MOONLIT_20241015_153045.837
```

**Upload Directory:** `/outbound/`

**Implementation:**
```typescript
// services/officeAlly.ts
import Client from 'ssh2-sftp-client';

export async function submitClaimToOfficeAlly(
  ediContent: string,
  claimId: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  const sftp = new Client();
  
  try {
    await sftp.connect({
      host: process.env.OFFICE_ALLY_SFTP_HOST,
      port: parseInt(process.env.OFFICE_ALLY_SFTP_PORT || '22'),
      username: process.env.OFFICE_ALLY_SFTP_USER,
      password: process.env.OFFICE_ALLY_SFTP_PASSWORD,
    });

    // Generate filename
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const filename = `MOONLIT_${timestamp}.837`;
    const remotePath = `/outbound/${filename}`;

    // Upload
    await sftp.put(Buffer.from(ediContent, 'utf-8'), remotePath);

    await sftp.end();

    return { success: true, filename };
  } catch (error) {
    await sftp.end();
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'SFTP upload failed' 
    };
  }
}

export async function testSFTPConnection(): Promise<boolean> {
  const sftp = new Client();
  
  try {
    await sftp.connect({
      host: process.env.OFFICE_ALLY_SFTP_HOST,
      port: parseInt(process.env.OFFICE_ALLY_SFTP_PORT || '22'),
      username: process.env.OFFICE_ALLY_SFTP_USER,
      password: process.env.OFFICE_ALLY_SFTP_PASSWORD,
    });
    
    await sftp.list('/');
    await sftp.end();
    return true;
  } catch (error) {
    await sftp.end();
    return false;
  }
}
```

### 5.3 X12 837P Generation

**Purpose:** Convert claim form data to X12 EDI format

The 837P is the standard format for professional (physician) claims. It's a complex format, but for MVP we need a working subset.

**Key Segments:**
- `ISA` - Interchange header
- `GS` - Functional group header
- `ST` - Transaction set header
- `BHT` - Beginning of hierarchical transaction
- `HL` - Hierarchical levels (billing, subscriber, patient)
- `NM1` - Name segments (payer, provider, patient)
- `CLM` - Claim information
- `HI` - Diagnosis codes
- `SV1` - Professional service line
- `SE/GE/IEA` - Footers

**Implementation:**
```typescript
// services/ediGenerator.ts

interface ClaimData {
  // Patient
  patientFirstName: string;
  patientLastName: string;
  patientDob: string; // YYYYMMDD
  patientGender: 'M' | 'F' | 'U';
  patientAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  
  // Insurance
  payerId: string; // Office Ally payer ID
  memberId: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberDob: string;
  subscriberRelationship: 'self' | 'spouse' | 'child' | 'other';
  
  // Diagnoses
  diagnosisCodes: Array<{
    code: string;
    isPrimary: boolean;
  }>;
  
  // Service lines
  serviceLines: Array<{
    dos: string; // YYYYMMDD
    cpt: string;
    modifier?: string;
    units: number;
    charge: number;
    diagnosisPointers: number[]; // 1-based index into diagnosisCodes
  }>;
  
  // Providers
  renderingNpi: string;
  billingNpi: string;
  billingTin: string;
  billingName: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  
  // Control numbers
  controlNumber: string; // Unique per claim
}

export function generate837P(claim: ClaimData): string {
  const segments: string[] = [];
  const date = new Date();
  const dateStr = formatDate(date, 'YYMMDD');
  const timeStr = formatDate(date, 'HHmm');
  const fullDateStr = formatDate(date, 'YYYYMMDD');
  
  // ISA - Interchange Control Header
  segments.push(
    `ISA*00*          *00*          *ZZ*${pad(process.env.MOONLIT_SENDER_ID || 'MOONLIT', 15)}*ZZ*${pad(claim.payerId, 15)}*${dateStr}*${timeStr}*^*00501*${pad(claim.controlNumber, 9, '0')}*0*P*:~`
  );
  
  // GS - Functional Group Header
  segments.push(
    `GS*HC*${process.env.MOONLIT_SENDER_ID || 'MOONLIT'}*${claim.payerId}*${fullDateStr}*${timeStr}*${claim.controlNumber}*X*005010X222A1~`
  );
  
  // ST - Transaction Set Header
  segments.push(`ST*837*0001*005010X222A1~`);
  
  // BHT - Beginning of Hierarchical Transaction
  segments.push(
    `BHT*0019*00*${claim.controlNumber}*${fullDateStr}*${timeStr}*CH~`
  );
  
  // NM1 - Submitter Name (Loop 1000A)
  segments.push(`NM1*41*2*${claim.billingName}*****46*${claim.billingTin}~`);
  segments.push(`PER*IC*BILLING*TE*8015550100~`);
  
  // NM1 - Receiver Name (Loop 1000B)
  segments.push(`NM1*40*2*${claim.payerId}*****46*${claim.payerId}~`);
  
  // HL - Billing Provider Hierarchical Level (Loop 2000A)
  segments.push(`HL*1**20*1~`);
  segments.push(`PRV*BI*PXC*207Q00000X~`); // Taxonomy code for psychiatry
  
  // NM1 - Billing Provider Name (Loop 2010AA)
  segments.push(`NM1*85*2*${claim.billingName}*****XX*${claim.billingNpi}~`);
  segments.push(`N3*${claim.billingAddress.street}~`);
  segments.push(`N4*${claim.billingAddress.city}*${claim.billingAddress.state}*${claim.billingAddress.zip}~`);
  segments.push(`REF*EI*${claim.billingTin}~`);
  
  // HL - Subscriber Hierarchical Level (Loop 2000B)
  const isPatientSubscriber = claim.subscriberRelationship === 'self';
  segments.push(`HL*2*1*22*${isPatientSubscriber ? '0' : '1'}~`);
  segments.push(`SBR*P*${relationshipCode(claim.subscriberRelationship)}*${claim.groupNumber || ''}******CI~`);
  
  // NM1 - Subscriber Name (Loop 2010BA)
  const subscriberParts = claim.subscriberName.split(' ');
  const subLast = subscriberParts.pop() || '';
  const subFirst = subscriberParts.join(' ') || '';
  segments.push(`NM1*IL*1*${subLast}*${subFirst}****MI*${claim.memberId}~`);
  
  if (isPatientSubscriber) {
    // Patient is subscriber - include address here
    segments.push(`N3*${claim.patientAddress.street}~`);
    segments.push(`N4*${claim.patientAddress.city}*${claim.patientAddress.state}*${claim.patientAddress.zip}~`);
    segments.push(`DMG*D8*${claim.patientDob}*${claim.patientGender}~`);
  }
  
  // NM1 - Payer Name (Loop 2010BB)
  segments.push(`NM1*PR*2*${claim.payerId}*****PI*${claim.payerId}~`);
  
  // HL - Patient Hierarchical Level (Loop 2000C) - only if different from subscriber
  if (!isPatientSubscriber) {
    segments.push(`HL*3*2*23*0~`);
    segments.push(`PAT*${relationshipCode(claim.subscriberRelationship)}~`);
    
    // NM1 - Patient Name (Loop 2010CA)
    segments.push(`NM1*QC*1*${claim.patientLastName}*${claim.patientFirstName}~`);
    segments.push(`N3*${claim.patientAddress.street}~`);
    segments.push(`N4*${claim.patientAddress.city}*${claim.patientAddress.state}*${claim.patientAddress.zip}~`);
    segments.push(`DMG*D8*${claim.patientDob}*${claim.patientGender}~`);
  }
  
  // CLM - Claim Information (Loop 2300)
  const totalCharge = claim.serviceLines.reduce((sum, line) => sum + line.charge, 0);
  segments.push(`CLM*${claim.controlNumber}*${totalCharge.toFixed(2)}***11:B:1*Y*A*Y*Y~`);
  
  // HI - Diagnosis Codes
  const diagCodes = claim.diagnosisCodes
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    .map((d, i) => `${i === 0 ? 'ABK' : 'ABF'}:${d.code.replace('.', '')}`)
    .join('*');
  segments.push(`HI*${diagCodes}~`);
  
  // NM1 - Rendering Provider (Loop 2310B)
  segments.push(`NM1*82*1******XX*${claim.renderingNpi}~`);
  segments.push(`PRV*PE*PXC*207Q00000X~`);
  
  // Service Lines (Loop 2400)
  claim.serviceLines.forEach((line, index) => {
    const lineNum = index + 1;
    segments.push(`LX*${lineNum}~`);
    
    // SV1 - Professional Service
    const diagPointers = line.diagnosisPointers.join(':');
    const modifier = line.modifier ? `:${line.modifier}` : '';
    segments.push(
      `SV1*HC:${line.cpt}${modifier}*${line.charge.toFixed(2)}*UN*${line.units}***${diagPointers}~`
    );
    
    // DTP - Service Date
    segments.push(`DTP*472*D8*${line.dos}~`);
  });
  
  // SE - Transaction Set Trailer
  const segmentCount = segments.length + 1; // +1 for SE itself
  segments.push(`SE*${segmentCount}*0001~`);
  
  // GE - Functional Group Trailer
  segments.push(`GE*1*${claim.controlNumber}~`);
  
  // IEA - Interchange Control Trailer
  segments.push(`IEA*1*${pad(claim.controlNumber, 9, '0')}~`);
  
  return segments.join('\n');
}

// Helper functions
function pad(str: string, length: number, char = ' '): string {
  return str.padEnd(length, char).slice(0, length);
}

function formatDate(date: Date, format: string): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  
  return format
    .replace('YYYY', y)
    .replace('YY', y.slice(-2))
    .replace('MM', m)
    .replace('DD', d)
    .replace('HH', h)
    .replace('mm', min);
}

function relationshipCode(rel: string): string {
  const codes: Record<string, string> = {
    'self': '18',
    'spouse': '01',
    'child': '19',
    'other': '21',
  };
  return codes[rel] || '18';
}
```

---

## 6. Implementation Guide

### 6.1 Project Setup

```bash
# Create Next.js project
npx create-next-app@latest moonlit-claims --typescript --tailwind --app --use-npm

cd moonlit-claims

# Install dependencies
npm install @supabase/supabase-js axios ssh2-sftp-client zod date-fns

# Install dev dependencies
npm install -D @types/ssh2-sftp-client
```

### 6.2 Directory Structure

Create this structure:
```
moonlit-claims/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # Redirect to /dashboard
│   ├── dashboard/
│   │   └── page.tsx          # Main appointments dashboard
│   └── api/
│       ├── appointments/
│       │   └── route.ts      # GET appointments from IntakeQ
│       ├── payers/
│       │   └── route.ts      # GET payers from database
│       └── claims/
│           └── route.ts      # POST to create/submit claim
├── components/
│   ├── AppointmentCard.tsx
│   ├── ClaimModal.tsx
│   ├── StatusBadge.tsx
│   └── DateFilter.tsx
├── services/
│   ├── intakeq.ts
│   ├── officeAlly.ts
│   ├── ediGenerator.ts
│   └── supabase.ts
├── types/
│   └── index.ts
└── lib/
    └── utils.ts
```

### 6.3 Build Order

**Step 1: Environment & Database (Day 1)**
- [ ] Create `.env.local` with all credentials
- [ ] Create Supabase project
- [ ] Run database migrations (providers, payers, claims tables)
- [ ] Seed providers and payers data

**Step 2: Services Layer (Day 2)**
- [ ] Create `services/supabase.ts` - Supabase client
- [ ] Create `services/intakeq.ts` - IntakeQ API client
- [ ] Create `services/officeAlly.ts` - SFTP client
- [ ] Test each service independently

**Step 3: API Routes (Day 3)**
- [ ] Create `GET /api/appointments` - fetch from IntakeQ
- [ ] Create `GET /api/payers` - fetch from database
- [ ] Test API routes with Postman/curl

**Step 4: Dashboard UI (Day 4-5)**
- [ ] Create `StatusBadge` component
- [ ] Create `AppointmentCard` component
- [ ] Create `DateFilter` component
- [ ] Create Dashboard page
- [ ] Wire up data fetching

**Step 5: Claim Modal (Day 6-7)**
- [ ] Create modal structure with all CMS-1500 fields
- [ ] Add form validation
- [ ] Add payer dropdown
- [ ] Wire up to appointment data

**Step 6: EDI Generation & Submission (Day 8-9)**
- [ ] Create `services/ediGenerator.ts`
- [ ] Create `POST /api/claims` endpoint
- [ ] Test EDI generation (validate format)
- [ ] Test SFTP upload

**Step 7: Integration & Testing (Day 10)**
- [ ] End-to-end testing with real appointment
- [ ] Submit test claim to Office Ally
- [ ] Verify claim appears in Office Ally portal
- [ ] Fix any issues

### 6.4 Key Files Implementation

#### `/app/api/appointments/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAppointments } from '@/services/intakeq';
import { createClient } from '@/services/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Fetch appointments from IntakeQ
    const appointments = await getAppointments({ startDate, endDate });

    // Fetch claim statuses from our database
    const supabase = createClient();
    const appointmentIds = appointments.map(a => a.Id);
    
    const { data: claims } = await supabase
      .from('claims')
      .select('intakeq_appointment_id, status')
      .in('intakeq_appointment_id', appointmentIds);

    // Create status lookup
    const statusMap: Record<string, string> = {};
    claims?.forEach(c => {
      statusMap[c.intakeq_appointment_id] = c.status;
    });

    // Merge appointment data with claim status
    const enrichedAppointments = appointments.map(apt => ({
      ...apt,
      claimStatus: statusMap[apt.Id] || 'not_submitted',
    }));

    return NextResponse.json({ data: enrichedAppointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}
```

#### `/app/api/claims/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/services/supabase';
import { generate837P } from '@/services/ediGenerator';
import { submitClaimToOfficeAlly } from '@/services/officeAlly';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createClient();

    // Validate required fields
    const required = [
      'intakeq_appointment_id',
      'patient_first_name',
      'patient_last_name',
      'patient_dob',
      'payer_id',
      'member_id',
      'diagnosis_codes',
      'service_lines',
      'rendering_provider_npi',
    ];

    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Get payer info
    const { data: payer } = await supabase
      .from('payers')
      .select('*')
      .eq('id', body.payer_id)
      .single();

    if (!payer) {
      return NextResponse.json(
        { error: 'Invalid payer' },
        { status: 400 }
      );
    }

    // Generate control number
    const controlNumber = Date.now().toString().slice(-9);

    // Generate EDI content
    const ediContent = generate837P({
      patientFirstName: body.patient_first_name,
      patientLastName: body.patient_last_name,
      patientDob: body.patient_dob.replace(/-/g, ''),
      patientGender: body.patient_gender || 'U',
      patientAddress: {
        street: body.patient_address_street || '',
        city: body.patient_address_city || '',
        state: body.patient_address_state || '',
        zip: body.patient_address_zip || '',
      },
      payerId: payer.office_ally_payer_id,
      memberId: body.member_id,
      groupNumber: body.group_number,
      subscriberName: body.subscriber_name || `${body.patient_first_name} ${body.patient_last_name}`,
      subscriberDob: (body.subscriber_dob || body.patient_dob).replace(/-/g, ''),
      subscriberRelationship: body.subscriber_relationship || 'self',
      diagnosisCodes: body.diagnosis_codes,
      serviceLines: body.service_lines.map((line: any) => ({
        dos: line.dos.replace(/-/g, ''),
        cpt: line.cpt,
        modifier: line.modifier,
        units: line.units,
        charge: line.charge,
        diagnosisPointers: line.diagnosis_pointers || [1],
      })),
      renderingNpi: body.rendering_provider_npi,
      billingNpi: process.env.MOONLIT_BILLING_NPI!,
      billingTin: process.env.MOONLIT_BILLING_TIN!,
      billingName: 'MOONLIT PLLC',
      billingAddress: {
        street: '123 Medical Plaza',
        city: 'Salt Lake City',
        state: 'UT',
        zip: '84101',
      },
      controlNumber,
    });

    // Calculate total charge
    const totalCharge = body.service_lines.reduce(
      (sum: number, line: any) => sum + line.charge,
      0
    );

    // Save claim to database first
    const { data: claim, error: insertError } = await supabase
      .from('claims')
      .insert({
        intakeq_appointment_id: body.intakeq_appointment_id,
        patient_first_name: body.patient_first_name,
        patient_last_name: body.patient_last_name,
        patient_dob: body.patient_dob,
        patient_gender: body.patient_gender,
        patient_address_street: body.patient_address_street,
        patient_address_city: body.patient_address_city,
        patient_address_state: body.patient_address_state,
        patient_address_zip: body.patient_address_zip,
        payer_id: body.payer_id,
        member_id: body.member_id,
        group_number: body.group_number,
        subscriber_name: body.subscriber_name,
        subscriber_dob: body.subscriber_dob,
        subscriber_relationship: body.subscriber_relationship,
        diagnosis_codes: body.diagnosis_codes,
        service_lines: body.service_lines,
        rendering_provider_npi: body.rendering_provider_npi,
        billing_provider_npi: process.env.MOONLIT_BILLING_NPI,
        total_charge: totalCharge,
        status: 'draft',
        edi_content: ediContent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save claim' },
        { status: 500 }
      );
    }

    // Submit to Office Ally
    const submitResult = await submitClaimToOfficeAlly(ediContent, claim.id);

    if (submitResult.success) {
      // Update claim status to submitted
      await supabase
        .from('claims')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          edi_filename: submitResult.filename,
        })
        .eq('id', claim.id);

      return NextResponse.json({
        success: true,
        claimId: claim.id,
        filename: submitResult.filename,
        message: 'Claim submitted successfully',
      });
    } else {
      // Update claim with error
      await supabase
        .from('claims')
        .update({
          status: 'failed',
          submission_error: submitResult.error,
        })
        .eq('id', claim.id);

      return NextResponse.json(
        { error: submitResult.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Claim submission error:', error);
    return NextResponse.json(
      { error: 'Failed to process claim' },
      { status: 500 }
    );
  }
}
```

---

## 7. File Structure (MVP)

```
moonlit-claims/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Redirect to dashboard
│   ├── globals.css                # Global styles
│   ├── dashboard/
│   │   └── page.tsx               # Appointments dashboard
│   └── api/
│       ├── appointments/
│       │   └── route.ts           # GET - fetch from IntakeQ
│       ├── payers/
│       │   └── route.ts           # GET - fetch from database
│       └── claims/
│           └── route.ts           # POST - create & submit claim
│
├── components/
│   ├── AppointmentCard.tsx        # Single appointment display
│   ├── ClaimModal.tsx             # CMS-1500 form modal
│   ├── StatusBadge.tsx            # Claim status badge
│   └── DateFilter.tsx             # Date range picker
│
├── services/
│   ├── supabase.ts                # Supabase client
│   ├── intakeq.ts                 # IntakeQ API client
│   ├── officeAlly.ts              # SFTP client
│   └── ediGenerator.ts            # X12 837P generator
│
├── types/
│   └── index.ts                   # TypeScript types
│
├── lib/
│   └── utils.ts                   # Utility functions
│
├── .env.local                     # Environment variables
├── .env.example                   # Example env file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

**Total files for MVP: ~20 files**

---

## 8. Testing Checklist

### 8.1 Pre-Launch Testing

**IntakeQ Connection:**
- [ ] API key works
- [ ] Appointments fetch correctly
- [ ] Date filtering works
- [ ] All required fields present

**Database:**
- [ ] Supabase connection works
- [ ] Providers seeded correctly
- [ ] Payers seeded with correct Office Ally IDs
- [ ] Claims table accepts inserts

**Office Ally SFTP:**
- [ ] Connection test passes
- [ ] Can list files in `/outbound/`
- [ ] Can upload test file
- [ ] File appears in Office Ally portal

**EDI Generation:**
- [ ] Generated EDI has correct structure
- [ ] All required segments present
- [ ] Payer ID correct
- [ ] NPI numbers formatted correctly
- [ ] ICD-10 codes without decimals
- [ ] Charge amounts formatted correctly

### 8.2 End-to-End Test

1. [ ] Open dashboard
2. [ ] Verify appointments load
3. [ ] Click "Make Claim" on an appointment
4. [ ] Fill in all required fields
5. [ ] Select correct payer
6. [ ] Enter diagnosis codes
7. [ ] Enter service line(s)
8. [ ] Click "Submit Claim"
9. [ ] Verify success message
10. [ ] Verify claim appears in database with status "submitted"
11. [ ] Verify file uploaded to Office Ally SFTP
12. [ ] Verify claim appears in Office Ally portal
13. [ ] Wait for claim acceptance (may take hours)
14. [ ] Document any rejection reasons

### 8.3 Post-Launch Monitoring

- [ ] Check Office Ally daily for claim rejections
- [ ] Note rejection reasons and patterns
- [ ] Update EDI generator to fix common issues
- [ ] Keep track of success rate

---

## 9. Future Phases (Reference Only)

> **DO NOT BUILD THESE until V1 is working reliably!**

### V2: Auto-Population
- IntakeQ Client API integration
- Auto-fill patient demographics
- Auto-fill insurance info
- Visual indicators for auto-populated fields

### V3: AI-Powered Coding
- IntakeQ Notes API integration
- Gemini API for diagnosis extraction
- Gemini API for CPT code suggestions
- "Code My Note" button
- Confidence scores and reasoning

### V4: Provider Selection & Validation
- Rendering provider dropdown
- Payer credentialing rules
- Pre-submission validation
- Eligibility verification (Office Ally REALTIME)

### V5: Revenue Cycle Management
- SFTP polling for response files
- 999 acknowledgment parsing
- 277 status update parsing
- 835 ERA parsing
- Payment matching
- Reconciliation dashboard
- Provider payment tracking

---

## Quick Reference

### Environment Variables
```bash
INTAKEQ_API_KEY=
OFFICE_ALLY_SFTP_HOST=
OFFICE_ALLY_SFTP_PORT=22
OFFICE_ALLY_SFTP_USER=
OFFICE_ALLY_SFTP_PASSWORD=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MOONLIT_BILLING_NPI=
MOONLIT_BILLING_TIN=
MOONLIT_SENDER_ID=MOONLIT
```

### Key API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/appointments?startDate=&endDate= | Fetch appointments |
| GET | /api/payers | Fetch payer list |
| POST | /api/claims | Create & submit claim |

### Payer ID Format
Check your Office Ally account for exact payer IDs. They're usually 5-8 characters.

### Common ICD-10 Codes (Psychiatry)
| Code | Description |
|------|-------------|
| F41.1 | Generalized Anxiety Disorder |
| F41.0 | Panic Disorder |
| F33.0 | Major Depressive Disorder, Recurrent, Mild |
| F33.1 | Major Depressive Disorder, Recurrent, Moderate |
| F33.2 | Major Depressive Disorder, Recurrent, Severe |
| F32.1 | Major Depressive Episode, Moderate |
| F90.0 | ADHD, Predominantly Inattentive |
| F90.1 | ADHD, Predominantly Hyperactive |
| F90.2 | ADHD, Combined |
| F31.81 | Bipolar II Disorder |
| F43.10 | PTSD, Unspecified |

### Common CPT Codes (Psychiatry E/M)
| Code | Description |
|------|-------------|
| 99213 | Office visit, established, low complexity |
| 99214 | Office visit, established, moderate complexity |
| 99215 | Office visit, established, high complexity |
| 99204 | Office visit, new patient, moderate complexity |
| 99205 | Office visit, new patient, high complexity |
| 90833 | Psychotherapy add-on, 30 min |
| 90836 | Psychotherapy add-on, 45 min |
| 90837 | Psychotherapy add-on, 60 min |
| 90792 | Psychiatric diagnostic evaluation |

---

## Success Criteria for V1

✅ **V1 is complete when:**

1. Dashboard shows all IntakeQ appointments
2. Each appointment shows patient name, provider, date/time
3. Each appointment shows correct claim status badge
4. "Make Claim" opens working CMS-1500 modal
5. All required fields can be entered
6. Payer dropdown shows all configured payers
7. "Submit Claim" generates valid X12 837P
8. 837P successfully uploads to Office Ally SFTP
9. Claim appears in Office Ally portal
10. **At least 3 real claims accepted by payers**

Only then move to V2!

---

## Development Session Log

### Session 1: November 25, 2025 (Claude Opus 4.5)

**Approach**: Fresh V1 build referencing patterns from moonlit-claims-v2, balanced approach (port good code, clean types, modular ClaimModal)

#### Completed
- [x] Next.js 16 project with TypeScript, Tailwind, App Router
- [x] All core services: IntakeQ API, Office Ally SFTP, EDI 837P generator, Supabase client
- [x] API routes: `/api/appointments`, `/api/claims`, `/api/payers`, `/api/test-sftp`
- [x] Dashboard with appointment cards showing claim status
- [x] ClaimModal with CMS-1500 form sections
- [x] Adapted to existing v2 Supabase schema (`oa_professional_837p_id` instead of `office_ally_payer_id`)
- [x] Test mode for SFTP uploads (OATEST prefix) to avoid sending to real payers

#### Verified Working
- IntakeQ API: Fetching 62+ appointments ✓
- Office Ally SFTP: Connected to ftp10.officeally.com ✓
- Supabase: Payers table loading, claims table compatible ✓
- Dashboard: Shows appointments with accurate claim status ✓
- ClaimModal: Opens with payer dropdown populated ✓

#### Key Fixes Made
1. **IntakeQ doesn't use "Completed" status** - Changed logic to treat past "Confirmed" appointments as eligible for claims
2. **V2 schema compatibility** - Added fallback for `oa_professional_837p_id` / `office_ally_payer_id`
3. **SFTP username env var** - Support both `OFFICE_ALLY_SFTP_USERNAME` and `OFFICE_ALLY_SFTP_USER`
4. **Turbopack/SFTP compatibility** - Configured `serverExternalPackages` for ssh2-sftp-client

#### Outstanding for V1 Completion
- [ ] Test claim submission with OATEST file
- [ ] Verify 999 acknowledgment received from Office Ally
- [ ] Submit 3 real claims and confirm payer acceptance

#### Known Issue: Claim Status Accuracy
Claims submitted via IntakeQ (not through our app) may show as "Not Submitted" because they're not in our `claims` table. The cutoff is around Nov 18, 2025 when v2 stopped recording claims. **Solution planned for V2**: Parse Office Ally response files to reconcile all claim statuses.

#### Environment Notes
- Uses existing Supabase project with v2 payers table
- SFTP credentials: ftp10.officeally.com (same as v2)
- Test mode enabled by default (`testMode: true` in uploadClaim)

---

*Built with ❤️ for Moonlit Psychiatry*