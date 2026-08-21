import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type UserRole = 'admin' | 'formateur' | 'etudiant';
export type AssignmentType = 'tp' | 'devoir' | 'examen';
export type LabStatus = 'draft' | 'active' | 'archived';
export type EnrollmentStatus = 'pending' | 'active' | 'completed';
export type ActivityState = 'started' | 'paused' | 'completed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  promo: string | null;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  category: string | null;
  formateur_id: string;
  is_published: boolean;
  documentation: string | null;
  document_path: string | null;
  document_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
}

export interface Lab {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  vm_template_id: string | null;
  vm_ip: string | null;
  machine_url: string | null;
  machine_ip: string | null;
  connection_type: 'url' | 'ip' | null;
  difficulty: string;
  estimated_duration_min: number;
  max_duration_min: number;
  status: LabStatus;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Flag {
  id: string;
  lab_id: string;
  name: string;
  flag_value: string;
  points: number;
  hint: string | null;
  sort_order: number;
  created_at: string;
}

export interface StudentFlag {
  id: string;
  name: string;
  points: number;
  hint: string | null;
  sort_order: number;
  is_solved: boolean;
}

export interface FlagSubmission {
  id: string;
  student_id: string;
  flag_id: string;
  submitted_value: string;
  is_correct: boolean;
  points_awarded: number;
  submitted_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  criteria: Record<string, unknown> | null;
  created_at: string;
}

export interface BadgeAward {
  id: string;
  student_id: string;
  badge_id: string;
  awarded_by: string | null;
  awarded_at: string;
  badge?: Badge;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  due_date: string | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  duration_min: number | null;
}

export interface AssignmentQuestion {
  id: string;
  assignment_id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  points: number;
  sort_order: number;
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  score: number;
  max_score: number;
  started_at: string;
  submitted_at: string | null;
  created_at: string;
}

export interface AssignmentAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  selected_index: number;
  is_correct: boolean;
  points_awarded: number;
  created_at: string;
}

export interface SubmitAssignmentResult {
  success: boolean;
  score: number;
  max_score: number;
  submission_id: string;
  error?: string;
}

export interface ActivitySession {
  id: string;
  student_id: string;
  lab_id: string | null;
  state: ActivityState;
  started_at: string;
  ended_at: string | null;
  completed_at: string | null;
  duration_sec: number;
  created_at: string;
}

export interface StudentDashboard {
  total_score: number;
  flags_found: number;
  total_flags: number;
  labs_completed: number;
  total_labs: number;
  time_spent_sec: number;
  courses_enrolled: number;
  badges_earned: number;
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  promo: string | null;
  total_score: number;
  flags_found: number;
}

export interface FormateurStats {
  total_students: number;
  active_labs: number;
  total_labs: number;
  total_courses: number;
  total_assignments: number;
  total_submissions: number;
}

export interface VerifyFlagResult {
  success: boolean;
  correct: boolean;
  points: number;
  message: string;
  already_solved?: boolean;
  error?: string;
}

export interface GuidedModule {
  id: string;
  assignment_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface GuidedStep {
  id: string;
  module_id: string;
  step_number: number;
  instruction: string;
  expected_answer: string;
  hint: string | null;
  points: number;
  sort_order: number;
  created_at: string;
}

export interface GuidedStepAnswer {
  id: string;
  submission_id: string;
  step_id: string;
  submitted_value: string;
  is_correct: boolean;
  points_awarded: number;
  created_at: string;
}

export interface SubmitGuidedResult {
  success: boolean;
  score: number;
  max_score: number;
  submission_id: string;
  error?: string;
}

export interface CourseAssignment {
  course_id: string;
  assignment_id: string;
  sort_order: number;
  created_at: string;
}
