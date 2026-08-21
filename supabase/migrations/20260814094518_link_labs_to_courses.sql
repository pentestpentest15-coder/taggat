/*
# Link labs to courses + restrict student access to enrolled courses

## Changes
1. Add `course_id` column to `labs` table (nullable FK to courses)
2. Update `labs_select` RLS policy so students can only see labs linked to courses they're enrolled in
3. Add index on course_id for faster lookups

## RLS Policy
- Staff/formateur: can see their own labs or all labs (if staff)
- Students: can only see labs where status='active' AND the lab's course_id matches a course the student is enrolled in (enrollment status = 'active')
*/

ALTER TABLE labs ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_labs_course_id ON labs(course_id);

-- Drop old select policy and replace with enrollment-aware one
DROP POLICY IF EXISTS "labs_select" ON labs;

CREATE POLICY "labs_select" ON labs FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (
      status = 'active'
      AND course_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM course_enrollments ce
        WHERE ce.course_id = labs.course_id
        AND ce.student_id = auth.uid()
        AND ce.status = 'active'
      )
    )
  );
