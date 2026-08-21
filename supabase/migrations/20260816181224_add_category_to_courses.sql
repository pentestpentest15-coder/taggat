/*
# Add category column to courses

1. Modified Tables
- `courses`: added `category` text column (nullable) to allow grouping courses by domain/category.
2. Security
- No RLS changes. Existing policies on `courses` remain unchanged.
3. Notes
- The column is nullable so existing courses default to NULL (uncategorized).
- Frontend will group courses by this field; NULL category shows under "Non classé".
*/

ALTER TABLE courses ADD COLUMN IF NOT EXISTS category text;
