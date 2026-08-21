import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AuthPage from '@/pages/AuthPage';
import SplashScreen from '@/components/SplashScreen';
import AppLayout from '@/components/AppLayout';
import StudentDashboard from '@/pages/StudentDashboard';
import FormateurDashboard from '@/pages/FormateurDashboard';
import LabsPage from '@/pages/LabsPage';
import LabDetailPage from '@/pages/LabDetailPage';
import CoursesPage from '@/pages/CoursesPage';
import CourseDetailPage from '@/pages/CourseDetailPage';
import AssignmentsPage from '@/pages/AssignmentsPage';
import AssignmentDetailPage from '@/pages/AssignmentDetailPage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import ManageLabsPage from '@/pages/ManageLabsPage';
import ManageCoursesPage from '@/pages/ManageCoursesPage';
import ManageAssignmentsPage from '@/pages/ManageAssignmentsPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import SettingsPage from '@/pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <div className="w-8 h-8 border-2 border-[#00ff9d] border-t-transparent rounded-full animate-spin" style={{ boxShadow: '0 0 12px rgba(0, 255, 157, 0.2)' }} />
      </div>
    );
  }

  if (!user || !profile) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile || (profile.role !== 'formateur' && profile.role !== 'admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function DashboardRouter() {
  const { profile } = useAuth();
  if (profile?.role === 'etudiant') return <StudentDashboard />;
  if (profile?.role === 'formateur' || profile?.role === 'admin') return <FormateurDashboard />;
  return <StudentDashboard />;
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <div className="w-8 h-8 border-2 border-[#00ff9d] border-t-transparent rounded-full animate-spin" style={{ boxShadow: '0 0 12px rgba(0, 255, 157, 0.2)' }} />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/labs" element={<ProtectedRoute><LabsPage /></ProtectedRoute>} />
      <Route path="/labs/:id" element={<ProtectedRoute><LabDetailPage /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
      <Route path="/courses/:id" element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} />
      <Route path="/assignments" element={<ProtectedRoute><AssignmentsPage /></ProtectedRoute>} />
      <Route path="/assignments/:id" element={<ProtectedRoute><AssignmentDetailPage /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
      <Route path="/manage/labs" element={<ProtectedRoute><StaffRoute><ManageLabsPage /></StaffRoute></ProtectedRoute>} />
      <Route path="/manage/courses" element={<ProtectedRoute><StaffRoute><ManageCoursesPage /></StaffRoute></ProtectedRoute>} />
      <Route path="/manage/assignments" element={<ProtectedRoute><StaffRoute><ManageAssignmentsPage /></StaffRoute></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><AdminUsersPage /></AdminRoute></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 3400);
    return () => clearTimeout(timer);
  }, [showSplash]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
