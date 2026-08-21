-- ============================================================
-- Fix infinite recursion in RLS policies
--
-- Root cause: courses_select references course_enrollments,
-- and enrollments_select references courses → infinite loop.
--
-- Fix: create SECURITY DEFINER helper functions that bypass RLS
-- to check enrollment, then replace all inline subqueries to
-- course_enrollments with calls to these functions.
-- ============================================================

-- ============================================================
-- is_enrolled(p_course_id) — check if current user is enrolled
-- ============================================================
CREATE OR REPLACE FUNCTION is_enrolled(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM course_enrollments
    WHERE course_id = p_course_id AND student_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_enrolled(uuid) TO authenticated;

-- ============================================================
-- has_lab_access(p_lab_id) — check if student can access a lab
-- through enrolled courses or published assignments
-- ============================================================
CREATE OR REPLACE FUNCTION has_lab_access(p_lab_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM course_labs cl
    WHERE cl.lab_id = p_lab_id AND is_enrolled(cl.course_id)
  )
  OR EXISTS (
    SELECT 1 FROM assignment_labs al
    JOIN assignments a ON a.id = al.assignment_id
    WHERE al.lab_id = p_lab_id
      AND a.is_published = true
      AND is_enrolled(a.course_id)
  );
$$;

GRANT EXECUTE ON FUNCTION has_lab_access(uuid) TO authenticated;

-- ============================================================
-- COURSES — replace course_enrollments subquery with is_enrolled()
-- ============================================================
DROP POLICY IF EXISTS "courses_select" ON courses;
CREATE POLICY "courses_select" ON courses FOR SELECT
  TO authenticated USING (
    is_published = true
    OR formateur_id = auth.uid()
    OR is_staff()
    OR is_enrolled(courses.id)
  );

-- ============================================================
-- ASSIGNMENTS — replace course_enrollments subquery with is_enrolled()
-- ============================================================
DROP POLICY IF EXISTS "assignments_select" ON assignments;
CREATE POLICY "assignments_select" ON assignments FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (is_published = true AND is_enrolled(assignments.course_id))
  );

-- ============================================================
-- LABS — replace all course_enrollments subqueries with has_lab_access()
-- ============================================================
DROP POLICY IF EXISTS "labs_select" ON labs;
CREATE POLICY "labs_select" ON labs FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (status = 'active' AND has_lab_access(labs.id))
  );

-- ============================================================
-- COURSE_ENROLLMENTS — replace courses subquery with direct checks
-- ============================================================
DROP POLICY IF EXISTS "enrollments_select" ON course_enrollments;
CREATE POLICY "enrollments_select" ON course_enrollments FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR is_staff()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_enrollments.course_id
      AND c.formateur_id = auth.uid()
    )
  );

-- ============================================================
-- COURSE_LABS — replace course_enrollments subquery with is_enrolled()
-- ============================================================
DROP POLICY IF EXISTS "course_labs_select" ON course_labs;
CREATE POLICY "course_labs_select" ON course_labs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_labs.course_id AND (c.formateur_id = auth.uid() OR c.is_published = true OR is_staff()))
    OR is_enrolled(course_labs.course_id)
  );

-- ============================================================
-- ASSIGNMENT_LABS — replace course_enrollments subquery with is_enrolled()
-- ============================================================
DROP POLICY IF EXISTS "assignment_labs_select" ON assignment_labs;
CREATE POLICY "assignment_labs_select" ON assignment_labs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_labs.assignment_id AND (a.created_by = auth.uid() OR is_staff() OR (a.is_published = true AND is_enrolled(a.course_id))))
  );
