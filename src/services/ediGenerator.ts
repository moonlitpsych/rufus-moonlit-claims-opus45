/**
 * X12 837P EDI Generator
 * Converts CMS-1500 claim data to X12 837P format for Office Ally submission
 *
 * X12 837P Structure:
 * - ISA: Interchange Control Header
 * - GS: Functional Group Header
 * - ST: Transaction Set Header
 * - BHT: Beginning of Hierarchical Transaction
 * - NM1 loops: Name segments
 * - CLM: Claim Information
 * - HI: Health Care Diagnosis Codes
 * - LX/SV1: Service Lines
 * - SE/GE/IEA: Trailers
 */

import type { EDIClaimData } from '@/types';

export interface EDIGenerationResult {
  success: boolean;
  ediContent?: string;
  error?: string;
}

/**
 * Generate X12 837P EDI content from claim data
 */
export function generateEDI(data: EDIClaimData): EDIGenerationResult {
  try {
    console.log('[EDI] Generating 837P for patient:', `${data.patientFirstName} ${data.patientLastName}`);

    const ediContent = buildX12_837P(data);

    console.log('[EDI] Generation successful, segment count:', ediContent.split('~').length);

    return {
      success: true,
      ediContent,
    };
  } catch (error) {
    console.error('[EDI] Generation failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'EDI generation failed',
    };
  }
}

/**
 * Build X12 837P content
 * Each segment ends with ~
 * Elements separated by *
 * Sub-elements separated by :
 */
