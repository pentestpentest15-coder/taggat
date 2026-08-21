CREATE OR REPLACE FUNCTION formateur_stats(p_formateur_id uuid DEFAULT NULL)
RETURNS TABLE (total_students int, active_labs int, total_labs int, total_courses int, total_assignments int, total_submissions int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_formateur_id uuid := COALESCE(p_formateur_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(DISTINCT ce.student_id) FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id WHERE c.formateur_id = v_formateur_id), 0)::int,
    (SELECT COUNT(*) FROM labs WHERE created_by = v_formateur_id AND status = 'active')::int,
    (SELECT COUNT(*) FROM labs WHERE created_by = v_formateur_id)::int,
    (SELECT COUNT(*) FROM courses WHERE formateur_id = v_formateur_id)::int,
    (SELECT COUNT(*) FROM assignments WHERE created_by = v_formateur_id)::int,
    (SELECT COUNT(*) FROM flag_submissions fs JOIN flags f ON f.id = fs.flag_id JOIN labs l ON l.id = f.lab_id WHERE l.created_by = v_formateur_id)::int;
END;
$$;
