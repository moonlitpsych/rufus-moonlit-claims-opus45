/**
 * Dashboard Page
 * Main appointments dashboard with claim status and modal
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { AppointmentCard } from '@/components/AppointmentCard';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { ClaimModal } from '@/components/claims/ClaimModal';
import ReconciliationButton from '@/components/ReconciliationButton';
import type { AppointmentWithClaim, ReconciliationResult } from '@/types';

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<AppointmentWithClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); // days
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithClaim | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

      const response = await fetch(
        `/api/appointments?startDate=${startDate}&endDate=${endDate}`
      );

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setAppointments(data.data || []);
      }
    } catch (err) {
      setError('Failed to fetch appointments');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleMakeClaim = (appointmentId: string) => {
    const appointment = appointments.find((a) => a.Id === appointmentId);
    if (appointment) {
      setSelectedAppointment(appointment);
      setIsModalOpen(true);
    }
  };

  const handleClaimSuccess = () => {
    fetchAppointments(); // Refresh the list
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleReconciliationComplete = (result: ReconciliationResult) => {
    // Refresh appointments if any claims were updated
    if (result.claimsUpdated > 0) {
      fetchAppointments();
    }
  };

  // Filter appointments: "completed" = past confirmed appointments eligible for claims
  const now = new Date();
  const completedAppointments = appointments.filter((a) => {
    const endDate = new Date(a.EndDateIso);
    return (a.Status === 'Confirmed' || a.Status === 'Completed') && endDate < now;
  });
  const otherAppointments = appointments.filter((a) => {
    const endDate = new Date(a.EndDateIso);
    const isPastConfirmed = (a.Status === 'Confirmed' || a.Status === 'Completed') && endDate < now;
    return !isPastConfirmed;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Moonlit Claims</h1>
              <p className="mt-1 text-sm text-gray-500">
                Claims submission dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ReconciliationButton onComplete={handleReconciliationComplete} />
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats - V2 with reconciliation statuses */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Appointments</div>
            <div className="text-2xl font-bold text-gray-900">{completedAppointments.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Not Submitted</div>
            <div className="text-2xl font-bold text-gray-400">
              {completedAppointments.filter((a) => a.claimStatus === 'not_submitted').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Submitted</div>
            <div className="text-2xl font-bold text-blue-600">
              {appointments.filter((a) => a.claimStatus === 'submitted' || a.claimStatus === 'acknowledged').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Accepted</div>
            <div className="text-2xl font-bold text-green-600">
              {appointments.filter((a) => a.claimStatus === 'accepted').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Paid</div>
            <div className="text-2xl font-bold text-emerald-600">
              {appointments.filter((a) => a.claimStatus === 'paid').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Rejected</div>
            <div className="text-2xl font-bold text-red-600">
              {appointments.filter((a) => a.claimStatus === 'rejected' || a.claimStatus === 'denied').length}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading appointments...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            <p className="font-medium">Error loading appointments</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchAppointments}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Appointments List */}
        {!isLoading && !error && (
          <>
            {/* Completed Appointments - Ready for Claims */}
            {completedAppointments.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Completed Appointments ({completedAppointments.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.Id}
                      appointment={appointment}
                      onMakeClaim={handleMakeClaim}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Other Appointments */}
            {otherAppointments.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-500 mb-4">
                  Upcoming/Other ({otherAppointments.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                  {otherAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.Id}
                      appointment={appointment}
                      onMakeClaim={handleMakeClaim}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {appointments.length === 0 && (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No appointments found in the selected date range.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Claim Modal */}
      <ClaimModal
        isOpen={isModalOpen}
        appointment={selectedAppointment}
        onClose={handleCloseModal}
        onSuccess={handleClaimSuccess}
      />
    </div>
  );
}
