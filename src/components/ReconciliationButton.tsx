'use client';

/**
 * ReconciliationButton Component
 * V2: Manual trigger for syncing claim statuses with Office Ally response files
 *
 * Shows:
 * - Button to trigger reconciliation
 * - Loading state during process
 * - Results summary after completion
 */

import { useState, useCallback } from 'react';
import type { ReconciliationResult } from '@/types';

interface ReconciliationButtonProps {
  onComplete?: (result: ReconciliationResult) => void;
  className?: string;
}

export default function ReconciliationButton({
  onComplete,
  className = '',
}: ReconciliationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runReconciliation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/reconciliation', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Reconciliation failed');
      }

      const reconciliationResult = data.data as ReconciliationResult;
      setResult(reconciliationResult);

      if (onComplete) {
        onComplete(reconciliationResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [onComplete]);

  const dismissResult = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className={`inline-block ${className}`}>
      {/* Main Button */}
      <button
        onClick={runReconciliation}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${
            isLoading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
          }
        `}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
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
            <span>Syncing...</span>
          </>
        ) : (
          <>
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Sync Claim Statuses</span>
          </>
        )}
      </button>

      {/* Results Popup */}
      {(result || error) && (
        <div className="absolute mt-2 z-50">
          <div
            className={`
              rounded-lg shadow-lg p-4 max-w-sm border
              ${
                error
                  ? 'bg-red-50 border-red-200'
                  : result?.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
              }
            `}
          >
            {/* Close button */}
            <button
              onClick={dismissResult}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {error ? (
              <div className="text-red-700">
                <div className="font-medium mb-1">Sync Failed</div>
                <div className="text-sm">{error}</div>
              </div>
            ) : result ? (
              <div className={result.success ? 'text-green-700' : 'text-yellow-700'}>
                <div className="font-medium mb-2">
                  {result.success ? 'Sync Complete' : 'Sync Completed with Errors'}
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Files downloaded:</span>
                    <span className="font-medium">{result.filesDownloaded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Files processed:</span>
                    <span className="font-medium">{result.filesProcessed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Claims updated:</span>
                    <span className="font-medium">{result.claimsUpdated}</span>
                  </div>
                  {result.details && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                      <div>999 files: {result.details.file999Count}</div>
                      <div>277 files: {result.details.file277Count}</div>
                      <div>835 files: {result.details.file835Count}</div>
                    </div>
                  )}
                  {result.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-red-600 text-xs">
                        {result.errors.length} error(s) occurred
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
