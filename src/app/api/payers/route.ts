/**
 * GET /api/payers
 * Fetches active payers from the database
 */

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/services/supabase';
import type { Payer } from '@/types';

export async function GET() {
  try {
    const supabase = getServerSupabase();

    // Note: existing v2 schema doesn't have is_active column, so we fetch all
    const { data, error } = await supabase
      .from('payers')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching payers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payers' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data as Payer[] });
  } catch (error) {
    console.error('Error fetching payers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payers' },
      { status: 500 }
    );
  }
}
