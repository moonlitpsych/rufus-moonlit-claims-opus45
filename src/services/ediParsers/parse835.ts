/**
 * 835 Electronic Remittance Advice (ERA) Parser
 * Parses X12 835 payment files
 *
 * 835 files contain actual payment information from payers,
 * including amounts paid, adjustments, and denial reasons.
 *
 * Key segments:
 * - BPR: Financial Information (payment method, amount, date)
 * - TRN: Trace Number (check/payment number)
 * - CLP: Claim Payment Information
 * - SVC: Service Line Payment Information
 * - CAS: Claim Adjustment Segment (adjustments/denials)
 * - PLB: Provider Level Adjustments
 */

import type { Parsed835, ClaimStatus } from '@/types';
import {
  parseEDISegments,
  findSegment,
  findSegments,
  getElement,
  extractISAControlNumber,
  CLP_STATUS_CODES,
  Segment,
} from './base';

export interface Parse835Result {
  success: boolean;
  data?: Parsed835;
  error?: string;
}

interface ClaimPaymentInfo {
  patientControlNumber: string; // Our control number
  payerClaimNumber: string;
  statusCode: string;
  statusDescription: string;
  chargeAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  adjustments: AdjustmentInfo[];
  serviceLines: ServiceLinePayment[];
  patientName?: string;
  serviceDate?: string;
  claimStatus: ClaimStatus;
}

interface AdjustmentInfo {
  groupCode: string; // CO, PR, OA, PI, CR
  groupDescription: string;
  reasonCode: string;
  amount: number;
}

interface ServiceLinePayment {
  procedureCode: string;
  modifier?: string;
  chargeAmount: number;
  paidAmount: number;
  units: number;
  adjustments: AdjustmentInfo[];
}

// CAS Group Codes
const CAS_GROUP_CODES: Record<string, string> = {
  CO: 'Contractual Obligations',
  CR: 'Corrections and Reversals',
  OA: 'Other Adjustments',
  PI: 'Payer Initiated Reductions',
  PR: 'Patient Responsibility',
};

/**
 * Parse an 835 Electronic Remittance Advice file
 */
export function parse835(content: string): Parse835Result {
  try {
    const segments = parseEDISegments(content);

    if (segments.length === 0) {
      return { success: false, error: 'No segments found in 835 file' };
    }

    // Extract ISA control number
    const isaControlNumber = extractISAControlNumber(segments);

    // Parse BPR - Financial Information
    const bpr = findSegment(segments, 'BPR');
    const transactionHandlingCode = getElement(bpr, 0);
    const totalPaymentAmount = parseFloat(getElement(bpr, 1) || '0');
    const paymentMethodCode = getElement(bpr, 3);
    const paymentDate = getElement(bpr, 15);

    // Parse TRN - Trace/Check Number
    const trn = findSegment(segments, 'TRN');
    const checkNumber = getElement(trn, 1);
    const payerIdentifier = getElement(trn, 2);

    // Parse N1 segments for payer/payee names
    let payerName = '';
    let payeeName = '';
    const n1Segments = findSegments(segments, 'N1');
    for (const n1 of n1Segments) {
      const entityCode = getElement(n1, 0);
      const name = getElement(n1, 1);
      if (entityCode === 'PR') payerName = name; // Payer
      if (entityCode === 'PE') payeeName = name; // Payee (provider)
    }

    // Parse all claim payments
    const claimPayments = parseClaimPayments(segments);

    // Calculate totals
    const totalCharges = claimPayments.reduce((sum, cp) => sum + cp.chargeAmount, 0);
    const totalPaid = claimPayments.reduce((sum, cp) => sum + cp.paidAmount, 0);
    const totalPatientResponsibility = claimPayments.reduce(
      (sum, cp) => sum + cp.patientResponsibility,
      0
    );

    // Parse PLB - Provider Level Adjustments
    const providerAdjustments = parseProviderAdjustments(segments);

    const parsed835: Parsed835 = {
      isaControlNumber,
      checkNumber,
      payerIdentifier,
      payerName,
      payeeName,
      paymentDate,
      paymentMethodCode,
      totalPaymentAmount,
      totalCharges,
      totalPaid,
      totalPatientResponsibility,
      claimPayments,
      providerAdjustments,
      claimCount: claimPayments.length,
    };

    return { success: true, data: parsed835 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse 835 file',
    };
  }
}

/**
 * Parse individual claim payments (CLP loops)
 */
