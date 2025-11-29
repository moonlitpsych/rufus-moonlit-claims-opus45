/**
 * Reconciliation Engine Service
 * V2: Downloads and processes EDI response files from Office Ally
 *
 * This service orchestrates the reconciliation process:
 * 1. Downloads new 999/277/835 files from SFTP
 * 2. Parses each file using appropriate parser
 * 3. Matches responses to claims in database
 * 4. Updates claim statuses and records events
 */

import { getServerSupabase } from './supabase';
import { downloadResponseFiles } from './responseFileDownloader';
import { parse999 } from './ediParsers/parse999';
import { parse277 } from './ediParsers/parse277';
import { parse835 } from './ediParsers/parse835';
import type {
  ReconciliationResult,
  ClaimStatus,
  EDIResponseFileType,
  Parsed999,
  Parsed277,
  Parsed835,
} from '@/types';

interface ProcessingStats {
  file999Count: number;
  file277Count: number;
  file835Count: number;
  claimsUpdated: number;
  errors: string[];
}

/**
 * Run full reconciliation process
 * Downloads files, parses them, updates claims
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
  const supabase = getServerSupabase();
  const stats: ProcessingStats = {
    file999Count: 0,
    file277Count: 0,
    file835Count: 0,
    claimsUpdated: 0,
    errors: [],
  };

  try {
    console.log('[Reconciliation] Starting reconciliation process...');

    // Get list of already processed filenames
    const { data: existingFiles } = await supabase
      .from('edi_response_files')
      .select('filename');

    const existingFilenames = (existingFiles || []).map((f) => f.filename);
    console.log(`[Reconciliation] Found ${existingFilenames.length} previously downloaded files`);

    // Download new files from SFTP
    const downloadResult = await downloadResponseFiles(existingFilenames);

    if (!downloadResult.success) {
      return {
        success: false,
        filesDownloaded: 0,
        filesProcessed: 0,
        claimsUpdated: 0,
        errors: [downloadResult.error || 'Download failed'],
        details: { file999Count: 0, file277Count: 0, file835Count: 0 },
      };
    }

    console.log(`[Reconciliation] Downloaded ${downloadResult.files.length} new files`);

    // Process each file
    for (const file of downloadResult.files) {
      try {
        // Save file to database
        const { data: savedFile, error: saveError } = await supabase
          .from('edi_response_files')
          .insert({
            filename: file.filename,
            file_type: file.fileType,
            file_content: file.content,
            processing_status: 'pending',
            downloaded_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (saveError) {
          stats.errors.push(`Failed to save file ${file.filename}: ${saveError.message}`);
          continue;
        }

        // Process based on file type
        const processResult = await processResponseFile(
          savedFile.id,
          file.fileType,
          file.content,
          supabase
        );

        // Update file record with results
        await supabase
          .from('edi_response_files')
          .update({
            processing_status: processResult.success ? 'processed' : 'failed',
            processing_error: processResult.error,
            claims_matched: processResult.claimsMatched,
            claims_updated: processResult.claimsUpdated,
            processed_at: new Date().toISOString(),
          })
          .eq('id', savedFile.id);

        // Update stats
        if (file.fileType === '999') stats.file999Count++;
        if (file.fileType === '277') stats.file277Count++;
        if (file.fileType === '835') stats.file835Count++;
        stats.claimsUpdated += processResult.claimsUpdated;

        if (processResult.error) {
          stats.errors.push(`${file.filename}: ${processResult.error}`);
        }
      } catch (fileError) {
        const errorMsg =
          fileError instanceof Error ? fileError.message : 'Unknown processing error';
        stats.errors.push(`${file.filename}: ${errorMsg}`);
      }
    }

    const totalProcessed =
      stats.file999Count + stats.file277Count + stats.file835Count;

    console.log(
      `[Reconciliation] Complete. Processed ${totalProcessed} files, updated ${stats.claimsUpdated} claims`
    );

    return {
      success: stats.errors.length === 0,
      filesDownloaded: downloadResult.files.length,
      filesProcessed: totalProcessed,
      claimsUpdated: stats.claimsUpdated,
      errors: stats.errors,
      details: {
        file999Count: stats.file999Count,
        file277Count: stats.file277Count,
        file835Count: stats.file835Count,
      },
    };
  } catch (error) {
    console.error('[Reconciliation] Fatal error:', error);
    return {
      success: false,
      filesDownloaded: 0,
      filesProcessed: 0,
      claimsUpdated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      details: { file999Count: 0, file277Count: 0, file835Count: 0 },
    };
  }
}

interface ProcessResult {
  success: boolean;
  claimsMatched: number;
  claimsUpdated: number;
  error?: string;
}

/**
 * Process a single response file
 */
