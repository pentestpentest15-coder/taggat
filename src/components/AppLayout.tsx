import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Shield, LayoutDashboard, BookOpen, Flag, Trophy, Users, FlaskConical, ClipboardList, LogOut, Menu, X, CircleUser as UserCircle, Terminal, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = profile?.role ?? 'etudiant';

  const navItems: { to: string; label: string; icon: typeof Shield; roles?: string[] }[] = [
    { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/courses', label: 'Cours & Modules', icon: BookOpen, roles: ['etudiant', 'formateur', 'admin'] },
    { to: '/labs', label: 'Laboratoires', icon: FlaskConical, roles: ['etudiant', 'formateur', 'admin'] },
    { to: '/assignments', label: 'TP & Devoirs', icon: ClipboardList, roles: ['etudiant', 'formateur', 'admin'] },
    { to: '/leaderboard', label: 'Classement', icon: Trophy, roles: ['etudiant', 'formateur', 'admin'] },
    { to: '/manage/labs', label: 'Gérer Labs', icon: FlaskConical, roles: ['formateur', 'admin'] },
    { to: '/manage/courses', label: 'Gérer Cours', icon: BookOpen, roles: ['formateur', 'admin'] },
    { to: '/manage/assignments', label: 'Gérer TP/Devoirs', icon: ClipboardList, roles: ['formateur', 'admin'] },
    { to: '/admin/users', label: 'Utilisateurs', icon: Users, roles: ['admin'] },
  ];

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role));

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const roleBadge = {
    admin: <span className="badge-admin">ADMIN</span>,
    formateur: <span className="badge-formateur">FORMATEUR</span>,
    etudiant: <span className="badge-etudiant">ÉTUDIANT</span>,
  }[role];

  return (
    <div className="min-h-screen bg-cyber-bg flex cyber-grid-bg relative overflow-hidden">
      <img
        src="/A4444D2A-50B8-4A12-8A67-E9218C774E67.PNG"
        alt=""
        aria-hidden="true"
        className="app-watermark"
      />
      <div className="relative z-10 flex min-h-screen w-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-cyber-surface/90 backdrop-blur-xl border-r border-cyber-border z-40 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-lg flex items-center justify-center border border-[#00ff9d]/20 overflow-hidden bg-black">
              <img src="/2125FDD5-E2B2-40EB-A24A-352C069DF8F7.PNG" alt="Logo TÀGGAT" className="w-full h-full object-cover" />
              <div className="absolute inset-0 rounded-lg" style={{ boxShadow: 'inset 0 0 12px rgba(0, 255, 157, 0.1)' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-cyber-text tracking-wide">TÀGGAT</h1>
              <p className="text-xs text-cyber-text-muted font-mono">v2.0 // CYBER</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User panel */}
        <div className="p-3 border-t border-cyber-border">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
            <div className="w-9 h-9 bg-cyber-surface-hover rounded-full flex items-center justify-center border border-cyber-border">
              <UserCircle className="w-5 h-5 text-cyber-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cyber-text truncate">{profile?.full_name}</p>
              <div className="mt-1">{roleBadge}</div>
            </div>
            <NavLink
              to="/settings"
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-cyber-text-muted hover:text-[#00ff9d] hover:bg-cyber-surface-hover transition-all flex-shrink-0"
              title="Réglages"
            >
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
          <button onClick={handleSignOut} className="btn-ghost w-full text-sm">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-cyber-surface/90 backdrop-blur-xl border-b border-cyber-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/2125FDD5-E2B2-40EB-A24A-352C069DF8F7.PNG" alt="Logo TÀGGAT" className="w-7 h-7 object-cover rounded-md bg-black" />
            <span className="font-bold text-cyber-text">TÀGGAT</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-cyber-text-dim w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cyber-surface-hover transition-all">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
