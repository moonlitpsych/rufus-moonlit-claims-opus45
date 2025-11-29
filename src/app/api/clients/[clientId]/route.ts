/**
 * GET /api/clients/[clientId]
 * V2: Fetches client data from IntakeQ with insurance information
 * Used for auto-population of CMS-1500 form
 *
 * Returns:
 * - Client data from IntakeQ
 * - Auto-populated form data
 * - Which fields were auto-populated
 * - Payer match result (matched, confidence, carrier name)
 */

import { NextRequest, NextResponse } from 'next/server';
import { intakeqService } from '@/services/intakeq';
import { getServerSupabase } from '@/services/supabase';
import {
  matchPayer,
  normalizeGender,
  normalizeRelationship,
  formatUnixTimestampToDate,
} from '@/services/payerMatcher';
import type {
  ClaimFormData,
  AutoPopulatedFields,
  Payer,
  PayerMatchResult,
} from '@/types';

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

interface ClientDataResponse {
  success: boolean;
  data?: {
    autoPopulatedData: Partial<ClaimFormData>;
    autoPopulatedFields: AutoPopulatedFields;
    payerMatch: {
      matched: boolean;
      confidence: PayerMatchResult['confidence'];
      intakeqCarrier: string | null;
      matchedPayer: string | null;
    };
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ClientDataResponse>> {
  try {
    const { clientId } = await params;

    // Fetch client from IntakeQ
    const clientResult = await intakeqService.getClient(clientId);

    if (!clientResult.success || !clientResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: clientResult.error?.message || 'Client not found',
        },
        { status: 404 }
      );
    }

    const client = clientResult.data;

    // Fetch payers for matching
    const supabase = getServerSupabase();
    const { data: payers } = await supabase
      .from('payers')
      .select('*')
      .order('name');

    // Match insurance carrier to our payers
    const payerMatch = matchPayer(
      client.PrimaryInsuranceCompany,
      (payers || []) as Payer[]
    );

    // Build auto-populated form data
    const autoPopulatedData: Partial<ClaimFormData> = {};
    const autoPopulatedFields: AutoPopulatedFields = {
      patient_first_name: false,
      patient_last_name: false,
      patient_dob: false,
      patient_gender: false,
      patient_address_street: false,
      patient_address_city: false,
      patient_address_state: false,
      patient_address_zip: false,
      payer_id: false,
      member_id: false,
      group_number: false,
      subscriber_name: false,
      subscriber_dob: false,
      subscriber_relationship: false,
    };

    // Patient demographics
    if (client.FirstName) {
      autoPopulatedData.patient_first_name = client.FirstName;
      autoPopulatedFields.patient_first_name = true;
    }
    if (client.LastName) {
      autoPopulatedData.patient_last_name = client.LastName;
      autoPopulatedFields.patient_last_name = true;
    }

    // DOB - IntakeQ returns Unix timestamp in milliseconds
    const patientDob = formatUnixTimestampToDate(client.DateOfBirth);
    if (patientDob) {
      autoPopulatedData.patient_dob = patientDob;
      autoPopulatedFields.patient_dob = true;
    }

    if (client.Gender) {
      autoPopulatedData.patient_gender = normalizeGender(client.Gender);
      autoPopulatedFields.patient_gender = true;
    }

    // Address - prefer individual fields, fall back to combined
    if (client.StreetAddress) {
      autoPopulatedData.patient_address_street = client.StreetAddress;
      autoPopulatedFields.patient_address_street = true;
    } else if (client.Address) {
      autoPopulatedData.patient_address_street = client.Address;
      autoPopulatedFields.patient_address_street = true;
    }

    if (client.City) {
      autoPopulatedData.patient_address_city = client.City;
      autoPopulatedFields.patient_address_city = true;
    }

    if (client.StateShort) {
      autoPopulatedData.patient_address_state = client.StateShort.toUpperCase();
      autoPopulatedFields.patient_address_state = true;
    }

    if (client.PostalCode) {
      autoPopulatedData.patient_address_zip = client.PostalCode;
      autoPopulatedFields.patient_address_zip = true;
    }

    // Insurance information
    if (payerMatch.payer) {
      autoPopulatedData.payer_id = payerMatch.payer.id;
      autoPopulatedFields.payer_id = true;
    }

    // Member ID (PrimaryInsurancePolicyNumber per IntakeQ docs)
    if (client.PrimaryInsurancePolicyNumber) {
      autoPopulatedData.member_id = client.PrimaryInsurancePolicyNumber;
      autoPopulatedFields.member_id = true;
    }

    // Group Number
    if (client.PrimaryInsuranceGroupNumber) {
      autoPopulatedData.group_number = client.PrimaryInsuranceGroupNumber;
      autoPopulatedFields.group_number = true;
    }

    // Subscriber Name
    if (client.PrimaryInsuranceHolderName) {
      autoPopulatedData.subscriber_name = client.PrimaryInsuranceHolderName;
      autoPopulatedFields.subscriber_name = true;
    }

    // Subscriber DOB
    const subscriberDob = formatUnixTimestampToDate(
      client.PrimaryInsuranceHolderDateOfBirth
    );
    if (subscriberDob) {
      autoPopulatedData.subscriber_dob = subscriberDob;
      autoPopulatedFields.subscriber_dob = true;
    }

    // Subscriber Relationship
    if (client.PrimaryInsuranceRelationship) {
      autoPopulatedData.subscriber_relationship = normalizeRelationship(
        client.PrimaryInsuranceRelationship
      );
      autoPopulatedFields.subscriber_relationship = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        autoPopulatedData,
        autoPopulatedFields,
        payerMatch: {
          matched: !!payerMatch.payer,
          confidence: payerMatch.confidence,
          intakeqCarrier: payerMatch.intakeqCarrierName,
          matchedPayer: payerMatch.payer?.name || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch client data' },
      { status: 500 }
    );
  }
}
