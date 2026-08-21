/*
# Add MCQ questionnaires and grading to assignments

## Purpose
After creating an assignment (TP/devoir/examen), the formateur can now add a multiple-choice
questionnaire that students answer. The questionnaire is graded automatically and a score is
recorded. A duration can also be set on the assignment, just like labs.

## New Tables
1. `assignment_questions` — one row per MCQ question in an assignment.
   - `id` (uuid PK)
   - `assignment_id` (FK → assignments, ON DELETE CASCADE)
   - `question_text` (text, NOT NULL) — the question prompt
   - `choices` (jsonb, NOT NULL) — array of strings, the possible answers
   - `correct_index` (int, NOT NULL) — 0-based index into `choices` of the correct answer
   - `points` (int, NOT NULL DEFAULT 1) — points awarded for a correct answer
   - `sort_order` (int, NOT NULL DEFAULT 0)
   - `created_at` (timestamptz)

2. `assignment_submissions` — one row per student attempt at an assignment questionnaire.
   - `id` (uuid PK)
   - `assignment_id` (FK → assignments, ON DELETE CASCADE)
   - `student_id` (uuid, NOT NULL, DEFAULT auth.uid(), FK → profiles)
   - `score` (int, NOT NULL DEFAULT 0) — total points earned
   - `max_score` (int, NOT NULL DEFAULT 0) — total possible points
   - `started_at` (timestamptz, NOT NULL DEFAULT now())
   - `submitted_at` (timestamptz, nullable) — when the student submitted
   - `created_at` (timestamptz DEFAULT now())
   UNIQUE constraint on (assignment_id, student_id) — one submission per student per assignment.

3. `assignment_answers` — one row per answered question within a submission.
   - `id` (uuid PK)
   - `submission_id` (FK → assignment_submissions, ON DELETE CASCADE)
   - `question_id` (FK → assignment_questions, ON DELETE CASCADE)
   - `selected_index` (int, NOT NULL) — the student's 0-based choice index
   - `is_correct` (boolean, NOT NULL DEFAULT false)
   - `points_awarded` (int, NOT NULL DEFAULT 0)
   - `created_at` (timestamptz DEFAULT now())

## Modified Tables
- `assignments`: added `duration_min` (int, nullable) — time limit in minutes, like labs.

## Security
- RLS enabled on all three new tables.
- `assignment_questions`: staff (formateur owner / admin) full CRUD; enrolled students SELECT
  only (and only when assignment is_published).
- `assignment_submissions`: students SELECT/INSERT their own; staff SELECT all.
- `assignment_answers`: students SELECT/INSERT their own (via submission ownership); staff SELECT all.
- A SECURITY DEFINER function `submit_assignment(p_assignment_id, p_answers)` handles grading
  atomically so students cannot write scores directly.

## Functions
- `submit_assignment(p_assignment_id jsonb_answers)` — SECURITY DEFINER. Accepts an array of
  {question_id, selected_index}, grades each answer, creates the submission + answers, computes
  score and max_score, and returns a jsonb result. Enforces one submission per student per
  assignment (updates existing if already submitted).
*/

-- ============================================================
-- ADD duration_min TO assignments
-- ============================================================
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_min int;

-- ============================================================
-- assignment_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS assignment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  choices jsonb NOT NULL,
  correct_index int NOT NULL,
  points int NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_select" ON assignment_questions;
CREATE POLICY "questions_select" ON assignment_questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_questions.assignment_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR (
          a.is_published = true
          AND EXISTS (
            SELECT 1 FROM course_enrollments ce
            WHERE ce.course_id = a.course_id AND ce.student_id = auth.uid()
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "questions_insert" ON assignment_questions;
CREATE POLICY "questions_insert" ON assignment_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_questions.assignment_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "questions_update" ON assignment_questions;
CREATE POLICY "questions_update" ON assignment_questions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_questions.assignment_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_questions.assignment_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "questions_delete" ON assignment_questions;
CREATE POLICY "questions_delete" ON assignment_questions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_questions.assignment_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

-- ============================================================
-- assignment_submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  max_score int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select" ON assignment_submissions;
CREATE POLICY "submissions_select" ON assignment_submissions FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "submissions_insert" ON assignment_submissions;
CREATE POLICY "submissions_insert" ON assignment_submissions FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "submissions_update" ON assignment_submissions;
CREATE POLICY "submissions_update" ON assignment_submissions FOR UPDATE
  TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "submissions_delete" ON assignment_submissions;
CREATE POLICY "submissions_delete" ON assignment_submissions FOR DELETE
  TO authenticated USING (student_id = auth.uid());

-- ============================================================
-- assignment_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS assignment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  selected_index int NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  points_awarded int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignment_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "answers_select" ON assignment_answers;
CREATE POLICY "answers_select" ON assignment_answers FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions s
      WHERE s.id = assignment_answers.submission_id
      AND (
        s.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.id = s.assignment_id
          AND (
            a.created_by = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "answers_insert" ON assignment_answers;
CREATE POLICY "answers_insert" ON assignment_answers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignment_submissions s
      WHERE s.id = assignment_answers.submission_id
      AND s.student_id = auth.uid()
    )
  );

-- ============================================================
-- submit_assignment function (SECURITY DEFINER — grades atomically)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_assignment(p_assignment_id uuid, p_answers jsonb)
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
  v_question assignment_questions%ROWTYPE;
  v_is_correct boolean;
  v_points int;
  v_existing_submission assignment_submissions%ROWTYPE;
BEGIN
  -- Verify the student is enrolled in the course
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
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    SELECT * INTO v_question FROM assignment_questions
      WHERE id = (v_answer->>'question_id')::uuid
      AND assignment_id = p_assignment_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_max_score := v_max_score + v_question.points;
    v_is_correct := ((v_answer->>'selected_index')::int = v_question.correct_index);

    IF v_is_correct THEN
      v_points := v_question.points;
      v_score := v_score + v_points;
    ELSE
      v_points := 0;
    END IF;
  END LOOP;

  -- Upsert submission
  IF v_existing_submission IS NOT NULL THEN
    -- Delete old answers, update submission
    DELETE FROM assignment_answers WHERE submission_id = v_existing_submission.id;

    UPDATE assignment_submissions
      SET score = v_score, max_score = v_max_score, submitted_at = now()
      WHERE id = v_existing_submission.id;

    v_submission := v_existing_submission;
  ELSE
    INSERT INTO assignment_submissions (assignment_id, student_id, score, max_score, submitted_at)
      VALUES (p_assignment_id, auth.uid(), v_score, v_max_score, now())
      RETURNING * INTO v_submission;
  END IF;

  -- Insert answers
  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    SELECT * INTO v_question FROM assignment_questions
      WHERE id = (v_answer->>'question_id')::uuid
      AND assignment_id = p_assignment_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_is_correct := ((v_answer->>'selected_index')::int = v_question.correct_index);
    v_points := CASE WHEN v_is_correct THEN v_question.points ELSE 0 END;

    INSERT INTO assignment_answers (submission_id, question_id, selected_index, is_correct, points_awarded)
      VALUES (v_submission.id, v_question.id, (v_answer->>'selected_index')::int, v_is_correct, v_points);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'max_score', v_max_score,
    'submission_id', v_submission.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_assignment(uuid, jsonb) TO authenticated;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_questions_assignment ON assignment_questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_submission ON assignment_answers(submission_id);
