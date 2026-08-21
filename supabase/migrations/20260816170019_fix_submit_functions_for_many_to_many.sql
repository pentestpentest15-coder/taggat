/*
# Fix submit_assignment and submit_guided for many-to-many course relationships

## Summary
The submit_assignment and submit_guided functions previously checked enrollment
by joining assignments.course_id with course_enrollments. Since course_id was dropped
from assignments (replaced by the course_assignments junction table), these functions
must now check enrollment via course_assignments.

## Changes
- submit_assignment: enrollment check now uses course_assignments + course_enrollments
- submit_guided: same enrollment check update
*/

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
  IF NOT EXISTS (
    SELECT 1 FROM course_assignments ca
    JOIN course_enrollments ce ON ce.course_id = ca.course_id
    WHERE ca.assignment_id = p_assignment_id AND ce.student_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous n''êtes pas inscrit à ce cours');
  END IF;

  SELECT * INTO v_existing_submission
  FROM assignment_submissions
  WHERE assignment_id = p_assignment_id AND student_id = auth.uid();

  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    SELECT * INTO v_question FROM assignment_questions
    WHERE id = (v_answer->>'question_id')::uuid AND assignment_id = p_assignment_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_max_score := v_max_score + v_question.points;
    v_is_correct := ((v_answer->>'selected_index')::int = v_question.correct_index);
    IF v_is_correct THEN v_score := v_score + v_question.points; END IF;
  END LOOP;

  IF v_existing_submission IS NOT NULL THEN
    DELETE FROM assignment_answers WHERE submission_id = v_existing_submission.id;
    UPDATE assignment_submissions SET score = v_score, max_score = v_max_score, submitted_at = now() WHERE id = v_existing_submission.id;
    v_submission := v_existing_submission;
  ELSE
    INSERT INTO assignment_submissions (assignment_id, student_id, score, max_score, submitted_at)
    VALUES (p_assignment_id, auth.uid(), v_score, v_max_score, now()) RETURNING * INTO v_submission;
  END IF;

  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    SELECT * INTO v_question FROM assignment_questions
    WHERE id = (v_answer->>'question_id')::uuid AND assignment_id = p_assignment_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_is_correct := ((v_answer->>'selected_index')::int = v_question.correct_index);
    v_points := CASE WHEN v_is_correct THEN v_question.points ELSE 0 END;
    INSERT INTO assignment_answers (submission_id, question_id, selected_index, is_correct, points_awarded)
    VALUES (v_submission.id, v_question.id, (v_answer->>'selected_index')::int, v_is_correct, v_points);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'score', v_score, 'max_score', v_max_score, 'submission_id', v_submission.id);
END;
$$;

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
  IF NOT EXISTS (
    SELECT 1 FROM course_assignments ca
    JOIN course_enrollments ce ON ce.course_id = ca.course_id
    WHERE ca.assignment_id = p_assignment_id AND ce.student_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous n''êtes pas inscrit à ce cours');
  END IF;

  SELECT * INTO v_existing_submission
  FROM assignment_submissions
  WHERE assignment_id = p_assignment_id AND student_id = auth.uid();

  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    SELECT * INTO v_step FROM guided_steps
    WHERE id = (v_answer->>'step_id')::uuid
    AND module_id IN (SELECT id FROM guided_modules WHERE assignment_id = p_assignment_id);
    IF NOT FOUND THEN CONTINUE; END IF;
    v_max_score := v_max_score + v_step.points;
    v_is_correct := (trim(lower(v_answer->>'submitted_value')) = trim(lower(v_step.expected_answer)));
    IF v_is_correct THEN v_score := v_score + v_step.points; END IF;
  END LOOP;

  IF v_existing_submission IS NOT NULL THEN
    DELETE FROM guided_step_answers WHERE submission_id = v_existing_submission.id;
    UPDATE assignment_submissions SET score = v_score, max_score = v_max_score, submitted_at = now() WHERE id = v_existing_submission.id;
    v_submission := v_existing_submission;
  ELSE
    INSERT INTO assignment_submissions (assignment_id, student_id, score, max_score, submitted_at)
    VALUES (p_assignment_id, auth.uid(), v_score, v_max_score, now()) RETURNING * INTO v_submission;
  END IF;

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

  RETURN jsonb_build_object('success', true, 'score', v_score, 'max_score', v_max_score, 'submission_id', v_submission.id);
END;
$$;
