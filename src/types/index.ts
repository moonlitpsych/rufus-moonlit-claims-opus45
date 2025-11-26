// Core type definitions for Moonlit Claims V1 MVP

/**
 * Claim Status - V1 subset (expandable later)
 */
export type ClaimStatus = 'draft' | 'submitted' | 'failed';

/**
 * IntakeQ Appointment
 * Data structure from IntakeQ Appointments API
 */
export interface IntakeQAppointment {
  Id: string;
  ClientId: number;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientDateOfBirth: string | null;
  ServiceId: string;
  ServiceName: string;
  PractitionerId: string;
  PractitionerName: string;
  PractitionerEmail: string;
  StartDate: number; // Unix timestamp
  EndDate: number; // Unix timestamp
  StartDateIso: string;
  EndDateIso: string;
  StartDateLocal: string;
  EndDateLocal: string;
  StartDateLocalFormatted: string;
  Duration: number; // Minutes
  Status: 'Confirmed' | 'Completed' | 'Cancelled' | 'No-Show' | 'Scheduled';
  LocationId: string;
  LocationName: string;
  Price: number;
  PlaceOfService: string | null;
  IntakeId: string | null;
  DateCreated: number;
  CreatedBy: string;
  BookedByClient: boolean;
  InvoiceId: string | null;
  InvoiceNumber: string | null;
  ClientNote: string | null;
  PractitionerNote: string | null;
  LastModified: number;
}

/**
 * Appointment with claim status (enriched for dashboard)
 */
export interface AppointmentWithClaim extends IntakeQAppointment {
  claimStatus: ClaimStatus | 'not_submitted';
  claimId?: string;
}

/**
 * Payer Information
 */
export interface Payer {
  id: string;
  name: string;
  // V1 schema uses office_ally_payer_id, v2 schema uses oa_professional_837p_id
  office_ally_payer_id?: string;
  oa_professional_837p_id?: string | null;
  is_active?: boolean;
  created_at?: string;
}

/**
 * Diagnosis Code
 */
export interface DiagnosisCode {
  code: string; // ICD-10 code (e.g., "F41.1")
  description?: string;
  isPrimary: boolean;
}

/**
 * Service Line (CPT codes)
 */
export interface ServiceLine {
  dos: string; // Date of service (YYYY-MM-DD)
  cpt: string; // e.g., "99214"
  modifier?: string;
  units: number;
  charge: number; // Dollar amount
  diagnosis_pointers: number[]; // 1-based indices into diagnosis codes
}

/**
 * Subscriber Relationship
 */
export type SubscriberRelationship = 'self' | 'spouse' | 'child' | 'other';

/**
 * Claim Form Data (for CMS-1500 modal)
 */
export interface ClaimFormData {
  // Patient info
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string; // YYYY-MM-DD
  patient_gender: 'M' | 'F' | 'U';
  patient_address_street: string;
  patient_address_city: string;
  patient_address_state: string;
  patient_address_zip: string;

  // Insurance info
  payer_id: string;
  member_id: string;
  group_number?: string;
  subscriber_name?: string;
  subscriber_dob?: string;
  subscriber_relationship: SubscriberRelationship;

  // Clinical
  diagnosis_codes: DiagnosisCode[];
  service_lines: ServiceLine[];

  // Provider
  rendering_provider_npi: string;
}

/**
 * Claim (database record)
 */
export interface Claim {
  id: string;
  intakeq_appointment_id: string;

  // Patient
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string;
  patient_gender: 'M' | 'F' | 'U' | null;
  patient_address_street: string | null;
  patient_address_city: string | null;
  patient_address_state: string | null;
  patient_address_zip: string | null;

  // Insurance
  payer_id: string;
  member_id: string;
  group_number: string | null;
  subscriber_name: string | null;
  subscriber_dob: string | null;
  subscriber_relationship: SubscriberRelationship;

  // Clinical (JSONB)
  diagnosis_codes: DiagnosisCode[];
  service_lines: ServiceLine[];

  // Provider
  rendering_provider_npi: string;
  billing_provider_npi: string;

  // Financials
  total_charge: number;

  // Submission tracking
  status: ClaimStatus;
  submitted_at: string | null;
  edi_filename: string | null;
  edi_content: string | null;
  submission_error: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * API Response wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
}

/**
 * Validation Error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * EDI Claim Data (for 837P generation)
 */
export interface EDIClaimData {
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
  subscriberDob: string; // YYYYMMDD
  subscriberRelationship: SubscriberRelationship;

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
    diagnosisPointers: number[]; // 1-based indices
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
  controlNumber: string;
}

/**
 * Submit Claim Response
 */
export interface SubmitClaimResponse {
  success: boolean;
  claimId?: string;
  filename?: string;
  message?: string;
  error?: string;
}