async function processResponseFile(
  fileId: string,
  fileType: EDIResponseFileType,
  content: string,
  supabase: ReturnType<typeof getServerSupabase>
): Promise<ProcessResult> {
  switch (fileType) {
    case '999':
      return process999File(fileId, content, supabase);
    case '277':
      return process277File(fileId, content, supabase);
    case '835':
      return process835File(fileId, content, supabase);
    default:
      return { success: false, claimsMatched: 0, claimsUpdated: 0, error: 'Unknown file type' };
  }
}

/**
 * Process 999 Functional Acknowledgment
 * Updates claims from 'submitted' to 'acknowledged'
 */
async function process999File(
  fileId: string,
  content: string,
  supabase: ReturnType<typeof getServerSupabase>
): Promise<ProcessResult> {
  const parseResult = parse999(content);

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      claimsMatched: 0,
      claimsUpdated: 0,
      error: parseResult.error || 'Failed to parse 999 file',
    };
  }

  const parsed: Parsed999 = parseResult.data;
  let claimsMatched = 0;
  let claimsUpdated = 0;

  // Match by control number
  const controlNumber = parsed.originalControlNumber;

  if (controlNumber) {
    // Find claims with this control number
    const { data: claims } = await supabase
      .from('claims')
      .select('id, status, control_number')
      .eq('control_number', controlNumber);

    claimsMatched = claims?.length || 0;

    // Update claims to acknowledged status
    for (const claim of claims || []) {
      const previousStatus = claim.status;
      const newStatus: ClaimStatus = parsed.accepted ? 'acknowledged' : 'rejected';

      // Only update if status is changing and appropriate
      if (
        previousStatus === 'submitted' ||
        (previousStatus === 'acknowledged' && newStatus === 'rejected')
      ) {
        const { error: updateError } = await supabase
          .from('claims')
          .update({
            status: newStatus,
            acknowledgment_date: new Date().toISOString(),
            rejection_reason: parsed.accepted ? null : parsed.statusDescription,
            rejection_codes: parsed.errorCodes || null,
          })
          .eq('id', claim.id);

        if (!updateError) {
          claimsUpdated++;

          // Record status event
          await recordStatusEvent(supabase, {
            claimId: claim.id,
            responseFileId: fileId,
            previousStatus,
            newStatus,
            source: '999',
            responseCode: parsed.statusCode,
            responseDescription: parsed.statusDescription,
          });
        }
      }
    }
  }

  return { success: true, claimsMatched, claimsUpdated };
}

/**
 * Process 277 Claim Status Response
 * Updates claims to accepted/rejected/pending based on payer response
 */
async function process277File(
  fileId: string,
  content: string,
  supabase: ReturnType<typeof getServerSupabase>
): Promise<ProcessResult> {
  const parseResult = parse277(content);

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      claimsMatched: 0,
      claimsUpdated: 0,
      error: parseResult.error || 'Failed to parse 277 file',
    };
  }

  const parsed: Parsed277 = parseResult.data;
  let claimsMatched = 0;
  let claimsUpdated = 0;

  // Process each claim status
  for (const claimStatus of parsed.claimStatuses) {
    // Try to match by control number first
    let claims: { id: string; status: string; control_number: string | null }[] = [];

    if (claimStatus.controlNumber) {
      const { data } = await supabase
        .from('claims')
        .select('id, status, control_number')
        .eq('control_number', claimStatus.controlNumber);

      claims = data || [];
    }

    // If no match by control number and we have payer claim number, try that
    if (claims.length === 0 && claimStatus.payerClaimNumber) {
      const { data } = await supabase
        .from('claims')
        .select('id, status, control_number')
        .eq('payer_claim_number', claimStatus.payerClaimNumber);

      claims = data || [];
    }

    claimsMatched += claims.length;

    // Update matched claims
    for (const claim of claims) {
      const previousStatus = claim.status as ClaimStatus;
      const newStatus = claimStatus.claimStatus;

      // Determine what fields to update
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (claimStatus.payerClaimNumber) {
        updateData.payer_claim_number = claimStatus.payerClaimNumber;
      }

      if (newStatus === 'accepted') {
        updateData.accepted_date = new Date().toISOString();
      } else if (newStatus === 'rejected') {
        updateData.rejected_date = new Date().toISOString();
        updateData.rejection_reason = claimStatus.statusDescription;
        updateData.rejection_codes = [claimStatus.statusCategoryCode];
      }

      const { error: updateError } = await supabase
        .from('claims')
        .update(updateData)
        .eq('id', claim.id);

      if (!updateError) {
        claimsUpdated++;

        await recordStatusEvent(supabase, {
          claimId: claim.id,
          responseFileId: fileId,
          previousStatus,
          newStatus,
          source: '277',
          responseCode: claimStatus.statusCategoryCode,
          responseDescription: claimStatus.statusDescription,
        });
      }
    }
  }

  return { success: true, claimsMatched, claimsUpdated };
}

/**
 * Process 835 Electronic Remittance Advice (Payment)
 * Updates claims to paid/denied with payment amounts
 */
