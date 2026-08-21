/*
# Add documentation column to courses

1. Modified Tables
- `courses`: add `documentation` column (text, nullable) — allows formateurs to attach
  rich text documentation to a course. Students can read it on the course detail page
  but cannot download it (no file storage, rendered as read-only text in the UI).

2. Security
- No RLS policy changes needed — the existing course policies already cover SELECT
  and UPDATE on the courses table, so the new column inherits those rules.
*/

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS documentation text;
