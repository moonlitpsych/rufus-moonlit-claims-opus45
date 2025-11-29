/**
 * EDI Parsers - Export all parser modules
 */

// Base utilities
export {
  parseEDISegments,
  findSegment,
  findSegments,
  getElement,
  getSubElement,
  extractISAControlNumber,
  extractGSControlNumber,
  IK5_STATUS_CODES,
  AK9_STATUS_CODES,
  STC_CATEGORY_CODES,
  CLP_STATUS_CODES,
} from './base';
export type { Segment } from './base';

// 999 Functional Acknowledgment Parser
export { parse999, is999Accepted } from './parse999';
export type { Parse999Result } from './parse999';

// 277 Claim Status Response Parser
export {
  parse277,
  findClaimStatus,
  getRejectedClaims,
  getAcceptedClaims,
} from './parse277';
export type { Parse277Result } from './parse277';

// 835 Electronic Remittance Advice Parser
export {
  parse835,
  findClaimPayment,
  getPaidClaims,
  getDeniedClaims,
  getTotalPatientResponsibility,
} from './parse835';
export type { Parse835Result } from './parse835';
