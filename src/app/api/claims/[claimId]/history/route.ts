/**
 * GET /api/claims/[claimId]/history
 * V2: Fetches status change history for a claim
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/services/supabase';
import type { ClaimStatusEvent } from '@/types';

interface RouteParams {
  params: Promise<{ claimId: string }>;
}

interface HistoryResponse {
  success: boolean;
  data?: ClaimStatusEvent[];
  error?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<HistoryResponse>> {
  try {
    const { claimId } = await params;
    const supabase = getServerSupabase();

    // Fetch status events for this claim, ordered by newest first
    const { data: events, error } = await supabase
      .from('claim_status_events')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching claim history:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: events || [],
    });
  } catch (error) {
    console.error('Error in claim history route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
