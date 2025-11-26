/**
 * POST /api/claims
 * Creates and submits a claim to Office Ally
 *
 * Flow:
 * 1. Validate request body
 * 2. Get payer info from DB
 * 3. Generate EDI content
 * 4. Save claim to DB (status: draft)
 * 5. Upload to Office Ally SFTP
 * 6. Update claim status (submitted or failed)
 * 7. Return result
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/services/supabase';
import { generateEDI, generateControlNumber } from '@/services/ediGenerator';
import { uploadClaim } from '@/services/officeAlly';
import type { ClaimFormData, EDIClaimData, SubmitClaimResponse, Payer } from '@/types';
import { toEDIDate } from '@/lib/utils';

export async function POST(request: NextRequest): Promise<NextResponse<SubmitClaimResponse>> {
  try {
    const body: ClaimFormData & { intakeq_appointment_id: string } = await request.json();

    // Validate required fields
    const required = [
      'intakeq_appointment_id',
      'patient_first_name',
      'patient_last_name',
      'patient_dob',
      'payer_id',
      'member_id',
      'diagnosis_codes',
      'service_lines',
      'rendering_provider_npi',
    ];

    for (const field of required) {
      if (!body[field as keyof typeof body]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate diagnosis codes
    if (!Array.isArray(body.diagnosis_codes) || body.diagnosis_codes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one diagnosis code is required' },
        { status: 400 }
      );
    }

    // Validate service lines
    if (!Array.isArray(body.service_lines) || body.service_lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one service line is required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Get payer info
    const { data: payer, error: payerError } = await supabase
      .from('payers')
      .select('*')
      .eq('id', body.payer_id)
      .single();

    if (payerError || !payer) {
      return NextResponse.json(
        { success: false, error: 'Invalid payer' },
        { status: 400 }
      );
    }

    const payerData = payer as Payer;

    // Generate control number
    const controlNumber = generateControlNumber();

    // Calculate total charge
    const totalCharge = body.service_lines.reduce((sum, line) => sum + line.charge, 0);

    // Build EDI data
    const ediData: EDIClaimData = {
      patientFirstName: body.patient_first_name,
      patientLastName: body.patient_last_name,
      patientDob: toEDIDate(body.patient_dob),
      patientGender: body.patient_gender || 'U',
      patientAddress: {
        street: body.patient_address_street || '',
        city: body.patient_address_city || '',
        state: body.patient_address_state || '',
        zip: body.patient_address_zip || '',
      },
      // Support both v1 and v2 schema column names
      payerId: payerData.oa_professional_837p_id || payerData.office_ally_payer_id || '',
      memberId: body.member_id,
      groupNumber: body.group_number,
      subscriberName: body.subscriber_name || `${body.patient_first_name} ${body.patient_last_name}`,
      subscriberDob: toEDIDate(body.subscriber_dob || body.patient_dob),
      subscriberRelationship: body.subscriber_relationship || 'self',
      diagnosisCodes: body.diagnosis_codes.map((d) => ({
        code: d.code,
        isPrimary: d.isPrimary,
      })),
      serviceLines: body.service_lines.map((line) => ({
        dos: toEDIDate(line.dos),
        cpt: line.cpt,
        modifier: line.modifier,
        units: line.units,
        charge: line.charge,
        diagnosisPointers: line.diagnosis_pointers || [1],
      })),
      renderingNpi: body.rendering_provider_npi,
      billingNpi: process.env.MOONLIT_BILLING_NPI || '',
      billingTin: process.env.MOONLIT_BILLING_TIN || '',
      billingName: 'MOONLIT PLLC',
      billingAddress: {
        street: '123 Medical Plaza',
        city: 'Salt Lake City',
        state: 'UT',
        zip: '84101',
      },
      controlNumber,
    };

    // Generate EDI content
    const ediResult = generateEDI(ediData);

    if (!ediResult.success || !ediResult.ediContent) {
      return NextResponse.json(
        { success: false, error: ediResult.error || 'EDI generation failed' },
        { status: 500 }
      );
    }

    // Save claim to database (status: draft)
    const { data: claim, error: insertError } = await supabase
      .from('claims')
      .insert({
        intakeq_appointment_id: body.intakeq_appointment_id,
        patient_first_name: body.patient_first_name,
        patient_last_name: body.patient_last_name,
        patient_dob: body.patient_dob,
        patient_gender: body.patient_gender,
        patient_address_street: body.patient_address_street,
        patient_address_city: body.patient_address_city,
        patient_address_state: body.patient_address_state,
        patient_address_zip: body.patient_address_zip,
        payer_id: body.payer_id,
        member_id: body.member_id,
        group_number: body.group_number,
        subscriber_name: body.subscriber_name,
        subscriber_dob: body.subscriber_dob,
        subscriber_relationship: body.subscriber_relationship || 'self',
        diagnosis_codes: body.diagnosis_codes,
        service_lines: body.service_lines,
        rendering_provider_npi: body.rendering_provider_npi,
        billing_provider_npi: process.env.MOONLIT_BILLING_NPI,
        total_charge: totalCharge,
        status: 'draft',
        edi_content: ediResult.ediContent,
      })
      .select()
      .single();

    if (insertError || !claim) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save claim' },
        { status: 500 }
      );
    }

    // Upload to Office Ally SFTP
    const uploadResult = await uploadClaim(ediResult.ediContent, claim.id);

    if (uploadResult.success) {
      // Update claim status to submitted
      await supabase
        .from('claims')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          edi_filename: uploadResult.fileName,
        })
        .eq('id', claim.id);

      return NextResponse.json({
        success: true,
        claimId: claim.id,
        filename: uploadResult.fileName,
        message: 'Claim submitted successfully',
      });
    } else {
      // Update claim with error
      await supabase
        .from('claims')
        .update({
          status: 'failed',
          submission_error: uploadResult.error,
        })
        .eq('id', claim.id);

      return NextResponse.json(
        {
          success: false,
          claimId: claim.id,
          error: uploadResult.error || 'SFTP upload failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Claim submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process claim' },
      { status: 500 }
    );
  }
}
