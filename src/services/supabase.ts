/**
 * Supabase Client
 * Provides server-side Supabase client for API routes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client for server-side usage (API routes)
 * Lazy initialization to avoid build-time errors
 */
export function getServerSupabase(): SupabaseClient {
  if (_supabaseClient) {
    return _supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase URL and key are required. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in your .env.local file.'
    );
  }

  _supabaseClient = createClient(supabaseUrl, supabaseKey);
  return _supabaseClient;
}
