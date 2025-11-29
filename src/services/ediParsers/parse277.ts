/**
 * 277 Claim Status Response Parser
 * Parses X12 277CA (Claim Acknowledgment) files
 *
 * 277 files report claim status from payers - whether the claim was
 * accepted for adjudication, rejected, pending, or processed.
 *
 * Key segments:
 * - TRN: Trace Number (contains our control number)
 * - STC: Status Information (claim status code)
 * - REF: Reference Identification (payer claim number, etc.)
 * - QTY: Quantity (accepted/rejected amounts)
 * - AMT: Monetary Amount
 */

import type { Parsed277, ClaimStatus } from '@/types';
import {
  parseEDISegments,
  findSegments,
  getElement,
  getSubElement,
  extractISAControlNumber,
  STC_CATEGORY_CODES,
  Segment,
} from './base';

export interface Parse277Result {
  success: boolean;
  data?: Parsed277;
  error?: string;
}

interface ClaimStatusInfo {
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
 * Parse a 277 Claim Status Response file
 */
export function parse277(content: string): Parse277Result {
  try {
    const segments = parseEDISegments(content);

    if (segments.length === 0) {
      return { success: false, error: 'No segments found in 277 file' };
    }

    // Extract ISA control number
    const isaControlNumber = extractISAControlNumber(segments);

    // Parse all claim statuses from the file
    const claimStatuses = parseClaimStatuses(segments);

    // Determine if any claims were rejected
    const hasRejections = claimStatuses.some(
      (cs) =>
        cs.claimStatus === 'rejected' ||
        cs.statusCategoryCode.startsWith('A3') ||
        cs.statusCategoryCode.startsWith('A5') ||
        cs.statusCategoryCode.startsWith('A7') ||
        cs.statusCategoryCode.startsWith('A8')
    );

    const parsed277: Parsed277 = {
      isaControlNumber,
      claimStatuses,
      hasRejections,
      totalClaims: claimStatuses.length,
    };

    return { success: true, data: parsed277 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse 277 file',
    };
  }
}

/**
 * Parse individual claim statuses from 277 segments
 * Each claim is in a 2100D loop (Patient level)
 */
function parseClaimStatuses(segments: Segment[]): ClaimStatusInfo[] {
  const statuses: ClaimStatusInfo[] = [];

  // Find all TRN segments which identify claims
  // TRN*2*ControlNumber*SubmitterID
  const trnSegments = findSegments(segments, 'TRN');

  for (const trn of trnSegments) {
    const trnIndex = segments.indexOf(trn);
    const controlNumber = getElement(trn, 1);

    if (!controlNumber) continue;

    // Look for associated segments after TRN
    let payerClaimNumber: string | undefined;
    let statusCategoryCode = '';
    let statusCode = '';
    let effectiveDate: string | undefined;
    let totalChargeAmount: number | undefined;
    let patientName: string | undefined;
    let serviceDate: string | undefined;

    // Scan segments until next TRN or end
    for (let i = trnIndex + 1; i < segments.length; i++) {
      const seg = segments[i];

      // Stop at next TRN
      if (seg.id === 'TRN') break;

      // REF - Reference numbers
      // REF*1K*PayerClaimNumber (1K = Payer Claim Control Number)
      // REF*D9*ClaimNumber (D9 = Claim Number)
      if (seg.id === 'REF') {
        const refQualifier = getElement(seg, 0);
        if (refQualifier === '1K' || refQualifier === 'D9') {
          payerClaimNumber = getElement(seg, 1);
        }
      }

      // STC - Status Information
      // STC*A0:20:PR*20241115*WQ (StatusCategory:StatusCode:EntityCode*Date*ActionCode)
      if (seg.id === 'STC') {
        const stc01 = getElement(seg, 0); // Composite element
        statusCategoryCode = getSubElement(stc01, 0);
        statusCode = getSubElement(stc01, 1);
        effectiveDate = getElement(seg, 1);
      }

      // AMT - Monetary Amount
      // AMT*YU*150.00 (YU = Total Claim Charge Amount)
      if (seg.id === 'AMT') {
        const amtQualifier = getElement(seg, 0);
        if (amtQualifier === 'YU' || amtQualifier === 'T3') {
          totalChargeAmount = parseFloat(getElement(seg, 1) || '0');
        }
      }

      // NM1 - Patient Name (QC = Patient)
      if (seg.id === 'NM1') {
        const entityCode = getElement(seg, 0);
        if (entityCode === 'QC') {
          const lastName = getElement(seg, 2);
          const firstName = getElement(seg, 3);
          patientName = `${firstName} ${lastName}`.trim();
        }
      }

      // DTP - Date (472 = Service Date)
      if (seg.id === 'DTP') {
        const dtpQualifier = getElement(seg, 0);
        if (dtpQualifier === '472') {
          serviceDate = getElement(seg, 2);
        }
      }
    }

    // Map status category to our claim status
    const stcInfo = STC_CATEGORY_CODES[statusCategoryCode];
    const claimStatus: ClaimStatus = stcInfo?.claimStatus as ClaimStatus || 'pending';
    const statusDescription = stcInfo?.description || `Status ${statusCategoryCode}`;

    statuses.push({
      controlNumber,
      payerClaimNumber,
      statusCategoryCode,
      statusCode,
      statusDescription,
      claimStatus,
      effectiveDate,
      totalChargeAmount,
      patientName,
      serviceDate,
    });
  }

  return statuses;
}

/**
 * Find the most recent status for a specific control number
 */
export function findClaimStatus(
  parsed: Parsed277,
  controlNumber: string
): ClaimStatusInfo | undefined {
  return parsed.claimStatuses.find((cs) => cs.controlNumber === controlNumber);
}

/**
 * Get all rejected claims from a 277 file
 */
export function getRejectedClaims(parsed: Parsed277): ClaimStatusInfo[] {
  return parsed.claimStatuses.filter(
    (cs) =>
      cs.claimStatus === 'rejected' ||
      cs.statusCategoryCode.startsWith('A3') ||
      cs.statusCategoryCode.startsWith('A5') ||
      cs.statusCategoryCode.startsWith('A7') ||
      cs.statusCategoryCode.startsWith('A8')
  );
}

/**
 * Get all accepted claims from a 277 file
 */
export function getAcceptedClaims(parsed: Parsed277): ClaimStatusInfo[] {
  return parsed.claimStatuses.filter(
    (cs) =>
      cs.claimStatus === 'accepted' ||
      cs.statusCategoryCode === 'A2' ||
      cs.statusCategoryCode.startsWith('F')
  );
}
