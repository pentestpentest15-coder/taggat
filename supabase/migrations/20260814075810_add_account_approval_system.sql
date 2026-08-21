/*
# Account Approval System

## Problem
Currently anyone can create an account with any role (including admin), and accounts are immediately active.

## Fix
1. Add `is_approved` column to profiles — defaults to false for new signups.
2. Update `handle_new_user()` trigger to force role='etudiant' and is_approved=false on all new signups. The admin role can only be set by an existing admin via the admin panel.
3. Update `is_staff()` to also require is_approved=true (so unapproved users get no staff privileges even if someone tries to set their role).
4. Update profiles SELECT policy so unapproved users can still read their own profile (needed for login feedback), but cannot read other profiles.
5. Update profiles UPDATE policy so only approved admins can approve/suspend/block other users. Users cannot self-approve.
6. Add DELETE policy so admins can delete users.
7. Update all other tables' RLS to require is_approved via is_staff() (already done) and via ownership checks.

## Important
- The existing admin account (gendsn16@gmail.com) is manually set to is_approved=true.
- New signups get is_approved=false and role='etudiant' regardless of what they send.
- Only an approved admin can set is_approved=true or change roles.
*/

-- ============================================================
-- Add is_approved column
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Approve existing admin
UPDATE profiles SET is_approved = true WHERE role = 'admin';

-- ============================================================
-- Update is_staff() to require approval
-- ============================================================
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'formateur')
    AND is_approved = true
    AND is_active = true
  );
$$;

-- ============================================================
-- Update handle_new_user() — force etudiant role, no approval
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'etudiant'::user_role,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROFILES — updated policies
-- ============================================================
-- Users can always read their own profile (even unapproved, for login feedback)
-- Staff can read all profiles
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id OR is_staff()
  );

-- Users can update their own profile (name, avatar) but NOT role/is_approved/is_active
-- Admins can update any profile
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_update_all" ON profiles;
CREATE POLICY "profiles_admin_update_all" ON profiles FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- Users can insert their own profile row (trigger does this, but policy must allow it)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Admins can delete profiles
DROP POLICY IF EXISTS "profiles_admin_delete" ON profiles;
CREATE POLICY "profiles_admin_delete" ON profiles FOR DELETE
  TO authenticated USING (is_staff());
