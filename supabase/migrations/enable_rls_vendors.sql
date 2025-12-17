-- Enable RLS on public.vendors and add safe policies
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'vendors' 
      AND policyname = 'public_vendors_read'
  ) THEN
    CREATE POLICY public_vendors_read
    ON public.vendors
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'vendors' 
      AND policyname = 'vendors_write_service_only'
  ) THEN
    -- Write operations are performed by backend using service role; keep client writes blocked
    CREATE POLICY vendors_write_service_only
    ON public.vendors
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

    CREATE POLICY vendors_update_service_only
    ON public.vendors
    FOR UPDATE
    TO authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;