function parseClaimPayments(segments: Segment[]): ClaimPaymentInfo[] {
  const payments: ClaimPaymentInfo[] = [];

  // Find all CLP segments
  const clpSegments = findSegments(segments, 'CLP');

  for (const clp of clpSegments) {
    const clpIndex = segments.indexOf(clp);

    // CLP*ControlNumber*Status*ChargeAmt*PaidAmt*PatientResp*ClaimFilingInd*PayerClaimNumber
    const patientControlNumber = getElement(clp, 0);
    const statusCode = getElement(clp, 1);
    const chargeAmount = parseFloat(getElement(clp, 2) || '0');
    const paidAmount = parseFloat(getElement(clp, 3) || '0');
    const patientResponsibility = parseFloat(getElement(clp, 4) || '0');
    const payerClaimNumber = getElement(clp, 6);

    // Get status info
    const statusInfo = CLP_STATUS_CODES[statusCode];
    const statusDescription = statusInfo?.description || `Status ${statusCode}`;
    const claimStatus: ClaimStatus = statusInfo?.isPaid ? 'paid' : 'denied';

    // Parse associated segments
    let patientName: string | undefined;
    let serviceDate: string | undefined;
    const adjustments: AdjustmentInfo[] = [];
    const serviceLines: ServiceLinePayment[] = [];

    // Scan until next CLP or end
    for (let i = clpIndex + 1; i < segments.length; i++) {
      const seg = segments[i];

      // Stop at next CLP
      if (seg.id === 'CLP') break;

      // NM1 - Patient Name (QC = Patient)
      if (seg.id === 'NM1') {
        const entityCode = getElement(seg, 0);
        if (entityCode === 'QC') {
          const lastName = getElement(seg, 2);
          const firstName = getElement(seg, 3);
          patientName = `${firstName} ${lastName}`.trim();
        }
      }

      // DTM - Date (232 = Claim Statement Period Start)
      if (seg.id === 'DTM') {
        const dtmQualifier = getElement(seg, 0);
        if (dtmQualifier === '232' || dtmQualifier === '233') {
          serviceDate = getElement(seg, 1);
        }
      }

      // CAS - Claim Adjustments (at claim level, before SVC)
      if (seg.id === 'CAS') {
        const adj = parseAdjustment(seg);
        if (adj) adjustments.push(adj);
      }

      // SVC - Service Line Payment
      if (seg.id === 'SVC') {
        const svcLine = parseServiceLine(segments, i);
        if (svcLine) serviceLines.push(svcLine);
      }
    }

    payments.push({
      patientControlNumber,
      payerClaimNumber,
      statusCode,
      statusDescription,
      chargeAmount,
      paidAmount,
      patientResponsibility,
      adjustments,
      serviceLines,
      patientName,
      serviceDate,
      claimStatus,
    });
  }

  return payments;
}

/**
 * Parse a CAS (Claim Adjustment) segment
 */
function parseAdjustment(cas: Segment): AdjustmentInfo | null {
  // CAS*GroupCode*ReasonCode*Amount*Quantity...
  const groupCode = getElement(cas, 0);
  const reasonCode = getElement(cas, 1);
  const amount = parseFloat(getElement(cas, 2) || '0');

  if (!groupCode) return null;

  return {
    groupCode,
    groupDescription: CAS_GROUP_CODES[groupCode] || groupCode,
    reasonCode,
    amount,
  };
}

/**
 * Parse a service line (SVC and associated segments)
 */
function parseServiceLine(
  segments: Segment[],
  svcIndex: number
): ServiceLinePayment | null {
  const svc = segments[svcIndex];

  // SVC*HC:CPT:Modifier*ChargeAmt*PaidAmt**Units
  const compositeProcedure = getElement(svc, 0);
  const procedureParts = compositeProcedure.split(':');
  const procedureCode = procedureParts[1] || procedureParts[0];
  const modifier = procedureParts[2];

  const chargeAmount = parseFloat(getElement(svc, 1) || '0');
  const paidAmount = parseFloat(getElement(svc, 2) || '0');
  const units = parseInt(getElement(svc, 4) || '1');

  // Look for CAS segments after this SVC
  const adjustments: AdjustmentInfo[] = [];
  for (let i = svcIndex + 1; i < segments.length; i++) {
    const seg = segments[i];
    // Stop at next SVC or CLP
    if (seg.id === 'SVC' || seg.id === 'CLP') break;
    if (seg.id === 'CAS') {
      const adj = parseAdjustment(seg);
      if (adj) adjustments.push(adj);
    }
  }

  return {
    procedureCode,
    modifier,
    chargeAmount,
    paidAmount,
    units,
    adjustments,
  };
}

/**
 * Parse PLB - Provider Level Adjustments
 */
function parseProviderAdjustments(
  segments: Segment[]
): Array<{ reasonCode: string; amount: number }> {
  const adjustments: Array<{ reasonCode: string; amount: number }> = [];

  const plbSegments = findSegments(segments, 'PLB');
  for (const plb of plbSegments) {
    // PLB*ProviderID*Date*ReasonCode*Amount...
    // Can have multiple reason/amount pairs
    const elements = plb.elements;
    for (let i = 2; i < elements.length; i += 2) {
      const reasonCode = elements[i];
      const amount = parseFloat(elements[i + 1] || '0');
      if (reasonCode) {
        adjustments.push({ reasonCode, amount });
      }
    }
  }

  return adjustments;
}

/**
 * Find payment info for a specific control number
 */
export function findClaimPayment(
  parsed: Parsed835,
  controlNumber: string
): ClaimPaymentInfo | undefined {
  return parsed.claimPayments.find(
    (cp) => cp.patientControlNumber === controlNumber
  );
}

/**
 * Get all paid claims from an 835 file
 */
export function getPaidClaims(parsed: Parsed835): ClaimPaymentInfo[] {
  return parsed.claimPayments.filter((cp) => cp.paidAmount > 0);
}

/**
 * Get all denied claims from an 835 file
 */
export function getDeniedClaims(parsed: Parsed835): ClaimPaymentInfo[] {
  return parsed.claimPayments.filter(
    (cp) => cp.paidAmount === 0 && cp.chargeAmount > 0
  );
}

/**
 * Calculate total patient responsibility across all claims
 */
export function getTotalPatientResponsibility(parsed: Parsed835): number {
  return parsed.claimPayments.reduce(
    (sum, cp) => sum + cp.patientResponsibility,
    0
  );
}
