/*
# Many-to-many relationships: courses <-> labs, courses <-> assignments

## Summary
Converts course-lab and course-assignment relationships from one-to-one
(single course_id column) to many-to-many (junction tables). A lab or assignment
can now be associated with multiple courses, and vice versa. Students only see
labs and assignments linked to courses they are enrolled in.

## Changes
1. Migrate existing labs.course_id data into course_labs junction
2. Create course_assignments junction table + RLS
3. Migrate existing assignments.course_id data into course_assignments
4. Drop all RLS policies that reference labs.course_id or assignments.course_id
5. Drop the course_id columns from labs and assignments
6. Recreate RLS policies with enrollment-based filtering via junction tables
*/

-- Step 1: Migrate existing labs.course_id into course_labs
INSERT INTO course_labs (course_id, lab_id, sort_order)
SELECT l.course_id, l.id, 0
FROM labs l
WHERE l.course_id IS NOT NULL
ON CONFLICT (course_id, lab_id) DO NOTHING;

-- Step 2: Create course_assignments junction table
CREATE TABLE IF NOT EXISTS course_assignments (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, assignment_id)
);

-- Step 3: Migrate existing assignments.course_id into course_assignments
INSERT INTO course_assignments (course_id, assignment_id, sort_order)
SELECT a.course_id, a.id, 0
FROM assignments a
WHERE a.course_id IS NOT NULL
ON CONFLICT (course_id, assignment_id) DO NOTHING;

-- Step 4: Enable RLS on course_assignments
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop ALL policies that reference course_id on labs or assignments
-- This must happen BEFORE dropping the columns
DROP POLICY IF EXISTS "labs_select" ON labs;
DROP POLICY IF EXISTS "assignments_select" ON assignments;
DROP POLICY IF EXISTS "assignments_insert" ON assignments;
DROP POLICY IF EXISTS "assignment_labs_select" ON assignment_labs;
DROP POLICY IF EXISTS "questions_select" ON assignment_questions;
DROP POLICY IF EXISTS "gmodules_select" ON guided_modules;
DROP POLICY IF EXISTS "gsteps_select" ON guided_steps;

-- Step 6: Drop the course_id columns
ALTER TABLE labs DROP COLUMN IF EXISTS course_id;
ALTER TABLE assignments DROP COLUMN IF EXISTS course_id;

-- Step 7: Recreate RLS policies

-- labs: students see active labs linked to enrolled courses; formateurs/admins see their own
CREATE POLICY "labs_select" ON labs FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (
      status = 'active'
      AND EXISTS (
        SELECT 1
        FROM course_labs cl
        JOIN course_enrollments ce ON ce.course_id = cl.course_id
        WHERE cl.lab_id = labs.id AND ce.student_id = auth.uid()
      )
    )
  );

-- assignments: students see published assignments linked to enrolled courses
CREATE POLICY "assignments_select" ON assignments FOR SELECT
  TO authenticated USING (
    created_by = auth.uid()
    OR is_staff()
    OR (
      is_published = true
      AND EXISTS (
        SELECT 1
        FROM course_assignments ca
        JOIN course_enrollments ce ON ce.course_id = ca.course_id
        WHERE ca.assignment_id = assignments.id AND ce.student_id = auth.uid()
      )
    )
  );

-- assignments insert: formateurs can create (ownership via created_by)
CREATE POLICY "assignments_insert" ON assignments FOR INSERT
  TO authenticated WITH CHECK (
    created_by = auth.uid() OR is_staff()
  );

-- labs insert: formateurs can create labs
DROP POLICY IF EXISTS "labs_insert" ON labs;
CREATE POLICY "labs_insert" ON labs FOR INSERT
  TO authenticated WITH CHECK (
    created_by = auth.uid() OR is_staff()
  );

-- course_assignments policies (mirror course_labs)
DROP POLICY IF EXISTS "course_assignments_select" ON course_assignments;
CREATE POLICY "course_assignments_select" ON course_assignments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_assignments.course_id
      AND (c.formateur_id = auth.uid() OR c.is_published = true OR is_staff())
    )
    OR is_enrolled(course_assignments.course_id)
  );

DROP POLICY IF EXISTS "course_assignments_insert" ON course_assignments;
CREATE POLICY "course_assignments_insert" ON course_assignments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_assignments.course_id
      AND (c.formateur_id = auth.uid() OR is_staff())
    )
  );

DROP POLICY IF EXISTS "course_assignments_delete" ON course_assignments;
CREATE POLICY "course_assignments_delete" ON course_assignments FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_assignments.course_id
      AND (c.formateur_id = auth.uid() OR is_staff())
    )
  );

-- Recreate assignment_labs_select without course_id reference
CREATE POLICY "assignment_labs_select" ON assignment_labs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_labs.assignment_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
    OR EXISTS (
      SELECT 1
      FROM course_assignments ca
      JOIN course_enrollments ce ON ce.course_id = ca.course_id
      WHERE ca.assignment_id = assignment_labs.assignment_id AND ce.student_id = auth.uid()
    )
  );

-- Recreate questions_select without course_id reference
CREATE POLICY "questions_select" ON assignment_questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_questions.assignment_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
    OR EXISTS (
      SELECT 1
      FROM course_assignments ca
      JOIN course_enrollments ce ON ce.course_id = ca.course_id
      WHERE ca.assignment_id = assignment_questions.assignment_id AND ce.student_id = auth.uid()
    )
  );

-- Recreate gmodules_select without course_id reference
CREATE POLICY "gmodules_select" ON guided_modules FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = guided_modules.assignment_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
    OR EXISTS (
      SELECT 1
      FROM course_assignments ca
      JOIN course_enrollments ce ON ce.course_id = ca.course_id
      WHERE ca.assignment_id = guided_modules.assignment_id AND ce.student_id = auth.uid()
    )
  );

-- Recreate gsteps_select without course_id reference
CREATE POLICY "gsteps_select" ON guided_steps FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guided_modules gm
      JOIN assignments a ON a.id = gm.assignment_id
      WHERE gm.id = guided_steps.module_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
    OR EXISTS (
      SELECT 1
      FROM guided_modules gm
      JOIN course_assignments ca ON ca.assignment_id = gm.assignment_id
      JOIN course_enrollments ce ON ce.course_id = ca.course_id
      WHERE gm.id = guided_steps.module_id AND ce.student_id = auth.uid()
    )
  );
