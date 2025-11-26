/**
 * Claim Modal Component
 * CMS-1500 form for manual claim data entry
 */

'use client';

import { useState, useEffect } from 'react';
import type { AppointmentWithClaim, Payer, ClaimFormData, DiagnosisCode, ServiceLine } from '@/types';
import { format } from 'date-fns';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch payers on mount
  useEffect(() => {
    fetchPayers();
  }, []);

  // Pre-populate form when appointment changes
  useEffect(() => {
    if (appointment) {
      const nameParts = appointment.ClientName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const dos = format(new Date(appointment.StartDateIso), 'yyyy-MM-dd');

      setFormData({
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
      });
      setError(null);
      setSuccessMessage(null);
    }
  }, [appointment]);

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

  const handleInputChange = (field: keyof ClaimFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
            <h2 className="text-xl font-semibold text-gray-900">Create CMS-1500 Claim</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Patient Information Section */}
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_first_name}
                    onChange={(e) => handleInputChange('patient_first_name', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_last_name}
                    onChange={(e) => handleInputChange('patient_last_name', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={formData.patient_dob}
                    onChange={(e) => handleInputChange('patient_dob', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={formData.patient_gender}
                    onChange={(e) => handleInputChange('patient_gender', e.target.value as 'M' | 'F' | 'U')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="U">Unknown</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.patient_address_street}
                    onChange={(e) => handleInputChange('patient_address_street', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.patient_address_city}
                    onChange={(e) => handleInputChange('patient_address_city', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.patient_address_state}
                      onChange={(e) => handleInputChange('patient_address_state', e.target.value.toUpperCase())}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.patient_address_zip}
                      onChange={(e) => handleInputChange('patient_address_zip', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payer *</label>
                  <select
                    required
                    value={formData.payer_id}
                    onChange={(e) => handleInputChange('payer_id', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.member_id}
                    onChange={(e) => handleInputChange('member_id', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Number</label>
                  <input
                    type="text"
                    value={formData.group_number || ''}
                    onChange={(e) => handleInputChange('group_number', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subscriber Relationship</label>
                  <select
                    value={formData.subscriber_relationship}
                    onChange={(e) => handleInputChange('subscriber_relationship', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rendering Provider NPI *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.rendering_provider_npi}
                    onChange={(e) => handleInputChange('rendering_provider_npi', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="10-digit NPI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Provider NPI</label>
                  <input
                    type="text"
                    disabled
                    value={process.env.NEXT_PUBLIC_BILLING_NPI || 'Configured in .env'}
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
                  />
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