function buildX12_837P(data: EDIClaimData): string {
  const segments: string[] = [];

  // Get current date/time for timestamps
  const now = new Date();
  const dateYYMMDD = formatDate(now, 'YYMMDD');
  const dateYYYYMMDD = formatDate(now, 'YYYYMMDD');
  const timeHHMM = formatTime(now, 'HHMM');
  const timeHHMMSS = formatTime(now, 'HHMMSS');

  // ISA - Interchange Control Header (exactly 106 chars before ~)
  segments.push(
    `ISA*00*          *00*          *ZZ*${padRight(process.env.MOONLIT_SENDER_ID || 'MOONLIT', 15)}*ZZ*${padRight('OFFALLY', 15)}*${dateYYMMDD}*${timeHHMM}*^*00501*${padLeft(data.controlNumber, 9, '0')}*0*P*:~`
  );

  // GS - Functional Group Header
  segments.push(
    `GS*HC*${process.env.MOONLIT_SENDER_ID || 'MOONLIT'}*OFFALLY*${dateYYYYMMDD}*${timeHHMM}*${data.controlNumber}*X*005010X222A1~`
  );

  // ST - Transaction Set Header (837P)
  segments.push(`ST*837*0001*005010X222A1~`);

  // BHT - Beginning of Hierarchical Transaction
  segments.push(`BHT*0019*00*${data.controlNumber}*${dateYYYYMMDD}*${timeHHMMSS}*CH~`);

  // 1000A - Submitter Name
  segments.push(`NM1*41*2*${data.billingName}*****46*${data.billingNpi}~`);
  segments.push(`PER*IC*BILLING*TE*8015550100~`);

  // 1000B - Receiver Name (Office Ally)
  segments.push(`NM1*40*2*OFFICE ALLY*****46*OFFALLY~`);

  // 2000A - Billing Provider Hierarchical Level
  segments.push(`HL*1**20*1~`);
  segments.push(`PRV*BI*PXC*207Q00000X~`); // Taxonomy code for psychiatry

  // 2010AA - Billing Provider Name
  segments.push(`NM1*85*2*${data.billingName}*****XX*${data.billingNpi}~`);
  segments.push(`N3*${data.billingAddress.street}~`);
  segments.push(`N4*${data.billingAddress.city}*${data.billingAddress.state}*${data.billingAddress.zip}~`);
  segments.push(`REF*EI*${data.billingTin}~`);

  // 2000B - Subscriber Hierarchical Level
  const isPatientSubscriber = data.subscriberRelationship === 'self';
  segments.push(`HL*2*1*22*${isPatientSubscriber ? '0' : '1'}~`);

  // SBR - Subscriber Information
  const sbrRelCode = getRelationshipCode(data.subscriberRelationship);
  segments.push(`SBR*P*${sbrRelCode}*${data.groupNumber || ''}******CI~`);

  // 2010BA - Subscriber Name
  const subscriberParts = data.subscriberName.split(' ');
  const subLast = subscriberParts.length > 1 ? subscriberParts.slice(-1)[0] : subscriberParts[0];
  const subFirst = subscriberParts.length > 1 ? subscriberParts.slice(0, -1).join(' ') : '';
  segments.push(`NM1*IL*1*${subLast}*${subFirst}****MI*${data.memberId}~`);

  if (isPatientSubscriber) {
    // Patient is subscriber - include demographics here
    segments.push(`N3*${data.patientAddress.street}~`);
    segments.push(`N4*${data.patientAddress.city}*${data.patientAddress.state}*${data.patientAddress.zip}~`);
    segments.push(`DMG*D8*${data.patientDob}*${data.patientGender}~`);
  }

  // 2010BB - Payer Name
  segments.push(`NM1*PR*2*${data.payerId}*****PI*${data.payerId}~`);

  // 2000C - Patient Hierarchical Level (only if different from subscriber)
  if (!isPatientSubscriber) {
    segments.push(`HL*3*2*23*0~`);
    segments.push(`PAT*${sbrRelCode}~`);

    // 2010CA - Patient Name
    segments.push(`NM1*QC*1*${data.patientLastName}*${data.patientFirstName}~`);
    segments.push(`N3*${data.patientAddress.street}~`);
    segments.push(`N4*${data.patientAddress.city}*${data.patientAddress.state}*${data.patientAddress.zip}~`);
    segments.push(`DMG*D8*${data.patientDob}*${data.patientGender}~`);
  }

  // 2300 - Claim Information
  const totalCharge = data.serviceLines.reduce((sum, line) => sum + line.charge, 0);
  const pos = data.serviceLines[0]?.dos ? '11' : '11'; // Default to office
  segments.push(`CLM*${data.controlNumber}*${totalCharge.toFixed(2)}***${pos}:B:1*Y*A*Y*Y~`);

  // HI - Diagnosis Codes
  const diagCodes = data.diagnosisCodes
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    .map((d, i) => `${i === 0 ? 'ABK' : 'ABF'}:${d.code.replace('.', '')}`)
    .join('*');
  segments.push(`HI*${diagCodes}~`);

  // 2310B - Rendering Provider
  segments.push(`NM1*82*1******XX*${data.renderingNpi}~`);
  segments.push(`PRV*PE*PXC*207Q00000X~`);

  // 2400 - Service Lines
  data.serviceLines.forEach((line, index) => {
    const lineNum = index + 1;
    segments.push(`LX*${lineNum}~`);

    // SV1 - Professional Service
    const diagPointers = line.diagnosisPointers.join(':');
    const modifier = line.modifier ? `:${line.modifier}` : '';
    segments.push(`SV1*HC:${line.cpt}${modifier}*${line.charge.toFixed(2)}*UN*${line.units}***${diagPointers}~`);

    // DTP - Service Date
    segments.push(`DTP*472*D8*${line.dos}~`);
  });

  // SE - Transaction Set Trailer
  const segmentCount = segments.length + 1; // +1 for SE itself
  segments.push(`SE*${segmentCount}*0001~`);

  // GE - Functional Group Trailer
  segments.push(`GE*1*${data.controlNumber}~`);

  // IEA - Interchange Control Trailer
  segments.push(`IEA*1*${padLeft(data.controlNumber, 9, '0')}~`);

  return segments.join('\n');
}

/**
 * Helper functions
 */

function padRight(str: string, length: number): string {
  return (str + ' '.repeat(length)).substring(0, length);
}

function padLeft(str: string, length: number, char: string = ' '): string {
  return (char.repeat(length) + str).slice(-length);
}

function formatDate(date: Date, format: 'YYMMDD' | 'YYYYMMDD'): string {
  const year = format === 'YYMMDD'
    ? date.getFullYear().toString().slice(-2)
    : date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatTime(date: Date, format: 'HHMM' | 'HHMMSS'): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  if (format === 'HHMM') {
    return `${hours}${minutes}`;
  }
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}${minutes}${seconds}`;
}

function getRelationshipCode(rel: string): string {
  const codes: Record<string, string> = {
    'self': '18',
    'spouse': '01',
    'child': '19',
    'other': 'G8',
  };
  return codes[rel] || '18';
}

/**
 * Generate a unique control number for EDI
 */
export function generateControlNumber(): string {
  return Date.now().toString().slice(-9);
}
