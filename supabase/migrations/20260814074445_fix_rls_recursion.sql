/*
# Fix recursive RLS on profiles table

## Problem
The `profiles_select_own_or_staff` policy contains a subquery that reads from `profiles` itself:
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'formateur'))
This causes infinite recursion in PostgreSQL RLS — the subquery triggers the same policy again.
Result: users cannot read their own profile, so login appears to fail (redirects back to auth page).

## Fix
1. Create a SECURITY DEFINER function `is_staff()` that checks the user's role WITHOUT being subject to RLS.
2. Replace all recursive `EXISTS (SELECT 1 FROM profiles ...)` subqueries in RLS policies with calls to `is_staff()`.
3. This breaks the recursion while preserving the same access control logic.
*/

-- ============================================================
-- is_staff() — SECURITY DEFINER helper to avoid RLS recursion
-- ============================================================
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'formateur')
  );
$$;

GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

-- ============================================================
-- PROFILES — fix recursive policy
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id OR is_staff()
  );

-- ============================================================
-- COURSES — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "courses_select" ON courses;
CREATE POLICY "courses_select" ON courses FOR SELECT
  TO authenticated USING (
    is_published = true
    OR formateur_id = auth.uid()
    OR is_staff()
    OR EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = courses.id AND ce.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "courses_insert" ON courses;
CREATE POLICY "courses_insert" ON courses FOR INSERT
  TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "courses_update" ON courses;
CREATE POLICY "courses_update" ON courses FOR UPDATE
  TO authenticated USING (
    formateur_id = auth.uid() OR is_staff()
  ) WITH CHECK (
    formateur_id = auth.uid() OR is_staff()
  );

DROP POLICY IF EXISTS "courses_delete" ON courses;
CREATE POLICY "courses_delete" ON courses FOR DELETE
  TO authenticated USING (
    formateur_id = auth.uid() OR is_staff()
  );

-- ============================================================
-- COURSE_ENROLLMENTS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "enrollments_select" ON course_enrollments;
CREATE POLICY "enrollments_select" ON course_enrollments FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_enrollments.course_id
      AND (c.formateur_id = auth.uid() OR is_staff())
    )
  );

DROP POLICY IF EXISTS "enrollments_insert" ON course_enrollments;
CREATE POLICY "enrollments_insert" ON course_enrollments FOR INSERT
  TO authenticated WITH CHECK (
    student_id = auth.uid() OR is_staff()
  );

DROP POLICY IF EXISTS "enrollments_update" ON course_enrollments;
CREATE POLICY "enrollments_update" ON course_enrollments FOR UPDATE
  TO authenticated USING (
    student_id = auth.uid() OR is_staff()
  ) WITH CHECK (
    student_id = auth.uid() OR is_staff()
  );

DROP POLICY IF EXISTS "enrollments_delete" ON course_enrollments;
CREATE POLICY "enrollments_delete" ON course_enrollments FOR DELETE
  TO authenticated USING (
    student_id = auth.uid() OR is_staff()
  );

-- ============================================================
-- LABS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "labs_select" ON labs;
CREATE POLICY "labs_select" ON labs FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM course_labs cl
        JOIN course_enrollments ce ON ce.course_id = cl.course_id
        WHERE cl.lab_id = labs.id AND ce.student_id = auth.uid()
      )
    )
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1 FROM assignment_labs al
        JOIN assignments a ON a.id = al.assignment_id
        JOIN course_enrollments ce ON ce.course_id = a.course_id
        WHERE al.lab_id = labs.id AND ce.student_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "labs_insert" ON labs;
CREATE POLICY "labs_insert" ON labs FOR INSERT
  TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "labs_update" ON labs;
CREATE POLICY "labs_update" ON labs FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid() OR is_staff()
  ) WITH CHECK (
    created_by = auth.uid() OR is_staff()
  );

DROP POLICY IF EXISTS "labs_delete" ON labs;
CREATE POLICY "labs_delete" ON labs FOR DELETE
  TO authenticated USING (
    created_by = auth.uid() OR is_staff()
  );

-- ============================================================
-- COURSE_LABS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "course_labs_select" ON course_labs;
CREATE POLICY "course_labs_select" ON course_labs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_labs.course_id AND (c.formateur_id = auth.uid() OR c.is_published = true OR is_staff()))
    OR EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = course_labs.course_id AND ce.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "course_labs_insert" ON course_labs;
CREATE POLICY "course_labs_insert" ON course_labs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_labs.course_id AND (c.formateur_id = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "course_labs_delete" ON course_labs;
CREATE POLICY "course_labs_delete" ON course_labs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_labs.course_id AND (c.formateur_id = auth.uid() OR is_staff()))
  );

