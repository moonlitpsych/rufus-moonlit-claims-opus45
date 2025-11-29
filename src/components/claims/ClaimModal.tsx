/**
 * Claim Modal Component
 * CMS-1500 form for claim data entry
 * V2: Auto-population from IntakeQ Client API
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppointmentWithClaim,
  Payer,
  ClaimFormData,
  DiagnosisCode,
  ServiceLine,
  AutoPopulatedFields,
} from '@/types';

// Provider type for rendering provider dropdown
interface Provider {
  id: string;
  name: string;
  npi: string;
  type: 'individual' | 'organization';
  is_active: boolean;
  is_bookable: boolean;
}
import { format } from 'date-fns';

// Initial state for auto-populated fields tracking
const INITIAL_AUTO_POPULATED: AutoPopulatedFields = {
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

interface ClaimModalProps {
  isOpen: boolean;
  appointment: AppointmentWithClaim | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INITIAL_FORM_DATA: ClaimFormData = {
  patient_first_name: '',
  patient_last_name: '',
  patient_dob: '',
  patient_gender: 'U',
  patient_address_street: '',
  patient_address_city: '',
  patient_address_state: '',
  patient_address_zip: '',
  payer_id: '',
  member_id: '',
  group_number: '',
  subscriber_name: '',
  subscriber_dob: '',
  subscriber_relationship: 'self',
  diagnosis_codes: [{ code: '', description: '', isPrimary: true }],
  service_lines: [],
  rendering_provider_npi: '',
};

export function ClaimModal({ isOpen, appointment, onClose, onSuccess }: ClaimModalProps) {
  const [formData, setFormData] = useState<ClaimFormData>(INITIAL_FORM_DATA);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // V2: Auto-population state
  const [autoPopulatedFields, setAutoPopulatedFields] = useState<AutoPopulatedFields>(INITIAL_AUTO_POPULATED);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [payerMatchInfo, setPayerMatchInfo] = useState<{
    matched: boolean;
    confidence: string;
    intakeqCarrier: string | null;
    matchedPayer: string | null;
  } | null>(null);

  // Draft state
  const [hasDraft, setHasDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Fetch payers and providers on mount
  useEffect(() => {
    fetchPayers();
    fetchProviders();
  }, []);

  // V2: Fetch client data for auto-population
  const fetchClientData = useCallback(async (clientId: number, appointmentId: string) => {
    setIsLoadingClient(true);
    setPayerMatchInfo(null);

    try {
      const response = await fetch(`/api/clients/${clientId}`);
      const data = await response.json();

      if (data.success && data.data) {
        const { autoPopulatedData, autoPopulatedFields: fields, payerMatch } = data.data;

        // Merge auto-populated data with current form data (preserving service_lines)
        setFormData((prev) => {
          const newFormData = {
            ...prev,
            ...autoPopulatedData,
          };

          // Auto-save draft after populating from IntakeQ
          saveDraft(appointmentId, newFormData);

          return newFormData;
        });

        setAutoPopulatedFields(fields);
        setPayerMatchInfo(payerMatch);

        console.log('[ClaimModal] Auto-populated fields:', Object.entries(fields).filter(([, v]) => v).map(([k]) => k));
      }
    } catch (err) {
      console.error('[ClaimModal] Failed to fetch client data:', err);
      // Fail silently - fall back to manual entry
    } finally {
      setIsLoadingClient(false);
    }
  }, []);

  // Check for existing draft
  const checkForDraft = useCallback(async (appointmentId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/claims/draft?appointment_id=${appointmentId}`);
      const data = await response.json();

      if (data.success && data.data) {
        // Load draft data into form
        const draft = data.data;
        setFormData({
          patient_first_name: draft.patient_first_name || '',
          patient_last_name: draft.patient_last_name || '',
          patient_dob: draft.patient_dob || '',
          patient_gender: draft.patient_gender || 'U',
          patient_address_street: draft.patient_address_street || '',
          patient_address_city: draft.patient_address_city || '',
          patient_address_state: draft.patient_address_state || '',
          patient_address_zip: draft.patient_address_zip || '',
          payer_id: draft.payer_id || '',
          member_id: draft.member_id || '',
          group_number: draft.group_number || '',
          subscriber_name: draft.subscriber_name || '',
          subscriber_dob: draft.subscriber_dob || '',
          subscriber_relationship: draft.subscriber_relationship || 'self',
          diagnosis_codes: draft.diagnosis_codes?.length > 0
            ? draft.diagnosis_codes
            : [{ code: '', description: '', isPrimary: true }],
          service_lines: draft.service_lines?.length > 0
            ? draft.service_lines
            : [],
          rendering_provider_npi: draft.rendering_provider_npi || '',
        });
        setHasDraft(true);
        setLastSaved(new Date(draft.updated_at));
        console.log('[ClaimModal] Loaded existing draft');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[ClaimModal] Failed to check for draft:', err);
      return false;
    }
  }, []);

  // Save draft
  const saveDraft = useCallback(async (appointmentId: string, data: ClaimFormData) => {
    setIsSavingDraft(true);
    try {
      const response = await fetch('/api/claims/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intakeq_appointment_id: appointmentId,
          ...data,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setHasDraft(true);
        setLastSaved(new Date());
        console.log('[ClaimModal] Draft saved');
      }
    } catch (err) {
      console.error('[ClaimModal] Failed to save draft:', err);
    } finally {
      setIsSavingDraft(false);
    }
  }, []);

  // Refresh from IntakeQ (force re-sync)
  const refreshFromIntakeQ = useCallback(async () => {
    if (!appointment) return;
    setHasDraft(false);
    setAutoPopulatedFields(INITIAL_AUTO_POPULATED);
    if (appointment.ClientId) {
      await fetchClientData(appointment.ClientId, appointment.Id);
    }
  }, [appointment, fetchClientData]);

  // Manual save draft button handler
  const handleSaveDraft = useCallback(() => {
    if (appointment) {
      saveDraft(appointment.Id, formData);
    }
  }, [appointment, formData, saveDraft]);

  // Debounced auto-save when form changes
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // Only auto-save if we have an appointment and have already loaded data
    if (!appointment || !hasDraft) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(appointment.Id, formData);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, appointment, hasDraft, saveDraft]);

  // Reset initial load flag when appointment changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [appointment?.Id]);

  // Pre-populate form when appointment changes
  useEffect(() => {
    if (appointment) {
      // Reset state
      setAutoPopulatedFields(INITIAL_AUTO_POPULATED);
      setPayerMatchInfo(null);
      setError(null);
      setSuccessMessage(null);
      setHasDraft(false);
      setLastSaved(null);

      // Start with basic data from appointment
      const nameParts = appointment.ClientName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const dos = format(new Date(appointment.StartDateIso), 'yyyy-MM-dd');

      const initialFormData: ClaimFormData = {
        ...INITIAL_FORM_DATA,
        patient_first_name: firstName,
        patient_last_name: lastName,
        patient_dob: appointment.ClientDateOfBirth || '',
        service_lines: [{
          dos,
          cpt: '',
          units: 1,
          charge: appointment.Price / 100, // IntakeQ stores in cents
          diagnosis_pointers: [1],
        }],
      };

      // Check for existing draft first, then fall back to IntakeQ
      const loadData = async () => {
        const hasDraft = await checkForDraft(appointment.Id);
        if (!hasDraft) {
          // No draft found - set initial form data and fetch from IntakeQ
          setFormData(initialFormData);
          if (appointment.ClientId) {
            fetchClientData(appointment.ClientId, appointment.Id);
          }
        }
      };

      loadData();
    }
  }, [appointment, fetchClientData, checkForDraft]);

  const fetchPayers = async () => {
    try {
      const response = await fetch('/api/payers');
      const data = await response.json();
      if (data.data) {
        setPayers(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch payers:', err);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      if (data.data) {
        setProviders(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  };

  const handleInputChange = (field: keyof ClaimFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // V2: Mark field as no longer auto-populated if user edits it
    if (autoPopulatedFields[field as keyof AutoPopulatedFields]) {
      setAutoPopulatedFields((prev) => ({
        ...prev,
        [field]: false,
      }));
    }
  };

  const handleDiagnosisChange = (index: number, field: keyof DiagnosisCode, value: string | boolean) => {
    setFormData((prev) => {
      const newDiagnoses = [...prev.diagnosis_codes];
      newDiagnoses[index] = { ...newDiagnoses[index], [field]: value };
      return { ...prev, diagnosis_codes: newDiagnoses };
    });
  };

  const addDiagnosis = () => {
    setFormData((prev) => ({
      ...prev,
      diagnosis_codes: [...prev.diagnosis_codes, { code: '', description: '', isPrimary: false }],
    }));
  };

  const removeDiagnosis = (index: number) => {
    if (formData.diagnosis_codes.length > 1) {
      setFormData((prev) => ({
        ...prev,
        diagnosis_codes: prev.diagnosis_codes.filter((_, i) => i !== index),
      }));
    }
  };

  const handleServiceLineChange = (index: number, field: keyof ServiceLine, value: string | number | number[]) => {
    setFormData((prev) => {
      const newLines = [...prev.service_lines];
      newLines[index] = { ...newLines[index], [field]: value };
      return { ...prev, service_lines: newLines };
    });
  };

  const addServiceLine = () => {
    const dos = appointment ? format(new Date(appointment.StartDateIso), 'yyyy-MM-dd') : '';
    setFormData((prev) => ({
      ...prev,
      service_lines: [...prev.service_lines, { dos, cpt: '', units: 1, charge: 0, diagnosis_pointers: [1] }],
    }));
  };

  const removeServiceLine = (index: number) => {
    if (formData.service_lines.length > 1) {
      setFormData((prev) => ({
        ...prev,
        service_lines: prev.service_lines.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          intakeq_appointment_id: appointment.Id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`Claim submitted successfully! File: ${result.filename}`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit claim');
      }
    } catch (err) {
      setError('Failed to submit claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Create CMS-1500 Claim</h2>
              {hasDraft && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  {isSavingDraft ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
                      Saving...
                    </>
                  ) : lastSaved ? (
                    <>
                      <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Draft saved
                    </>
                  ) : null}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {hasDraft && (
                <button
                  type="button"
                  onClick={refreshFromIntakeQ}
                  disabled={isLoadingClient}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 flex items-center gap-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh from IntakeQ
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {/* V2: Loading Client Data Banner */}
          {isLoadingClient && (
            <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3" />
              <span className="text-sm text-blue-700">Loading patient data from IntakeQ...</span>
            </div>
          )}

          {/* Draft Loaded Banner */}
          {hasDraft && !isLoadingClient && (
            <div className="mx-6 mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-600">
                  Loaded from saved draft.{' '}
                  <button
                    type="button"
                    onClick={refreshFromIntakeQ}
                    className="text-blue-600 hover:underline"
                  >
                    Refresh from IntakeQ
                  </button>
                  {' '}to get latest patient data.
                </span>
              </div>
            </div>
          )}

          {/* V2: Payer Match Warning Banner */}
          {payerMatchInfo && !payerMatchInfo.matched && payerMatchInfo.intakeqCarrier && (
            <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Insurance payer not matched</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    IntakeQ insurance: <strong>{payerMatchInfo.intakeqCarrier}</strong>
                  </p>
                  <p className="text-sm text-yellow-700">
                    Please select the correct payer from the dropdown below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* V2: Auto-population Success Banner */}
          {payerMatchInfo?.matched && !isLoadingClient && (
            <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center">
              <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">
                Patient data auto-populated from IntakeQ. Fields with green borders were filled automatically.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Patient Information Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                    {autoPopulatedFields.patient_first_name && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.patient_first_name}
                    onChange={(e) => handleInputChange('patient_first_name', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.patient_first_name ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                    {autoPopulatedFields.patient_last_name && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.patient_last_name}
                    onChange={(e) => handleInputChange('patient_last_name', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.patient_last_name ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth *
                    {autoPopulatedFields.patient_dob && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.patient_dob}
                    onChange={(e) => handleInputChange('patient_dob', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.patient_dob ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                    {autoPopulatedFields.patient_gender && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <select
                    value={formData.patient_gender}
                    onChange={(e) => handleInputChange('patient_gender', e.target.value as 'M' | 'F' | 'U')}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.patient_gender ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="U">Unknown</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                    {autoPopulatedFields.patient_address_street && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.patient_address_street}
                    onChange={(e) => handleInputChange('patient_address_street', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.patient_address_street ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                    {autoPopulatedFields.patient_address_city && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.patient_address_city}
                    onChange={(e) => handleInputChange('patient_address_city', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.patient_address_city ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                      {autoPopulatedFields.patient_address_state && <span className="ml-1 text-xs text-green-600">Auto</span>}
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.patient_address_state}
                      onChange={(e) => handleInputChange('patient_address_state', e.target.value.toUpperCase())}
                      className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                        autoPopulatedFields.patient_address_state ? 'border-green-300 bg-green-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP
                      {autoPopulatedFields.patient_address_zip && <span className="ml-1 text-xs text-green-600">Auto</span>}
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.patient_address_zip}
                      onChange={(e) => handleInputChange('patient_address_zip', e.target.value)}
                      className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                        autoPopulatedFields.patient_address_zip ? 'border-green-300 bg-green-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Insurance Information Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Insurance Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payer *
                    {autoPopulatedFields.payer_id && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <select
                    required
                    value={formData.payer_id}
                    onChange={(e) => handleInputChange('payer_id', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.payer_id ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Payer...</option>
                    {payers.map((payer) => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Member ID *
                    {autoPopulatedFields.member_id && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.member_id}
                    onChange={(e) => handleInputChange('member_id', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.member_id ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Number
                    {autoPopulatedFields.group_number && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.group_number || ''}
                    onChange={(e) => handleInputChange('group_number', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.group_number ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscriber Relationship
                    {autoPopulatedFields.subscriber_relationship && <span className="ml-1 text-xs text-green-600">Auto</span>}
                  </label>
                  <select
                    value={formData.subscriber_relationship}
                    onChange={(e) => handleInputChange('subscriber_relationship', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                      autoPopulatedFields.subscriber_relationship ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="self">Self</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Diagnosis Codes Section */}
            <section>
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <h3 className="text-lg font-medium text-gray-900">Diagnosis Codes (ICD-10)</h3>
                <button
                  type="button"
                  onClick={addDiagnosis}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Diagnosis
                </button>
              </div>
              <div className="space-y-3">
                {formData.diagnosis_codes.map((dx, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                    <input
                      type="text"
                      placeholder="F41.1"
                      value={dx.code}
                      onChange={(e) => handleDiagnosisChange(index, 'code', e.target.value.toUpperCase())}
                      className="w-24 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={dx.description || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'description', e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={dx.isPrimary}
                        onChange={(e) => handleDiagnosisChange(index, 'isPrimary', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Primary
                    </label>
                    {formData.diagnosis_codes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDiagnosis(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Service Lines Section */}
            <section>
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <h3 className="text-lg font-medium text-gray-900">Service Lines (CPT)</h3>
                <button
                  type="button"
                  onClick={addServiceLine}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Service Line
                </button>
              </div>
              <div className="space-y-3">
                {formData.service_lines.map((line, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                    <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date of Service</label>
                      <input
                        type="date"
                        value={line.dos}
                        onChange={(e) => handleServiceLineChange(index, 'dos', e.target.value)}
                        className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">CPT Code</label>
                      <input
                        type="text"
                        placeholder="99214"
                        value={line.cpt}
                        onChange={(e) => handleServiceLineChange(index, 'cpt', e.target.value)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Modifier</label>
                      <input
                        type="text"
                        placeholder="95"
                        value={line.modifier || ''}
                        onChange={(e) => handleServiceLineChange(index, 'modifier', e.target.value)}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Units</label>
                      <input
                        type="number"
                        min="1"
                        value={line.units}
                        onChange={(e) => handleServiceLineChange(index, 'units', parseInt(e.target.value) || 1)}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Charge ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.charge}
                        onChange={(e) => handleServiceLineChange(index, 'charge', parseFloat(e.target.value) || 0)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    {formData.service_lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeServiceLine(index)}
                        className="text-red-500 hover:text-red-700 mt-4"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Provider Information Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Provider Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rendering Provider *</label>
                  <select
                    required
                    value={formData.rendering_provider_npi}
                    onChange={(e) => handleInputChange('rendering_provider_npi', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.npi}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  {formData.rendering_provider_npi && (
                    <p className="text-xs text-gray-500 mt-1">
                      NPI: {formData.rendering_provider_npi}
                      {providers.find(p => p.npi === formData.rendering_provider_npi) && (
                        <span className="ml-2 text-gray-400">
                          ({providers.find(p => p.npi === formData.rendering_provider_npi)?.name})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Provider NPI</label>
                  <input
                    type="text"
                    disabled
                    value="1275348807"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Moonlit PLLC (Type 2)</p>
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex justify-between items-center pt-6 border-t">
              <div className="text-xs text-gray-400">
                {hasDraft && lastSaved && (
                  <>Last saved: {lastSaved.toLocaleTimeString()}</>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
