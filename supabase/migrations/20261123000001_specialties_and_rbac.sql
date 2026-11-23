-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 05
-- Production Specialties Taxonomy, Dynamic Subspecialties & RBAC Alignment
-- ============================================================================

-- 1. Add specialties catalog storage to organizations and branches
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '["general_practice", "internal_medicine", "general_surgery"]'::jsonb;

COMMENT ON COLUMN organizations.specialties IS 'Array of specialty codes activated for this healthcare organization / tenant';

ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN branches.specialties IS 'Subset of organization specialty codes offered specifically at this facility branch';

-- 2. Add primary branch linkage to user profiles for RBAC scoping
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 3. Enhance doctors table with comprehensive subspecialties & credentials
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS subspecialty_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS subspecialty_title_ar VARCHAR(255),
ADD COLUMN IF NOT EXISTS subspecialty_title_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS professional_title VARCHAR(100),
ADD COLUMN IF NOT EXISTS qualifications TEXT;

-- 4. Ensure public schema permissions for anon and authenticated API clients
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
