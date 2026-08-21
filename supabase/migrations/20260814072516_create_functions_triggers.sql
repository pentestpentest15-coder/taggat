/*
# Pentest Lab Platform - Functions, Triggers, Views

## Database Objects
1. `verify_flag(p_flag_id, p_submitted_value)` - SECURITY DEFINER function that verifies a flag submission, awards points if correct, and records the attempt. Students call this via RPC; the function reads the flag_value with elevated privileges so students never see it.
2. `handle_new_user()` - Trigger function that creates a profile row when a new auth.users row is created.
3. `student_dashboard(p_student_id)` - Returns aggregated stats for a student (total score, flags found, time spent, labs completed).
4. `leaderboard(p_course_id)` - Returns ranked student scores, optionally filtered by course.
5. `lab_flags_for_student(p_lab_id)` - View-like function returning flag metadata (id, name, points, hint, sort_order, is_solved) WITHOUT flag_value, for students.
6. `update_updated_at()` - Generic trigger to set updated_at on row change.
7. `student_stats_view` - View with per-student aggregate stats.
8. Seed badges data.
*/

-- ============================================================
-- GENERIC updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_labs_updated_at ON labs;
CREATE TRIGGER trg_labs_updated_at BEFORE UPDATE ON labs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON assignments;
CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HANDLE NEW USER (creates profile on signup)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'etudiant'::user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- VERIFY FLAG (SECURITY DEFINER - students call via RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION verify_flag(p_flag_id uuid, p_submitted_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag flags%ROWTYPE;
  v_existing flag_submissions%ROWTYPE;
  v_is_correct boolean;
  v_points int;
BEGIN
  -- Get the flag (elevated privileges - bypasses RLS)
  SELECT * INTO v_flag FROM flags WHERE id = p_flag_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Flag introuvable');
  END IF;

  -- Check if student already solved this flag
  SELECT * INTO v_existing
    FROM flag_submissions
    WHERE student_id = auth.uid() AND flag_id = p_flag_id AND is_correct = true
    LIMIT 1;

  v_is_correct := (trim(lower(p_submitted_value)) = trim(lower(v_flag.flag_value)));

  IF v_is_correct THEN
    IF v_existing IS NOT NULL THEN
      -- Already solved, don't award points again
      INSERT INTO flag_submissions (student_id, flag_id, submitted_value, is_correct, points_awarded)
      VALUES (auth.uid(), p_flag_id, p_submitted_value, true, 0);

      RETURN jsonb_build_object(
        'success', true,
        'correct', true,
        'points', 0,
        'message', 'Flag déjà validé précédemment',
        'already_solved', true
      );
    ELSE
      -- First correct submission - award points
      INSERT INTO flag_submissions (student_id, flag_id, submitted_value, is_correct, points_awarded)
      VALUES (auth.uid(), p_flag_id, p_submitted_value, true, v_flag.points);

      RETURN jsonb_build_object(
        'success', true,
        'correct', true,
        'points', v_flag.points,
        'message', 'Flag validé !',
        'already_solved', false
      );
    END IF;
  ELSE
    -- Incorrect submission
    INSERT INTO flag_submissions (student_id, flag_id, submitted_value, is_correct, points_awarded)
    VALUES (auth.uid(), p_flag_id, p_submitted_value, false, 0);

    RETURN jsonb_build_object(
      'success', true,
      'correct', false,
      'points', 0,
      'message', 'Flag incorrect. Réessayez.'
    );
  END IF;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION verify_flag(uuid, text) TO authenticated;

-- ============================================================
-- LAB FLAGS FOR STUDENT (returns flag metadata without flag_value)
-- ============================================================
CREATE OR REPLACE FUNCTION lab_flags_for_student(p_lab_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  points int,
  hint text,
  sort_order int,
  is_solved boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.points,
    f.hint,
    f.sort_order,
    EXISTS (
      SELECT 1 FROM flag_submissions fs
      WHERE fs.flag_id = f.id AND fs.student_id = auth.uid() AND fs.is_correct = true
    ) AS is_solved
  FROM flags f
  WHERE f.lab_id = p_lab_id
  ORDER BY f.sort_order, f.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION lab_flags_for_student(uuid) TO authenticated;

-- ============================================================
-- STUDENT DASHBOARD (aggregated stats)
-- ============================================================
CREATE OR REPLACE FUNCTION student_dashboard(p_student_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_score int,
  flags_found int,
  total_flags int,
  labs_completed int,
  total_labs int,
  time_spent_sec int,
  courses_enrolled int,
  badges_earned int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := COALESCE(p_student_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(fs.points_awarded), 0)::int AS total_score,
    COUNT(DISTINCT CASE WHEN fs.is_correct THEN fs.flag_id END)::int AS flags_found,
    (SELECT COUNT(*) FROM flags f JOIN labs l ON l.id = f.lab_id WHERE l.status = 'active')::int AS total_flags,
    COUNT(DISTINCT CASE WHEN fs.is_correct THEN f.lab_id END)::int AS labs_completed,
    0::int AS total_labs,
    COALESCE(SUM(a.duration_sec), 0)::int AS time_spent_sec,
    (SELECT COUNT(*) FROM course_enrollments WHERE student_id = v_student_id)::int AS courses_enrolled,
    (SELECT COUNT(*) FROM badge_awards WHERE student_id = v_student_id)::int AS badges_earned
  FROM flag_submissions fs
  LEFT JOIN flags f ON f.id = fs.flag_id
  LEFT JOIN activity_sessions a ON a.student_id = v_student_id
  WHERE fs.student_id = v_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION student_dashboard(uuid) TO authenticated;

-- ============================================================
-- LEADERBOARD
-- ============================================================
CREATE OR REPLACE FUNCTION leaderboard(p_course_id uuid DEFAULT NULL)
RETURNS TABLE (
  rank int,
  student_id uuid,
  full_name text,
  email text,
  avatar_url text,
  promo text,
  total_score int,
  flags_found int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH student_scores AS (
    SELECT
      p.id AS student_id,
      p.full_name,
      p.email,
      p.avatar_url,
      p.promo,
      COALESCE(SUM(fs.points_awarded), 0)::int AS total_score,
      COUNT(DISTINCT CASE WHEN fs.is_correct THEN fs.flag_id END)::int AS flags_found
    FROM profiles p
    LEFT JOIN flag_submissions fs ON fs.student_id = p.id
    WHERE p.role = 'etudiant'
      AND (p_course_id IS NULL OR EXISTS (
        SELECT 1 FROM course_enrollments ce WHERE ce.student_id = p.id AND ce.course_id = p_course_id
      ))
    GROUP BY p.id, p.full_name, p.email, p.avatar_url, p.promo
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY total_score DESC, flags_found DESC)::int AS rank,
    ss.student_id,
    ss.full_name,
    ss.email,
    ss.avatar_url,
    ss.promo,
    ss.total_score,
    ss.flags_found
  FROM student_scores ss
  ORDER BY ss.total_score DESC, ss.flags_found DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION leaderboard(uuid) TO authenticated;

-- ============================================================
-- FORMATEUR STATS
-- ============================================================
CREATE OR REPLACE FUNCTION formateur_stats(p_formateur_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_students int,
  active_labs int,
  total_labs int,
  total_courses int,
  total_assignments int,
  total_submissions int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_formateur_id uuid := COALESCE(p_formateur_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT ce.student_id) FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id WHERE c.formateur_id = v_formateur_id)::int,
    (SELECT COUNT(*) FROM labs WHERE created_by = v_formateur_id AND status = 'active')::int,
    (SELECT COUNT(*) FROM labs WHERE created_by = v_formateur_id)::int,
    (SELECT COUNT(*) FROM courses WHERE formateur_id = v_formateur_id)::int,
    (SELECT COUNT(*) FROM assignments WHERE created_by = v_formateur_id)::int,
    (SELECT COUNT(*) FROM flag_submissions fs JOIN flags f ON f.id = fs.flag_id JOIN labs l ON l.id = f.lab_id WHERE l.created_by = v_formateur_id)::int;
END;
$$;

GRANT EXECUTE ON FUNCTION formateur_stats(uuid) TO authenticated;

-- ============================================================
-- SEED BADGES
-- ============================================================
INSERT INTO badges (name, description, icon, criteria) VALUES
  ('Premier Flag', 'Valider votre premier flag', 'flag', '{"type": "first_flag"}'::jsonb),
  ('Collectionneur', 'Valider 10 flags', 'award', '{"type": "flags_count", "threshold": 10}'::jsonb),
  ('Expert', 'Valider 50 flags', 'crown', '{"type": "flags_count", "threshold": 50}'::jsonb),
  ('Marathonien', 'Passer plus de 10 heures sur les labs', 'clock', '{"type": "time_spent", "threshold": 36000}'::jsonb),
  ('Score 500', 'Atteindre 500 points', 'star', '{"type": "score", "threshold": 500}'::jsonb),
  ('Score 1000', 'Atteindre 1000 points', 'trophy', '{"type": "score", "threshold": 1000}'::jsonb)
ON CONFLICT DO NOTHING;
