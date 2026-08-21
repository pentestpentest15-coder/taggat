/*
# Guided Exercises for Assignments

Adds a new exercise type alongside MCQ: step-by-step guided exercises
where the student enters free-text answers that must match expected answers.

## Structure
- `guided_modules` — a module within an assignment (e.g. "Module 1: Découverte réseau")
- `guided_steps` — ordered steps within a module, each with an expected answer

## Grading
- A SECURITY DEFINER function `submit_guided` grades each step by comparing
  the student's answer to the expected answer (case-insensitive, trimmed).
- Results stored in `assignment_submissions` (reuses existing table) and
  `guided_step_answers` (per-step answers).

## RLS
- Modules/steps: staff CRUD, enrolled students SELECT (published only)
- Step answers: students SELECT/INSERT own, staff SELECT all
*/

-- ============================================================
-- guided_modules
-- ============================================================
CREATE TABLE IF NOT EXISTS guided_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guided_modules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guided_modules_assignment ON guided_modules(assignment_id);

DROP POLICY IF EXISTS "gmodules_select" ON guided_modules;
CREATE POLICY "gmodules_select" ON guided_modules FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = guided_modules.assignment_id
      AND (
        a.created_by = auth.uid()
        OR is_staff()
        OR (a.is_published = true AND is_enrolled(a.course_id))
      )
    )
  );

DROP POLICY IF EXISTS "gmodules_insert" ON guided_modules;
CREATE POLICY "gmodules_insert" ON guided_modules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = guided_modules.assignment_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
  );

DROP POLICY IF EXISTS "gmodules_update" ON guided_modules;
CREATE POLICY "gmodules_update" ON guided_modules FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = guided_modules.assignment_id AND (a.created_by = auth.uid() OR is_staff()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = guided_modules.assignment_id AND (a.created_by = auth.uid() OR is_staff()))
  );

DROP POLICY IF EXISTS "gmodules_delete" ON guided_modules;
CREATE POLICY "gmodules_delete" ON guided_modules FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = guided_modules.assignment_id AND (a.created_by = auth.uid() OR is_staff()))
  );

-- ============================================================
-- guided_steps
-- ============================================================
CREATE TABLE IF NOT EXISTS guided_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES guided_modules(id) ON DELETE CASCADE,
  step_number int NOT NULL DEFAULT 1,
  instruction text NOT NULL,
  expected_answer text NOT NULL,
  hint text,
  points int NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guided_steps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guided_steps_module ON guided_steps(module_id);

DROP POLICY IF EXISTS "gsteps_select" ON guided_steps;
CREATE POLICY "gsteps_select" ON guided_steps FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guided_modules gm
      JOIN assignments a ON a.id = gm.assignment_id
      WHERE gm.id = guided_steps.module_id
      AND (
        a.created_by = auth.uid()
        OR is_staff()
        OR (a.is_published = true AND is_enrolled(a.course_id))
      )
    )
  );

DROP POLICY IF EXISTS "gsteps_insert" ON guided_steps;
CREATE POLICY "gsteps_insert" ON guided_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM guided_modules gm
      JOIN assignments a ON a.id = gm.assignment_id
      WHERE gm.id = guided_steps.module_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
  );

DROP POLICY IF EXISTS "gsteps_update" ON guided_steps;
CREATE POLICY "gsteps_update" ON guided_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guided_modules gm
      JOIN assignments a ON a.id = gm.assignment_id
      WHERE gm.id = guided_steps.module_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM guided_modules gm
      JOIN assignments a ON a.id = gm.assignment_id
      WHERE gm.id = guided_steps.module_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
  );

DROP POLICY IF EXISTS "gsteps_delete" ON guided_steps;
CREATE POLICY "gsteps_delete" ON guided_steps FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guided_modules gm
      JOIN assignments a ON a.id = gm.assignment_id
      WHERE gm.id = guided_steps.module_id
      AND (a.created_by = auth.uid() OR is_staff())
    )
  );

-- ============================================================
-- guided_step_answers (student answers per step)
-- ============================================================
CREATE TABLE IF NOT EXISTS guided_step_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES guided_steps(id) ON DELETE CASCADE,
  submitted_value text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  points_awarded int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (submission_id, step_id)
);

