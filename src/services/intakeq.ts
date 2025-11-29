/**
 * IntakeQ API Client
 * Handles fetching appointments and client data from IntakeQ
 *
 * Documentation:
 * - Appointments: https://support.intakeq.com/article/204-intakeq-appointments-api
 * - Clients: https://support.intakeq.com/article/251-intakeq-client-api
 */

import axios, { AxiosInstance } from 'axios';
import type { IntakeQAppointment, IntakeQClient, APIResponse } from '@/types';

class IntakeQService {
  private client: AxiosInstance;

  constructor() {
    const apiKey = process.env.INTAKEQ_API_KEY;

    if (!apiKey) {
      console.warn('INTAKEQ_API_KEY not set - IntakeQ API calls will fail');
    }

    this.client = axios.create({
      baseURL: 'https://intakeq.com/api/v1',
      headers: {
        'X-Auth-Key': apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      console.log(`[IntakeQ] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[IntakeQ] API error:', {
          message: error.message,
          status: error.response?.status,
          url: error.config?.url,
        });
        throw error;
      }
    );
  }

  /**
   * Fetch appointments with optional filters
   */
  async getAppointments(params?: {
    startDate?: string; // ISO 8601 format
    endDate?: string;
    practitionerId?: string;
    clientId?: string;
  }): Promise<APIResponse<IntakeQAppointment[]>> {
    try {
      const response = await this.client.get('/appointments', { params });

      // IntakeQ returns array directly, not nested
      const appointments = Array.isArray(response.data) ? response.data : [];

      console.log(`[IntakeQ] Fetched ${appointments.length} appointments`);

      return {
        success: true,
        data: appointments,
      };
    } catch (error) {
      return this.handleError('Failed to fetch appointments', error);
    }
  }

  /**
   * Fetch single appointment by ID
   */
  async getAppointment(appointmentId: string): Promise<APIResponse<IntakeQAppointment>> {
    try {
      const response = await this.client.get(`/appointments/${appointmentId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError('Failed to fetch appointment', error);
    }
  }

  /**
   * Fetch client by ID with full profile including insurance
   * V2: Used for auto-population of CMS-1500 form
   *
   * API: GET /clients?search={clientId}&includeProfile=true
   * Returns array even for ID search, so we find exact match
   */
  async getClient(clientId: number | string): Promise<APIResponse<IntakeQClient>> {
    try {
      const response = await this.client.get('/clients', {
        params: {
          search: clientId.toString(),
          includeProfile: true,
        },
      });

      // API returns array even for ID search
      const clients = Array.isArray(response.data) ? response.data : [];

      // Find exact match by ClientId
      const client = clients.find(
        (c: IntakeQClient) => c.ClientId.toString() === clientId.toString()
      );

      if (!client) {
        console.log(`[IntakeQ] Client ${clientId} not found (searched ${clients.length} results)`);
        return {
          success: false,
          error: {
            message: 'Client not found',
            code: '404',
            retryable: false,
          },
        };
      }

      console.log(`[IntakeQ] Fetched client ${client.ClientId}: ${client.Name}`);

      return {
        success: true,
        data: client,
      };
    } catch (error) {
      return this.handleError('Failed to fetch client', error);
    }
  }

  /**
   * Generic error handler
   */
  private handleError(message: string, error: unknown): APIResponse<never> {
    const axiosError = error as { response?: { status?: number }; code?: string };
    const isRetryable = (axiosError.response?.status ?? 0) >= 500 || axiosError.code === 'ETIMEDOUT';

    return {
      success: false,
      error: {
        message,
        code: axiosError.response?.status?.toString() || axiosError.code,
        retryable: isRetryable,
      },
    };
  }
}

// Export singleton instance
export const intakeqService = new IntakeQService();
