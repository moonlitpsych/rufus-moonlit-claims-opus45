'use client';

/**
 * ClaimStatusHistory Component
 * V2: Shows the audit trail of status changes for a claim
 */

import { useState, useEffect } from 'react';
import type { ClaimStatusEvent, ClaimStatus } from '@/types';

interface ClaimStatusHistoryProps {
  claimId: string;
  className?: string;
}

interface StatusEventDisplay extends Omit<ClaimStatusEvent, 'created_at'> {
  created_at: string;
  formatted_date?: string;
}

// Status colors for the timeline
const statusColors: Record<ClaimStatus | string, string> = {
  draft: 'bg-gray-400',
  submitted: 'bg-blue-500',
  acknowledged: 'bg-indigo-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  pending: 'bg-yellow-500',
  paid: 'bg-emerald-600',
  denied: 'bg-rose-600',
  failed: 'bg-red-700',
};

// Source icons/labels
const sourceLabels: Record<string, { label: string; icon: string }> = {
  submission: { label: 'Submitted', icon: '📤' },
  '999': { label: 'Acknowledgment (999)', icon: '✉️' },
  '277': { label: 'Claim Status (277)', icon: '📋' },
  '835': { label: 'Payment (835)', icon: '💰' },
  manual: { label: 'Manual Update', icon: '✏️' },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ClaimStatusHistory({
  claimId,
  className = '',
}: ClaimStatusHistoryProps) {
  const [events, setEvents] = useState<StatusEventDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/claims/${claimId}/history`);

        if (!response.ok) {
          throw new Error('Failed to load history');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setEvents(
            data.data.map((event: StatusEventDisplay) => ({
              ...event,
              formatted_date: formatDate(event.created_at),
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    if (claimId && isExpanded) {
      fetchHistory();
    }
  }, [claimId, isExpanded]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ${className}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        View History
      </button>
    );
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-gray-700">Status History</h4>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <svg
            className="animate-spin h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading history...
        </div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : events.length === 0 ? (
        <div className="text-gray-500 text-sm">No status history available</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-2 top-3 bottom-3 w-0.5 bg-gray-200" />

          {/* Events */}
          <div className="space-y-4">
            {events.map((event, index) => {
              const sourceInfo = sourceLabels[event.source] || {
                label: event.source,
                icon: '📄',
              };
              const statusColor =
                statusColors[event.new_status] || 'bg-gray-400';

              return (
                <div key={event.id || index} className="relative pl-6">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-1 w-4 h-4 rounded-full ${statusColor} border-2 border-white shadow`}
                  />

                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm mr-1">{sourceInfo.icon}</span>
                        <span className="font-medium text-gray-900">
                          {formatStatus(event.new_status)}
                        </span>
                        {event.previous_status && (
                          <span className="text-gray-400 text-sm ml-2">
                            from {formatStatus(event.previous_status)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {event.formatted_date}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                      {sourceInfo.label}
                    </div>

                    {event.response_description && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded px-2 py-1">
                        {event.response_description}
                      </div>
                    )}

                    {event.response_code && (
                      <div className="mt-1 text-xs text-gray-400">
                        Code: {event.response_code}
                      </div>
                    )}

                    {event.payment_amount !== null && event.payment_amount > 0 && (
                      <div className="mt-2 text-sm font-medium text-emerald-600">
                        Payment: ${event.payment_amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
