CREATE OR REPLACE FUNCTION student_dashboard(p_student_id uuid DEFAULT NULL)
RETURNS TABLE (total_score int, flags_found int, total_flags int, labs_completed int, total_labs int, time_spent_sec int, courses_enrolled int, badges_earned int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := COALESCE(p_student_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(fs.points_awarded) FROM flag_submissions fs WHERE fs.student_id = v_student_id), 0)::int,
    (SELECT COUNT(DISTINCT fs.flag_id) FROM flag_submissions fs WHERE fs.student_id = v_student_id AND fs.is_correct)::int,
    (SELECT COUNT(*) FROM flags f JOIN labs l ON l.id = f.lab_id WHERE l.status = 'active')::int,
    (SELECT COUNT(DISTINCT f.lab_id) FROM flag_submissions fs JOIN flags f ON f.id = fs.flag_id WHERE fs.student_id = v_student_id AND fs.is_correct)::int,
    (SELECT COUNT(*) FROM labs WHERE status = 'active')::int,
    COALESCE((SELECT SUM(a.duration_sec) FROM activity_sessions a WHERE a.student_id = v_student_id), 0)::int,
    (SELECT COUNT(*) FROM course_enrollments WHERE student_id = v_student_id)::int,
    (SELECT COUNT(*) FROM badge_awards WHERE student_id = v_student_id)::int;
END;
$$;
