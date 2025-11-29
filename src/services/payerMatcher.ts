/**
 * Payer Matcher Service
 * V2: Maps IntakeQ insurance carrier names to our payers table
 *
 * IntakeQ stores carrier names as free text (e.g., "Blue Cross Blue Shield of Utah")
 * while our payers table has curated entries with Office Ally payer IDs.
 */

import type { Payer, PayerMatchResult, SubscriberRelationship } from '@/types';

/**
 * Common name variations and aliases for Utah payers
 * This is a fallback for carriers not in the database mapping table
 */
const PAYER_ALIASES: Record<string, string[]> = {
  'Blue Cross Blue Shield of Utah': [
    'BCBS',
    'Blue Cross',
    'BlueCard',
    'Anthem BCBS',
    'BCBS of Utah',
    'BlueCross BlueShield',
    'Blue Cross Blue Shield',
  ],
  UnitedHealthcare: [
    'United',
    'UHC',
    'United Healthcare',
    'UnitedHealth',
    'Optum',
    'United Health',
  ],
  Aetna: ['Aetna Health', 'Aetna Life', 'Aetna Inc'],
  Cigna: ['Cigna Health', 'Cigna Healthcare', 'CIGNA'],
  Medicare: ['Medicare Part B', 'Traditional Medicare', 'CMS Medicare', 'Medicare B'],
  'Medicaid Utah': ['Utah Medicaid', 'Medicaid', 'UT Medicaid'],
  'Select Health': ['SelectHealth', 'Select', 'Intermountain Select'],
  DMBA: ['Deseret Mutual', 'Deseret Mutual Benefit', 'Deseret Mutual Benefit Administrators'],
  PEHP: ['Public Employee Health Program', 'Public Employees Health'],
  'Regence BlueCross BlueShield': ['Regence', 'Regence BCBS', 'Regence Blue Cross'],
  'Molina Healthcare': ['Molina', 'Molina Health'],
  Humana: ['Humana Health', 'Humana Inc'],
};

/**
 * Find best matching payer for an IntakeQ carrier name
 *
 * Matching strategy (in order of priority):
 * 1. Exact match (case-insensitive)
 * 2. Alias match from PAYER_ALIASES
 * 3. Partial/fuzzy match (carrier contains payer name or vice versa)
 */
export function matchPayer(
  carrierName: string | undefined,
  payers: Payer[]
): PayerMatchResult {
  if (!carrierName || !carrierName.trim()) {
    return { payer: null, confidence: 'none', intakeqCarrierName: carrierName || null };
  }

  const normalizedCarrier = carrierName.toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  const exactMatch = payers.find(
    (p) => p.name.toLowerCase() === normalizedCarrier
  );
  if (exactMatch) {
    return { payer: exactMatch, confidence: 'high', intakeqCarrierName: carrierName };
  }

  // 2. Check aliases
  for (const payer of payers) {
    const aliases = PAYER_ALIASES[payer.name] || [];
    const hasAliasMatch = aliases.some(
      (alias) =>
        alias.toLowerCase() === normalizedCarrier ||
        normalizedCarrier.includes(alias.toLowerCase()) ||
        alias.toLowerCase().includes(normalizedCarrier)
    );
    if (hasAliasMatch) {
      return { payer, confidence: 'high', intakeqCarrierName: carrierName };
    }
  }

  // 3. Partial/fuzzy match - carrier name contains payer name or vice versa
  const partialMatch = payers.find(
    (p) =>
      normalizedCarrier.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(normalizedCarrier)
  );
  if (partialMatch) {
    return { payer: partialMatch, confidence: 'medium', intakeqCarrierName: carrierName };
  }

  // 4. No match found
  return { payer: null, confidence: 'none', intakeqCarrierName: carrierName };
}

/**
 * Convert IntakeQ gender to our format
 * IntakeQ returns: "Male", "Female", "Other", etc.
 * We need: "M", "F", "U"
 */
export function normalizeGender(intakeqGender: string | undefined): 'M' | 'F' | 'U' {
  if (!intakeqGender) return 'U';

  const g = intakeqGender.toLowerCase().trim();

  if (g === 'male' || g === 'm') return 'M';
  if (g === 'female' || g === 'f') return 'F';
  return 'U';
}

/**
 * Convert IntakeQ relationship to our format
 * IntakeQ returns: "Self", "Spouse", "Child", "Other", etc.
 * We need: 'self' | 'spouse' | 'child' | 'other'
 */
export function normalizeRelationship(
  intakeqRelationship: string | undefined
): SubscriberRelationship {
  if (!intakeqRelationship) return 'self';

  const rel = intakeqRelationship.toLowerCase().trim();

  if (rel === 'self' || rel === 'insured' || rel === 'subscriber') {
    return 'self';
  }
  if (rel === 'spouse' || rel === 'husband' || rel === 'wife') {
    return 'spouse';
  }
  if (
    rel === 'child' ||
    rel === 'dependent' ||
    rel === 'son' ||
    rel === 'daughter'
  ) {
    return 'child';
  }
  return 'other';
}

/**
 * Format a Unix timestamp (milliseconds) to YYYY-MM-DD
 */
export function formatUnixTimestampToDate(timestamp: number | undefined): string | null {
  if (!timestamp) return null;

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}
