/**
 * Status Badge Component
 * Displays claim status with appropriate color coding
 */

'use client';

import { cn } from '@/lib/utils';
import type { ClaimStatus } from '@/types';

interface StatusBadgeProps {
  status: ClaimStatus | 'not_submitted';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const getStatusConfig = (status: ClaimStatus | 'not_submitted') => {
    switch (status) {
      case 'not_submitted':
        return {
          label: 'Not Submitted',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
        };
      case 'draft':
        return {
          label: 'Draft',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'submitted':
        return {
          label: 'Submitted',
          color: 'bg-green-100 text-green-800 border-green-300',
        };
      case 'failed':
        return {
          label: 'Failed',
          color: 'bg-red-100 text-red-800 border-red-300',
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
