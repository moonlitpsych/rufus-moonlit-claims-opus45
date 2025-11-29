/**
 * GET /api/providers
 * Fetches rendering providers for claim form dropdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/services/supabase';

interface Provider {
  id: string;
  name: string;
  npi: string;
  type: 'individual' | 'organization';
  is_active: boolean;
  is_bookable: boolean;
}

interface ProvidersResponse {
  success: boolean;
  data?: Provider[];
  error?: string;
}

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ProvidersResponse>> {
  try {
    const supabase = getServerSupabase();

    // Fetch active individual providers (for rendering provider dropdown)
    const { data: providers, error } = await supabase
      .from('billing_providers')
      .select('id, name, npi, type, is_active, is_bookable')
      .eq('is_active', true)
      .eq('type', 'individual')
      .order('name');

    if (error) {
      console.error('Error fetching providers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: providers || [],
    });
  } catch (error) {
    console.error('Error in providers route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