ALTER TABLE guided_step_answers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gstep_answers_submission ON guided_step_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_gstep_answers_step ON guided_step_answers(step_id);

DROP POLICY IF EXISTS "gstep_answers_select" ON guided_step_answers;
CREATE POLICY "gstep_answers_select" ON guided_step_answers FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions s
      WHERE s.id = guided_step_answers.submission_id
      AND (
        s.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.id = s.assignment_id
          AND (a.created_by = auth.uid() OR is_staff())
        )
      )
    )
  );

DROP POLICY IF EXISTS "gstep_answers_insert" ON guided_step_answers;
CREATE POLICY "gstep_answers_insert" ON guided_step_answers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignment_submissions s
      WHERE s.id = guided_step_answers.submission_id
      AND s.student_id = auth.uid()
    )
  );

-- ============================================================
-- submit_guided (SECURITY DEFINER — grades guided exercises)
-- ============================================================
-- Accepts p_answers as jsonb array of {step_id, submitted_value}
-- Grades each step by case-insensitive trimmed comparison to expected_answer
-- Reuses assignment_submissions for the score record
CREATE OR REPLACE FUNCTION submit_guided(p_assignment_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission record;
  v_score int := 0;
  v_max_score int := 0;
  v_answer jsonb;
  v_step guided_steps%ROWTYPE;
  v_is_correct boolean;
  v_points int;
  v_existing_submission assignment_submissions%ROWTYPE;
BEGIN
  -- Verify enrollment
  IF NOT EXISTS (
    SELECT 1 FROM assignments a
    JOIN course_enrollments ce ON ce.course_id = a.course_id
    WHERE a.id = p_assignment_id AND ce.student_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous n''êtes pas inscrit à ce cours');
  END IF;

  -- Check for existing submission
  SELECT * INTO v_existing_submission
    FROM assignment_submissions
    WHERE assignment_id = p_assignment_id AND student_id = auth.uid();

  -- Compute score
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    SELECT * INTO v_step FROM guided_steps
      WHERE id = (v_answer->>'step_id')::uuid
      AND module_id IN (SELECT id FROM guided_modules WHERE assignment_id = p_assignment_id);

    IF NOT FOUND THEN CONTINUE; END IF;

    v_max_score := v_max_score + v_step.points;
    v_is_correct := (trim(lower(v_answer->>'submitted_value')) = trim(lower(v_step.expected_answer)));

    IF v_is_correct THEN
      v_score := v_score + v_step.points;
    END IF;
  END LOOP;

  -- Upsert submission
  IF v_existing_submission IS NOT NULL THEN
    DELETE FROM guided_step_answers WHERE submission_id = v_existing_submission.id;
    UPDATE assignment_submissions
      SET score = v_score, max_score = v_max_score, submitted_at = now()
      WHERE id = v_existing_submission.id;
    v_submission := v_existing_submission;
  ELSE
    INSERT INTO assignment_submissions (assignment_id, student_id, score, max_score, submitted_at)
      VALUES (p_assignment_id, auth.uid(), v_score, v_max_score, now())
      RETURNING * INTO v_submission;
  END IF;

  -- Insert step answers
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    SELECT * INTO v_step FROM guided_steps
      WHERE id = (v_answer->>'step_id')::uuid
      AND module_id IN (SELECT id FROM guided_modules WHERE assignment_id = p_assignment_id);

    IF NOT FOUND THEN CONTINUE; END IF;

    v_is_correct := (trim(lower(v_answer->>'submitted_value')) = trim(lower(v_step.expected_answer)));
    v_points := CASE WHEN v_is_correct THEN v_step.points ELSE 0 END;

    INSERT INTO guided_step_answers (submission_id, step_id, submitted_value, is_correct, points_awarded)
      VALUES (v_submission.id, v_step.id, v_answer->>'submitted_value', v_is_correct, v_points)
      ON CONFLICT (submission_id, step_id) DO UPDATE
        SET submitted_value = EXCLUDED.submitted_value,
            is_correct = EXCLUDED.is_correct,
            points_awarded = EXCLUDED.points_awarded;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'max_score', v_max_score,
    'submission_id', v_submission.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_guided(uuid, jsonb) TO authenticated;
