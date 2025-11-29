/**
 * Base EDI Parser Utilities
 * Common functions for parsing X12 EDI files
 *
 * EDI Structure:
 * - Segments are terminated by ~ (tilde)
 * - Elements within segments are separated by * (asterisk)
 * - Sub-elements are separated by : (colon)
 * - ISA segment is always exactly 106 characters before ~
 */

export interface Segment {
  id: string;         // Segment identifier (ISA, GS, ST, etc.)
  elements: string[]; // Array of element values (excluding segment ID)
  raw: string;        // Original segment string
}

/**
 * Parse EDI content into segments
 */
export function parseEDISegments(content: string): Segment[] {
  // Normalize line endings and split by segment terminator
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by ~ (segment terminator), handling potential line breaks
  const segmentStrings = normalized
    .split('~')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return segmentStrings.map((raw) => {
    // Remove any line breaks within the segment
    const cleanRaw = raw.replace(/\n/g, '');
    const parts = cleanRaw.split('*');

    return {
      id: parts[0] || '',
      elements: parts.slice(1),
      raw: cleanRaw,
    };
  });
}

/**
 * Find all segments with a specific ID
 */
export function findSegments(segments: Segment[], id: string): Segment[] {
  return segments.filter((s) => s.id === id);
}

/**
 * Find first segment with a specific ID
 */
export function findSegment(segments: Segment[], id: string): Segment | undefined {
  return segments.find((s) => s.id === id);
}

/**
 * Get element value from segment (0-indexed)
 */
export function getElement(segment: Segment | undefined, index: number): string {
  if (!segment || !segment.elements[index]) return '';
  return segment.elements[index];
}

/**
 * Get sub-element value (element with colon separator)
 * element: The element string with potential sub-elements
 * subIndex: 0-indexed position of sub-element
 */
export function getSubElement(element: string, subIndex: number): string {
  if (!element) return '';
  const parts = element.split(':');
  return parts[subIndex] || '';
}

/**
 * Extract control number from ISA segment
 * ISA13 is the Interchange Control Number (positions 91-99)
 */
export function extractISAControlNumber(segments: Segment[]): string {
  const isa = findSegment(segments, 'ISA');
  if (!isa) return '';
  // ISA13 is element index 12 (0-indexed)
  return getElement(isa, 12).trim();
}

/**
 * Extract control number from GS segment
 * GS06 is the Group Control Number
 */
export function extractGSControlNumber(segments: Segment[]): string {
  const gs = findSegment(segments, 'GS');
  if (!gs) return '';
  // GS06 is element index 5 (0-indexed)
  return getElement(gs, 5).trim();
}

/**
 * Status code descriptions for 999 IK5 segment
 */
export const IK5_STATUS_CODES: Record<string, string> = {
  A: 'Accepted',
  E: 'Accepted But Errors Were Noted',
  M: 'Rejected, Message Authentication Code (MAC) Failed',
  P: 'Partially Accepted, At Least One Transaction Set Was Rejected',
  R: 'Rejected',
  W: 'Rejected, Assurance Failed Validity Tests',
  X: 'Rejected, Content After Decryption Could Not Be Analyzed',
};

/**
 * Status code descriptions for 999 AK9 segment
 */
export const AK9_STATUS_CODES: Record<string, string> = {
  A: 'Accepted',
  E: 'Accepted, But Errors Were Noted',
  P: 'Partially Accepted, At Least One Transaction Set Was Rejected',
  R: 'Rejected',
};

/**
 * 277 Status Category codes (STC01-1)
 * These are the first element of the composite STC01
 */
export const STC_CATEGORY_CODES: Record<string, { description: string; claimStatus: string }> = {
  A0: { description: 'Acknowledgment/Forwarded', claimStatus: 'acknowledged' },
  A1: { description: 'Acknowledgment/Receipt', claimStatus: 'acknowledged' },
  A2: { description: 'Acknowledgment/Acceptance into adjudication', claimStatus: 'accepted' },
  A3: { description: 'Acknowledgment/Rejection', claimStatus: 'rejected' },
  A4: { description: 'Acknowledgment/Pending', claimStatus: 'pending' },
  A5: { description: 'Acknowledgment/Returned as Unprocessable', claimStatus: 'rejected' },
  A6: { description: 'Acknowledgment/Split', claimStatus: 'pending' },
  A7: { description: 'Acknowledgment/Rejected for Missing Information', claimStatus: 'rejected' },
  A8: { description: 'Acknowledgment/Rejected for Invalid Information', claimStatus: 'rejected' },
  D0: { description: 'Data Reporting Acknowledgment', claimStatus: 'acknowledged' },
  E0: { description: 'Response not Possible', claimStatus: 'pending' },
  E1: { description: 'Response not Possible, Claim/Encounter Not Found', claimStatus: 'pending' },
  E2: { description: 'Information Holder is Not Responding', claimStatus: 'pending' },
  E3: { description: 'Correction Required', claimStatus: 'pending' },
  E4: { description: 'Forwarded for Additional Review', claimStatus: 'pending' },
  F0: { description: 'Finalized/Adjudication Complete', claimStatus: 'accepted' },
  F1: { description: 'Finalized/Denial', claimStatus: 'denied' },
  F2: { description: 'Finalized/Paid', claimStatus: 'paid' },
  F3: { description: 'Finalized/Revised', claimStatus: 'accepted' },
  F4: { description: 'Finalized/Forwarded', claimStatus: 'accepted' },
  R0: { description: 'Request for Additional Information', claimStatus: 'pending' },
  R1: { description: 'Request Accepted', claimStatus: 'accepted' },
  R3: { description: 'Request Rejected', claimStatus: 'rejected' },
  R4: { description: 'Request Returned', claimStatus: 'rejected' },
  R5: { description: 'Requires Acknowledgment', claimStatus: 'pending' },
  RQ: { description: 'Requests Forwarded', claimStatus: 'pending' },
  WQ: { description: 'Request Not Processed', claimStatus: 'pending' },
};

/**
 * 835 CLP02 Claim Status codes
 */
export const CLP_STATUS_CODES: Record<string, { description: string; isPaid: boolean }> = {
  '1': { description: 'Processed as Primary', isPaid: true },
  '2': { description: 'Processed as Secondary', isPaid: true },
  '3': { description: 'Processed as Tertiary', isPaid: true },
  '4': { description: 'Denied', isPaid: false },
  '19': { description: 'Processed as Primary, Forwarded to Additional Payer', isPaid: true },
  '20': { description: 'Processed as Secondary, Forwarded to Additional Payer', isPaid: true },
  '21': { description: 'Processed as Tertiary, Forwarded to Additional Payer', isPaid: true },
  '22': { description: 'Reversal of Previous Payment', isPaid: false },
  '23': { description: 'Not Our Claim, Forwarded to Additional Payer', isPaid: false },
  '25': { description: 'Predetermination Pricing Only', isPaid: false },
};
