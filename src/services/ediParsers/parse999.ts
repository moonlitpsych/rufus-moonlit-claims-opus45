/**
 * 999 Functional Acknowledgment Parser
 * Parses X12 999 Implementation Acknowledgment files
 *
 * 999 files confirm whether an 837P file was successfully received
 * and syntactically valid. They don't indicate claim acceptance by payer.
 *
 * Key segments:
 * - AK1: Functional Group Response Header
 * - AK2: Transaction Set Response Header
 * - IK5: Transaction Set Response Trailer (acceptance status per transaction)
 * - AK9: Functional Group Response Trailer (overall status)
 */

import type { Parsed999 } from '@/types';
import {
  parseEDISegments,
  findSegment,
  findSegments,
  getElement,
  extractISAControlNumber,
  extractGSControlNumber,
  IK5_STATUS_CODES,
  AK9_STATUS_CODES,
} from './base';

export interface Parse999Result {
  success: boolean;
  data?: Parsed999;
  error?: string;
}

/**
 * Parse a 999 Functional Acknowledgment file
 */
export function parse999(content: string): Parse999Result {
  try {
    const segments = parseEDISegments(content);

    if (segments.length === 0) {
      return { success: false, error: 'No segments found in 999 file' };
    }

    // Extract control numbers for matching
    const originalControlNumber = extractISAControlNumber(segments);
    const originalGSControlNumber = extractGSControlNumber(segments);

    // Find AK1 - Functional Group Response Header
    // AK1*HC*123456 (HC = Healthcare, 123456 = original GS06)
    const ak1 = findSegment(segments, 'AK1');
    const ak1GroupControlNumber = getElement(ak1, 1);

    // Find AK9 - Functional Group Response Trailer
    // AK9*A*1*1*1 (A=Accepted, included=1, received=1, accepted=1)
    const ak9 = findSegment(segments, 'AK9');
    const ak9StatusCode = getElement(ak9, 0);
    const ak9IncludedCount = parseInt(getElement(ak9, 1) || '0');
    const ak9ReceivedCount = parseInt(getElement(ak9, 2) || '0');
    const ak9AcceptedCount = parseInt(getElement(ak9, 3) || '0');

    // Determine overall acceptance
    const isAccepted = ak9StatusCode === 'A' || ak9StatusCode === 'E';
    const statusDescription =
      AK9_STATUS_CODES[ak9StatusCode] || `Unknown status: ${ak9StatusCode}`;

    // Parse individual transaction set responses (AK2/IK5 pairs)
    const transactionResponses = parseTransactionResponses(segments);

    // Collect any error codes
    const errorCodes = collectErrorCodes(segments);

    const parsed999: Parsed999 = {
      originalControlNumber: ak1GroupControlNumber || originalGSControlNumber,
      isaControlNumber: originalControlNumber,
      accepted: isAccepted,
      statusCode: ak9StatusCode,
      statusDescription,
      transactionSetResponses: transactionResponses,
      errorCodes: errorCodes.length > 0 ? errorCodes : undefined,
      includedTransactionCount: ak9IncludedCount,
      receivedTransactionCount: ak9ReceivedCount,
      acceptedTransactionCount: ak9AcceptedCount,
    };

    return { success: true, data: parsed999 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse 999 file',
    };
  }
}

/**
 * Parse individual transaction set responses (AK2/IK5 pairs)
 */
function parseTransactionResponses(
  segments: ReturnType<typeof parseEDISegments>
): Parsed999['transactionSetResponses'] {
  const responses: Parsed999['transactionSetResponses'] = [];

  // Find all AK2 segments (Transaction Set Response Header)
  const ak2Segments = findSegments(segments, 'AK2');

  for (const ak2 of ak2Segments) {
    // AK2*837*0001 (837 = transaction type, 0001 = control number)
    const transactionSetId = getElement(ak2, 0);
    const controlNumber = getElement(ak2, 1);

    // Find the corresponding IK5 for this transaction
    // IK5 follows AK2 and contains the acceptance status
    const ak2Index = segments.indexOf(ak2);
    let ik5StatusCode = '';
    let ik5StatusDescription = '';

    // Look for IK5 after this AK2
    for (let i = ak2Index + 1; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.id === 'IK5') {
        ik5StatusCode = getElement(seg, 0);
        ik5StatusDescription =
          IK5_STATUS_CODES[ik5StatusCode] || `Unknown: ${ik5StatusCode}`;
        break;
      }
      // Stop if we hit another AK2 or AK9
      if (seg.id === 'AK2' || seg.id === 'AK9') {
        break;
      }
    }

    responses.push({
      transactionSetId,
      controlNumber,
      accepted: ik5StatusCode === 'A' || ik5StatusCode === 'E',
      statusCode: ik5StatusCode,
      statusDescription: ik5StatusDescription,
    });
  }

  return responses;
}

/**
 * Collect error codes from IK3 and IK4 segments
 * IK3: Segment Error (data segment in error)
 * IK4: Element Error (specific element in error)
 */
function collectErrorCodes(
  segments: ReturnType<typeof parseEDISegments>
): string[] {
  const errors: string[] = [];

  // IK3 - Segment errors
  const ik3Segments = findSegments(segments, 'IK3');
  for (const ik3 of ik3Segments) {
    const segmentId = getElement(ik3, 0);
    const segmentPosition = getElement(ik3, 1);
    const errorCode = getElement(ik3, 3);
    if (errorCode) {
      errors.push(`Segment ${segmentId} at position ${segmentPosition}: Error ${errorCode}`);
    }
  }

  // IK4 - Element errors
  const ik4Segments = findSegments(segments, 'IK4');
  for (const ik4 of ik4Segments) {
    const elementPosition = getElement(ik4, 0);
    const elementReference = getElement(ik4, 1);
    const errorCode = getElement(ik4, 2);
    if (errorCode) {
      errors.push(`Element ${elementPosition} (${elementReference}): Error ${errorCode}`);
    }
  }

  return errors;
}

/**
 * Check if a 999 file indicates successful receipt
 */
export function is999Accepted(parsed: Parsed999): boolean {
  return parsed.accepted && parsed.acceptedTransactionCount > 0;
}
