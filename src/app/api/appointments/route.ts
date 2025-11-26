/**
 * GET /api/appointments
 * Fetches appointments from IntakeQ and enriches with claim status from our database
 */

import { NextRequest, NextResponse } from 'next/server';
import { intakeqService } from '@/services/intakeq';
import { getServerSupabase } from '@/services/supabase';
import type { AppointmentWithClaim, ClaimStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Fetch appointments from IntakeQ
    const appointmentsResult = await intakeqService.getAppointments({
      startDate,
      endDate,
    });

    if (!appointmentsResult.success || !appointmentsResult.data) {
      return NextResponse.json(
        { error: appointmentsResult.error?.message || 'Failed to fetch appointments' },
        { status: 500 }
      );
    }

    const appointments = appointmentsResult.data;

    // Fetch claim statuses from our database
    const supabase = getServerSupabase();
    const appointmentIds = appointments.map((a) => a.Id);

    const { data: claims } = await supabase
      .from('claims')
      .select('intakeq_appointment_id, id, status')
      .in('intakeq_appointment_id', appointmentIds);

    // Create status lookup
    const claimLookup: Record<string, { id: string; status: ClaimStatus }> = {};
    claims?.forEach((c) => {
      claimLookup[c.intakeq_appointment_id] = {
        id: c.id,
        status: c.status as ClaimStatus,
      };
    });

    // Merge appointment data with claim status
    const enrichedAppointments: AppointmentWithClaim[] = appointments.map((apt) => ({
      ...apt,
      claimStatus: claimLookup[apt.Id]?.status || 'not_submitted',
      claimId: claimLookup[apt.Id]?.id,
    }));

    // Sort by date descending (most recent first)
    enrichedAppointments.sort((a, b) => b.StartDate - a.StartDate);

    return NextResponse.json({ data: enrichedAppointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}
