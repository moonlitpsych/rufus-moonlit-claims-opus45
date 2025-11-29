/**
 * Status Badge Component
 * Displays claim status with appropriate color coding
 * V2: Extended with reconciliation statuses
 */

'use client';

import { cn } from '@/lib/utils';
import type { ClaimDisplayStatus } from '@/types';

interface StatusBadgeProps {
  status: ClaimDisplayStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const getStatusConfig = (status: ClaimDisplayStatus) => {
    switch (status) {
      // Not yet submitted
      case 'not_submitted':
        return {
          label: 'Not Submitted',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
        };
      case 'draft':
        return {
          label: 'Draft',
          color: 'bg-slate-100 text-slate-800 border-slate-300',
        };

      // Submission states
      case 'submitted':
        return {
          label: 'Submitted',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'failed':
        return {
          label: 'Failed',
          color: 'bg-red-100 text-red-800 border-red-300',
        };

      // V2: Acknowledgment from Office Ally (999)
      case 'acknowledged':
        return {
          label: 'Acknowledged',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        };

      // V2: Payer response statuses (277)
      case 'accepted':
        return {
          label: 'Accepted',
          color: 'bg-green-100 text-green-800 border-green-300',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          color: 'bg-red-100 text-red-800 border-red-300',
        };
      case 'pending':
        return {
          label: 'Pending',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        };

      // V2: Payment statuses (835)
      case 'paid':
        return {
          label: 'Paid',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'denied':
        return {
          label: 'Denied',
          color: 'bg-rose-100 text-rose-800 border-rose-300',
        };

      // V2: External submissions
      case 'intakeq_submitted':
        return {
          label: 'IntakeQ',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
        };

      default:
        return {
          label: 'Unknown',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
        };
    }
  };

  const config = getStatusConfig(status);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.color,
        sizeClasses[size]
      )}
    >
      {config.label}
    </span>
  );
}
