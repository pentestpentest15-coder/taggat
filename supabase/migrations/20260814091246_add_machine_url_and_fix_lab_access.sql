-- Add machine_url column to labs table
ALTER TABLE labs ADD COLUMN IF NOT EXISTS machine_url text;

-- Update labs_select policy: students can access any active lab
-- (not just those linked to enrolled courses — the formateur publishes labs
--  and students access them directly from the labs catalog)
DROP POLICY IF EXISTS "labs_select" ON labs;
CREATE POLICY "labs_select" ON labs FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR status = 'active'
  );
