// Core type definitions for Moonlit Claims V2

/**
 * Claim Status - V2 extended with reconciliation statuses
 */
export type ClaimStatus =
  | 'draft'        // Created but not submitted
  | 'submitted'    // Uploaded to Office Ally SFTP
  | 'acknowledged' // 999 received - Office Ally got the file
  | 'accepted'     // 277 - Payer accepted claim for processing
  | 'rejected'     // 277 - Payer rejected claim
  | 'pending'      // 277 - Claim pending (needs info, under review)
  | 'paid'         // 835 - Payment received
  | 'denied'       // 835 - Claim denied (zero payment)
  | 'failed';      // Our submission failed (SFTP error, etc.)

/**
 * Display status includes external submissions
 */
export type ClaimDisplayStatus = ClaimStatus | 'not_submitted' | 'intakeq_submitted';

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
  claimStatus: ClaimDisplayStatus;
  claimId?: string;
}

/**
 * IntakeQ Client (from Client API)
 * Full patient profile including demographics and insurance
 * API: GET /clients?search={clientId}&includeProfile=true
 */
export interface IntakeQClient {
  ClientId: number;
  Name: string;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  Email: string;
  Phone?: string;
  HomePhone?: string;
  WorkPhone?: string;
  MobilePhone?: string;
  DateOfBirth?: number; // Unix timestamp in milliseconds
  Gender?: string; // "Male", "Female", "Other", etc.
  MaritalStatus?: string;

  // Address fields
  Address?: string; // Combined address
  StreetAddress?: string;
  City?: string;
  StateShort?: string; // 2-letter state code
  PostalCode?: string;
  Country?: string;
  UnitNumber?: string;

  // Primary Insurance (per IntakeQ Client API docs)
  PrimaryInsuranceCompany?: string;
  PrimaryInsurancePolicyNumber?: string; // Member ID
  PrimaryInsuranceGroupNumber?: string;
  PrimaryInsuranceHolderName?: string; // Subscriber name
  PrimaryInsuranceRelationship?: string; // "Self", "Spouse", "Child", "Other"
  PrimaryInsuranceHolderDateOfBirth?: number; // Unix timestamp

  // Secondary Insurance (same pattern)
  SecondaryInsuranceCompany?: string;
  SecondaryInsurancePolicyNumber?: string;
  SecondaryInsuranceGroupNumber?: string;
  SecondaryInsuranceHolderName?: string;
  SecondaryInsuranceRelationship?: string;
  SecondaryInsuranceHolderDateOfBirth?: number;

  // Billing type
  BillingType?: 'Self-Pay' | 'Insurance' | 'Unknown';

  // Metadata
  DateCreated?: number;
  LastActivityDate?: number;
  LastUpdateDate?: number;
}

/**
 * Auto-population field tracking
 * Tracks which fields were auto-filled from IntakeQ
 */
export interface AutoPopulatedFields {
  patient_first_name: boolean;
  patient_last_name: boolean;
  patient_dob: boolean;
  patient_gender: boolean;
  patient_address_street: boolean;
  patient_address_city: boolean;
  patient_address_state: boolean;
  patient_address_zip: boolean;
  payer_id: boolean;
  member_id: boolean;
  group_number: boolean;
  subscriber_name: boolean;
  subscriber_dob: boolean;
  subscriber_relationship: boolean;
}

/**
 * Payer match result from IntakeQ carrier name
 */
export interface PayerMatchResult {
  payer: Payer | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  intakeqCarrierName: string | null;
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

