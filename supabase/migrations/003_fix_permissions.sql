-- Fix permissions for Supabase roles
-- Run this in your Supabase SQL Editor to grant proper access

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant all privileges on all tables to service_role (admin access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant select on reference tables to anon (for dropdowns)
GRANT SELECT ON billing_providers TO anon;
GRANT SELECT ON payers TO anon;

-- Grant full access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON edi_response_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON claim_status_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payer_name_mappings TO authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

-- Verify the grants worked by checking permissions
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('billing_providers', 'payers', 'claims')
AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee;