-- ============================================================
-- ASSIGNMENTS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "assignments_select" ON assignments;
CREATE POLICY "assignments_select" ON assignments FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (
      is_published = true
      AND EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = assignments.course_id AND ce.student_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "assignments_insert" ON assignments;
CREATE POLICY "assignments_insert" ON assignments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = assignments.course_id AND (c.formateur_id = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "assignments_update" ON assignments;
CREATE POLICY "assignments_update" ON assignments FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid() OR is_staff()
  ) WITH CHECK (
    created_by = auth.uid() OR is_staff()
  );

DROP POLICY IF EXISTS "assignments_delete" ON assignments;
CREATE POLICY "assignments_delete" ON assignments FOR DELETE
  TO authenticated USING (
    created_by = auth.uid() OR is_staff()
  );

-- ============================================================
-- ASSIGNMENT_LABS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "assignment_labs_select" ON assignment_labs;
CREATE POLICY "assignment_labs_select" ON assignment_labs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_labs.assignment_id AND (a.created_by = auth.uid() OR is_staff() OR (a.is_published = true AND EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.course_id = a.course_id AND ce.student_id = auth.uid()))))
  );

DROP POLICY IF EXISTS "assignment_labs_insert" ON assignment_labs;
CREATE POLICY "assignment_labs_insert" ON assignment_labs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_labs.assignment_id AND (a.created_by = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "assignment_labs_delete" ON assignment_labs;
CREATE POLICY "assignment_labs_delete" ON assignment_labs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_labs.assignment_id AND (a.created_by = auth.uid() OR is_staff()))
  );

-- ============================================================
-- FLAGS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "flags_select_staff" ON flags;
CREATE POLICY "flags_select_staff" ON flags FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM labs l WHERE l.id = flags.lab_id AND (l.created_by = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "flags_insert" ON flags;
CREATE POLICY "flags_insert" ON flags FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM labs l WHERE l.id = flags.lab_id AND (l.created_by = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "flags_update" ON flags;
CREATE POLICY "flags_update" ON flags FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM labs l WHERE l.id = flags.lab_id AND (l.created_by = auth.uid() OR is_staff()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM labs l WHERE l.id = flags.lab_id AND (l.created_by = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "flags_delete" ON flags;
CREATE POLICY "flags_delete" ON flags FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM labs l WHERE l.id = flags.lab_id AND (l.created_by = auth.uid() OR is_staff()))
  );

-- ============================================================
-- FLAG_SUBMISSIONS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "submissions_select" ON flag_submissions;
CREATE POLICY "submissions_select" ON flag_submissions FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM flags f
      JOIN labs l ON l.id = f.lab_id
      WHERE f.id = flag_submissions.flag_id
      AND (l.created_by = auth.uid() OR is_staff())
    )
  );

-- ============================================================
-- BADGES — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "badges_insert" ON badges;
CREATE POLICY "badges_insert" ON badges FOR INSERT
  TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "badges_update" ON badges;
CREATE POLICY "badges_update" ON badges FOR UPDATE
  TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "badges_delete" ON badges;
CREATE POLICY "badges_delete" ON badges FOR DELETE
  TO authenticated USING (is_staff());

-- ============================================================
-- BADGE_AWARDS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "badge_awards_select" ON badge_awards;
CREATE POLICY "badge_awards_select" ON badge_awards FOR SELECT
  TO authenticated USING (
    student_id = auth.uid() OR is_staff()
  );

DROP POLICY IF EXISTS "badge_awards_insert" ON badge_awards;
CREATE POLICY "badge_awards_insert" ON badge_awards FOR INSERT
  TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "badge_awards_delete" ON badge_awards;
CREATE POLICY "badge_awards_delete" ON badge_awards FOR DELETE
  TO authenticated USING (is_staff());

-- ============================================================
-- ACTIVITY_SESSIONS — fix recursive subquery
-- ============================================================
DROP POLICY IF EXISTS "activity_select" ON activity_sessions;
CREATE POLICY "activity_select" ON activity_sessions FOR SELECT
  TO authenticated USING (
    student_id = auth.uid() OR is_staff()
  );

-- ============================================================
-- PROFILES — admin update (fix recursive subquery)
-- ============================================================
DROP POLICY IF EXISTS "profiles_admin_update_all" ON profiles;
CREATE POLICY "profiles_admin_update_all" ON profiles FOR UPDATE
  TO authenticated USING (is_staff()) WITH CHECK (is_staff());