  // V2: Reconciliation fields
  control_number: string | null;
  payer_claim_number: string | null;
  acknowledgment_date: string | null;
  accepted_date: string | null;
  rejected_date: string | null;
  paid_date: string | null;
  paid_amount: number | null;
  rejection_reason: string | null;
  rejection_codes: string[] | null;
  submission_source: 'moonlit' | 'intakeq' | 'manual' | 'unknown' | null;

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

// ============================================
// V2: EDI Response Types for Reconciliation
// ============================================

/**
 * Response file types from Office Ally
 */
export type EDIResponseFileType = '999' | '277' | '835';

/**
 * EDI Response File (database record)
 */
export interface EDIResponseFile {
  id: string;
  filename: string;
  file_type: EDIResponseFileType;
  file_content: string | null;
  processing_status: 'pending' | 'processed' | 'failed';
  processing_error: string | null;
  claims_matched: number;
  claims_updated: number;
  downloaded_at: string;
  processed_at: string | null;
  created_at: string;
}

/**
 * Claim Status Event (audit trail)
 */
export interface ClaimStatusEvent {
  id: string;
  claim_id: string;
  response_file_id: string | null;
  previous_status: ClaimStatus | null;
  new_status: ClaimStatus;
  source: 'submission' | '999' | '277' | '835' | 'manual';
  response_code: string | null;
  response_description: string | null;
  payment_amount: number | null;
  created_at: string;
}

/**
 * Parsed 999 Functional Acknowledgment
 */
export interface Parsed999 {
  originalControlNumber: string;
  isaControlNumber: string;
  accepted: boolean;
  statusCode: string;
  statusDescription: string;
  transactionSetResponses: Array<{
    transactionSetId: string;
    controlNumber: string;
    accepted: boolean;
    statusCode: string;
    statusDescription: string;
  }>;
  errorCodes?: string[];
  includedTransactionCount: number;
  receivedTransactionCount: number;
  acceptedTransactionCount: number;
}

/**
 * Parsed 277 Claim Status Info
 */
export interface Parsed277ClaimStatus {
  controlNumber: string;
  payerClaimNumber?: string;
  statusCategoryCode: string;
  statusCode: string;
  statusDescription: string;
  claimStatus: ClaimStatus;
  effectiveDate?: string;
  totalChargeAmount?: number;
  patientName?: string;
  serviceDate?: string;
}

/**
 * Parsed 277 Response (full file)
 */
export interface Parsed277 {
  isaControlNumber: string;
  claimStatuses: Parsed277ClaimStatus[];
  hasRejections: boolean;
  totalClaims: number;
}

/**
 * Parsed 835 Adjustment
 */
export interface Parsed835Adjustment {
  groupCode: string; // CO, PR, OA, PI, CR
  groupDescription: string;
  reasonCode: string;
  amount: number;
}

/**
 * Parsed 835 Service Line
 */
export interface Parsed835ServiceLine {
  procedureCode: string;
  modifier?: string;
  chargeAmount: number;
  paidAmount: number;
  units: number;
  adjustments: Parsed835Adjustment[];
}

/**
 * Parsed 835 Claim Payment
 */
export interface Parsed835ClaimPayment {
  patientControlNumber: string; // Our control number
  payerClaimNumber: string;
  statusCode: string;
  statusDescription: string;
  chargeAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  adjustments: Parsed835Adjustment[];
  serviceLines: Parsed835ServiceLine[];
  patientName?: string;
  serviceDate?: string;
  claimStatus: ClaimStatus;
}

/**
 * Parsed 835 Response (full file)
 */
export interface Parsed835 {
  isaControlNumber: string;
  checkNumber: string;
  payerIdentifier: string;
  payerName: string;
  payeeName: string;
  paymentDate: string;
  paymentMethodCode: string;
  totalPaymentAmount: number;
  totalCharges: number;
  totalPaid: number;
  totalPatientResponsibility: number;
  claimPayments: Parsed835ClaimPayment[];
  providerAdjustments: Array<{ reasonCode: string; amount: number }>;
  claimCount: number;
}

/**
 * Reconciliation Result
 */
export interface ReconciliationResult {
  success: boolean;
  filesDownloaded: number;
  filesProcessed: number;
  claimsUpdated: number;
  errors: string[];
  details: {
    file999Count: number;
    file277Count: number;
    file835Count: number;
  };
}

/**
 * Payer Name Mapping (database record)
 */
export interface PayerNameMapping {
  id: string;
  intakeq_carrier_name: string;
  payer_id: string | null;
  confidence: 'high' | 'medium' | 'low' | 'manual';
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
}
