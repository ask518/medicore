// ============================================================================
// MEDICORE – Managed Supabase Client with Seamless In-Memory Fallback
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '../config/appConfig';

let client: SupabaseClient | null = null;

if (APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey) {
  try {
    client = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
    console.info('MEDICORE: Connected to managed Supabase cloud instance.');
  } catch (err) {
    console.warn('MEDICORE: Supabase initialization error, falling back to local multi-tenant store:', err);
    client = null;
  }
} else {
  console.info('MEDICORE: Running in high-performance local multi-tenant store mode. Configure .env with Supabase credentials for cloud sync.');
}

export const supabase = client;
export const isSupabaseConfigured = Boolean(client);
