-- Fix: column reference "total_score" is ambiguous
-- The RETURNS TABLE creates PL/pgSQL variables named total_score/flags_found,
-- which conflict with bare references in ORDER BY / OVER clauses.
-- Qualify all references with the CTE alias ss.

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
      COALESCE(SUM(fs.points_awarded), 0)::int AS score,
      COUNT(DISTINCT CASE WHEN fs.is_correct THEN fs.flag_id END)::int AS flags
    FROM profiles p
    LEFT JOIN flag_submissions fs ON fs.student_id = p.id
    WHERE p.role = 'etudiant'
      AND (p_course_id IS NULL OR EXISTS (
        SELECT 1 FROM course_enrollments ce WHERE ce.student_id = p.id AND ce.course_id = p_course_id
      ))
    GROUP BY p.id, p.full_name, p.email, p.avatar_url, p.promo
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ss.score DESC, ss.flags DESC)::int AS rank,
    ss.student_id,
    ss.full_name,
    ss.email,
    ss.avatar_url,
    ss.promo,
    ss.score AS total_score,
    ss.flags AS flags_found
  FROM student_scores ss
  ORDER BY ss.score DESC, ss.flags DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION leaderboard(uuid) TO authenticated;
