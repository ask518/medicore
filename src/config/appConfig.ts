// ============================================================================
// MEDICORE – Application Configuration & Multi-Tenant Deployment Profiles
// ============================================================================

export type DeploymentProfile = 'saas' | 'enterprise';

export interface AppConfig {
  deploymentProfile: DeploymentProfile;
  appName: string;
  defaultLocale: 'ar' | 'en';
  defaultCurrency: string;
  defaultCurrencySymbol: string;
  isEnterpriseMode: boolean;
  enterpriseOrgName?: string;
  enterpriseLogoUrl?: string;
  enableAiAssistant: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const env = (import.meta as unknown as { env: Record<string, string> }).env || {};

const profile = (env.VITE_DEPLOYMENT_PROFILE || 'saas').toLowerCase() as DeploymentProfile;

export const APP_CONFIG: AppConfig = {
  deploymentProfile: profile,
  appName: env.VITE_APP_NAME || 'MEDICORE',
  defaultLocale: (env.VITE_DEFAULT_LOCALE === 'en' ? 'en' : 'ar'),
  defaultCurrency: env.VITE_CURRENCY_CODE || 'EGP',
  defaultCurrencySymbol: env.VITE_CURRENCY_SYMBOL || 'ج.م',
  isEnterpriseMode: profile === 'enterprise',
  enterpriseOrgName: env.VITE_ENTERPRISE_ORG_NAME || '',
  enterpriseLogoUrl: env.VITE_ENTERPRISE_LOGO_URL || '/favicon.svg',
  enableAiAssistant: env.VITE_ENABLE_AI_ASSISTANT === 'true',
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
};
