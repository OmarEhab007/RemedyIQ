-- Idempotent dev tenant for header-auth / ?token=dev (matches frontend defaults).
INSERT INTO tenants (id, clerk_org_id, name, plan, storage_limit_gb)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'dev_local',
    'Local development',
    'free',
    1000
)
ON CONFLICT (clerk_org_id) DO NOTHING;
