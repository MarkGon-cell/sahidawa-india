-- =============================================================================
-- SahiDawa — Pharmacy Claims & Verification
-- =============================================================================

-- Create claim status enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'pharmacy_claim_status'
    ) THEN
        CREATE TYPE pharmacy_claim_status AS ENUM (
            'pending',
            'approved',
            'rejected'
        );
    END IF;
END
$$;


-- =============================================================================
-- Pharmacy Claims
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    pharmacy_id UUID NOT NULL
        REFERENCES public.pharmacies(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    drug_license_number TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,

    status pharmacy_claim_status NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (pharmacy_id, user_id)
);


-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pharmacy_claims_pharmacy_id
    ON public.pharmacy_claims(pharmacy_id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_claims_user_id
    ON public.pharmacy_claims(user_id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_claims_status
    ON public.pharmacy_claims(status);


-- =============================================================================
-- Ensure pharmacies.is_verified exists
-- =============================================================================

ALTER TABLE public.pharmacies
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;


-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.pharmacy_claims ENABLE ROW LEVEL SECURITY;


-- Pharmacists can submit claims for themselves
CREATE POLICY "Users can submit pharmacy claims"
ON public.pharmacy_claims
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);


-- Pharmacists can view their own claims
CREATE POLICY "Users can view their own pharmacy claims"
ON public.pharmacy_claims
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);


-- =============================================================================
-- Updated-at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_pharmacy_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS pharmacy_claims_updated_at
ON public.pharmacy_claims;


CREATE TRIGGER pharmacy_claims_updated_at
    BEFORE UPDATE ON public.pharmacy_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_claims_updated_at();

-- Administrators and moderators can review all pharmacy claims.
CREATE POLICY "pharmacy_claims_admin_select"
ON public.pharmacy_claims
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = auth.uid()
          AND raw_app_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- Only administrators and moderators can update claim records.
CREATE POLICY "pharmacy_claims_admin_update"
ON public.pharmacy_claims
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = auth.uid()
          AND raw_app_meta_data->>'role' IN ('admin', 'moderator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = auth.uid()
          AND raw_app_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE public.pharmacy_claims IS
    'Pharmacist requests to claim and verify a pharmacy on SahiDawa.';

COMMENT ON COLUMN public.pharmacy_claims.drug_license_number IS
    'Drug license number submitted by the pharmacist for verification.';

COMMENT ON COLUMN public.pharmacies.is_verified IS
    'Whether the pharmacy has been verified by SahiDawa administrators.';