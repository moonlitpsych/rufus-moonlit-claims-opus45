/**
 * Draft Claims API
 * GET: Check for existing draft for an appointment
 * POST: Save/update draft claim
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/services/supabase';

// GET - Fetch existing draft for an appointment
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appointmentId = searchParams.get('appointment_id');

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: 'appointment_id is required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Look for existing draft claim for this appointment
    const { data: draft, error } = await supabase
      .from('claims')
      .select('*')
      .eq('intakeq_appointment_id', appointmentId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Error fetching draft:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: draft || null,
    });
  } catch (error) {
    console.error('Error in draft route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Save or update draft claim
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getServerSupabase();

    const {
      intakeq_appointment_id,
      patient_first_name,
      patient_last_name,
      patient_dob,
      patient_gender,
      patient_address_street,
      patient_address_city,
      patient_address_state,
      patient_address_zip,
      payer_id,
      member_id,
      group_number,
      subscriber_name,
      subscriber_dob,
      subscriber_relationship,
      diagnosis_codes,
      service_lines,
      rendering_provider_npi,
    } = body;

    if (!intakeq_appointment_id) {
      return NextResponse.json(
        { success: false, error: 'intakeq_appointment_id is required' },
        { status: 400 }
      );
    }

    // Calculate total charge from service lines
    const total_charge = (service_lines || []).reduce(
      (sum: number, line: { charge: number }) => sum + (line.charge || 0),
      0
    );

    // Check if draft already exists
    const { data: existingDraft } = await supabase
      .from('claims')
      .select('id')
      .eq('intakeq_appointment_id', intakeq_appointment_id)
      .eq('status', 'draft')
      .limit(1)
      .single();

    const draftData = {
      intakeq_appointment_id,
      patient_first_name: patient_first_name || '',
      patient_last_name: patient_last_name || '',
      patient_dob: patient_dob || null,
      patient_gender: patient_gender || 'U',
      patient_address_street: patient_address_street || null,
      patient_address_city: patient_address_city || null,
      patient_address_state: patient_address_state || null,
      patient_address_zip: patient_address_zip || null,
      payer_id: payer_id || null,
      member_id: member_id || '',
      group_number: group_number || null,
      subscriber_name: subscriber_name || null,
      subscriber_dob: subscriber_dob || null,
      subscriber_relationship: subscriber_relationship || 'self',
      diagnosis_codes: diagnosis_codes || [],
      service_lines: service_lines || [],
      rendering_provider_npi: rendering_provider_npi || '',
      billing_provider_npi: '1275348807', // Moonlit PLLC
      total_charge,
      status: 'draft',
    };

    let result;
    if (existingDraft) {
      // Update existing draft
      result = await supabase
        .from('claims')
        .update(draftData)
        .eq('id', existingDraft.id)
        .select()
        .single();
    } else {
      // Create new draft
      result = await supabase
        .from('claims')
        .insert(draftData)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving draft:', result.error);
      return NextResponse.json(
        { success: false, error: 'Failed to save draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Error in draft route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
