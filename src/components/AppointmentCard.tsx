/**
 * Appointment Card Component
 * Displays individual appointment with claim status
 */

'use client';

import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';
import type { AppointmentWithClaim } from '@/types';

interface AppointmentCardProps {
  appointment: AppointmentWithClaim;
  onMakeClaim: (appointmentId: string) => void;
}

export function AppointmentCard({ appointment, onMakeClaim }: AppointmentCardProps) {
  // IntakeQ provides ISO date strings
  const startDate = new Date(appointment.StartDateIso);
  const endDate = new Date(appointment.EndDateIso);
  const durationMinutes = appointment.Duration;

  // IntakeQ doesn't have a "Completed" status - appointments stay "Confirmed"
  // So we check if it's confirmed AND the appointment time has passed
  const isPastAppointment = new Date(appointment.EndDateIso) < new Date();
  const isEligibleForClaim = (appointment.Status === 'Confirmed' || appointment.Status === 'Completed') && isPastAppointment;
  const hasExistingClaim = appointment.claimStatus !== 'not_submitted';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Date and Time */}
          <div className="mb-2 flex items-center gap-3">
            <time className="text-lg font-semibold text-gray-900">
              {format(startDate, 'MMM d, yyyy')}
            </time>
            <span className="text-sm text-gray-500">
              {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')} ({durationMinutes} min)
            </span>
          </div>

          {/* Service Name */}
          <h3 className="mb-2 text-base font-medium text-gray-900">
            {appointment.ServiceName}
          </h3>

          {/* Practitioner */}
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>{appointment.PractitionerName}</span>
          </div>

          {/* Patient Name */}
          <div className="mb-2 text-sm text-gray-600">
            <span className="font-medium">Patient:</span> {appointment.ClientName}
          </div>

          {/* Appointment Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Appointment:</span>
            <span
              className={`text-xs font-medium ${
                isPastAppointment && appointment.Status === 'Confirmed'
                  ? 'text-green-600'
                  : appointment.Status === 'Confirmed'
                    ? 'text-blue-600'
                    : 'text-gray-600'
              }`}
            >
              {isPastAppointment && appointment.Status === 'Confirmed' ? 'Completed' : appointment.Status}
            </span>
          </div>
        </div>

        {/* Claim Status Badge */}
        <div className="ml-4">
          <StatusBadge status={appointment.claimStatus} />
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4">
        {hasExistingClaim ? (
          <button
            disabled
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
          >
            {appointment.claimStatus === 'submitted' ? 'Claim Submitted' : 'View Claim'}
          </button>
        ) : (
          <button
            onClick={() => onMakeClaim(appointment.Id)}
            disabled={!isEligibleForClaim}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isEligibleForClaim
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Make Claim
          </button>
        )}
      </div>

      {/* Appointment ID (small, for reference) */}
      <div className="mt-3 text-xs text-gray-400">
        ID: {appointment.Id.substring(0, 8)}...
      </div>
    </div>
  );
}
