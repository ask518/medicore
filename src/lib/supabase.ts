// ============================================================================
// MEDICORE – Supabase client; cloud data is unavailable until configured
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../config/appConfig';

let client: SupabaseClient | null = null;

if (APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey) {
  try {
    client = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
  } catch {
    client = null;
  }
}

export const supabase = client;
export const isSupabaseConfigured = Boolean(client);