async function process835File(
  fileId: string,
  content: string,
  supabase: ReturnType<typeof getServerSupabase>
): Promise<ProcessResult> {
  const parseResult = parse835(content);

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      claimsMatched: 0,
      claimsUpdated: 0,
      error: parseResult.error || 'Failed to parse 835 file',
    };
  }

  const parsed: Parsed835 = parseResult.data;
  let claimsMatched = 0;
  let claimsUpdated = 0;

  // Process each claim payment
  for (const payment of parsed.claimPayments) {
    // Match by control number (patient control number)
    let claims: { id: string; status: string; control_number: string | null }[] = [];

    if (payment.patientControlNumber) {
      const { data } = await supabase
        .from('claims')
        .select('id, status, control_number')
        .eq('control_number', payment.patientControlNumber);

      claims = data || [];
    }

    // Fallback: try payer claim number
    if (claims.length === 0 && payment.payerClaimNumber) {
      const { data } = await supabase
        .from('claims')
        .select('id, status, control_number')
        .eq('payer_claim_number', payment.payerClaimNumber);

      claims = data || [];
    }

    claimsMatched += claims.length;

    // Update matched claims
    for (const claim of claims) {
      const previousStatus = claim.status as ClaimStatus;
      const newStatus: ClaimStatus = payment.paidAmount > 0 ? 'paid' : 'denied';

      const updateData: Record<string, unknown> = {
        status: newStatus,
        payer_claim_number: payment.payerClaimNumber || null,
        paid_amount: payment.paidAmount,
        paid_date: new Date().toISOString(),
      };

      if (newStatus === 'denied') {
        // Extract denial reason from adjustments
        const denialReasons = payment.adjustments
          .filter((adj) => adj.groupCode === 'CO' || adj.groupCode === 'PR')
          .map((adj) => `${adj.groupCode}-${adj.reasonCode}`)
          .join(', ');

        updateData.rejection_reason = denialReasons || payment.statusDescription;
        updateData.rejection_codes = payment.adjustments.map(
          (adj) => `${adj.groupCode}-${adj.reasonCode}`
        );
      }

      const { error: updateError } = await supabase
        .from('claims')
        .update(updateData)
        .eq('id', claim.id);

      if (!updateError) {
        claimsUpdated++;

        await recordStatusEvent(supabase, {
          claimId: claim.id,
          responseFileId: fileId,
          previousStatus,
          newStatus,
          source: '835',
          responseCode: payment.statusCode,
          responseDescription: payment.statusDescription,
          paymentAmount: payment.paidAmount,
        });
      }
    }
  }

  return { success: true, claimsMatched, claimsUpdated };
}

/**
 * Record a claim status change event
 */
async function recordStatusEvent(
  supabase: ReturnType<typeof getServerSupabase>,
  event: {
    claimId: string;
    responseFileId: string;
    previousStatus: ClaimStatus | string;
    newStatus: ClaimStatus;
    source: '999' | '277' | '835' | 'submission' | 'manual';
    responseCode?: string;
    responseDescription?: string;
    paymentAmount?: number;
  }
): Promise<void> {
  try {
    await supabase.from('claim_status_events').insert({
      claim_id: event.claimId,
      response_file_id: event.responseFileId,
      previous_status: event.previousStatus,
      new_status: event.newStatus,
      source: event.source,
      response_code: event.responseCode || null,
      response_description: event.responseDescription || null,
      payment_amount: event.paymentAmount || null,
    });
  } catch (error) {
    console.error('[Reconciliation] Failed to record status event:', error);
  }
}

/**
 * Get reconciliation status summary
 */
export async function getReconciliationSummary(): Promise<{
  totalFiles: number;
  pendingFiles: number;
  lastProcessed: string | null;
  claimStatusCounts: Record<ClaimStatus, number>;
}> {
  const supabase = getServerSupabase();

  // Get file counts
  const { data: files } = await supabase
    .from('edi_response_files')
    .select('processing_status, processed_at')
    .order('processed_at', { ascending: false });

  const totalFiles = files?.length || 0;
  const pendingFiles = files?.filter((f) => f.processing_status === 'pending').length || 0;
  const lastProcessed = files?.[0]?.processed_at || null;

  // Get claim status counts
  const { data: claims } = await supabase.from('claims').select('status');

  const statusCounts: Record<ClaimStatus, number> = {
    draft: 0,
    submitted: 0,
    acknowledged: 0,
    accepted: 0,
    rejected: 0,
    pending: 0,
    paid: 0,
    denied: 0,
    failed: 0,
  };

  for (const claim of claims || []) {
    const status = claim.status as ClaimStatus;
    if (status in statusCounts) {
      statusCounts[status]++;
    }
  }

  return {
    totalFiles,
    pendingFiles,
    lastProcessed,
    claimStatusCounts: statusCounts,
  };
}
