/**
 * POST /api/reconciliation
 * GET /api/reconciliation
 *
 * V2: Reconciliation API for syncing claim statuses with Office Ally response files
 *
 * POST: Trigger reconciliation (download and process response files)
 * GET: Get reconciliation status summary
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runReconciliation,
  getReconciliationSummary,
} from '@/services/reconciliationEngine';
import type { ReconciliationResult } from '@/types';

interface ReconciliationResponse {
  success: boolean;
  data?: ReconciliationResult | Awaited<ReturnType<typeof getReconciliationSummary>>;
  error?: string;
}

/**
 * POST - Trigger reconciliation process
 */
export async function POST(
  _request: NextRequest
): Promise<NextResponse<ReconciliationResponse>> {
  try {
    console.log('[API] Starting reconciliation...');
    const result = await runReconciliation();

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('[API] Reconciliation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get reconciliation summary
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse<ReconciliationResponse>> {
  try {
    const summary = await getReconciliationSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[API] Failed to get reconciliation summary:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get summary',
      },
      { status: 500 }
    );
  }
}
