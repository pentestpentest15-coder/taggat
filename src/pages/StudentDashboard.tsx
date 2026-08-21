import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Flag, Clock, BookOpen, Award, TrendingUp, Target, Zap,
  ChevronRight, Activity, X, FlaskConical, ClipboardList, Calendar,
  Terminal, Shield, Cpu,
} from 'lucide-react';
import { supabase, type StudentDashboard as StudentDashboardType, type BadgeAward, type FlagSubmission, type Lab, type Course } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDuration, timeAgo } from '@/lib/format';
import { PageHeader, LoadingSpinner, EmptyState, RiskGauge, InfoTip, StatPill, SeverityBadge, difficultyToSeverity } from '@/components/ui';

interface EnrolledCourse {
  id: string;
  title: string;
  code: string | null;
  formateur: { full_name: string } | null;
}

interface AvailableLab {
  id: string;
  title: string;
  difficulty: string;
  category: string | null;
  estimated_duration_min: number;
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<StudentDashboardType | null>(null);
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [recentSubs, setRecentSubs] = useState<FlagSubmission[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [availableLabs, setAvailableLabs] = useState<AvailableLab[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<{ id: string; title: string; type: string; due_date: string | null; course_title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      try {
        const [dashRes, badgeRes, subsRes, courseRes, labRes] = await Promise.all([
          supabase.rpc('student_dashboard', { p_student_id: profile.id }),
          supabase.from('badge_awards').select('*, badge:badges(*)').eq('student_id', profile.id).order('awarded_at', { ascending: false }),
          supabase.from('flag_submissions').select('*').eq('student_id', profile.id).order('submitted_at', { ascending: false }).limit(8),
          supabase.from('course_enrollments').select('course:courses(id, title, code, formateur:profiles!courses_formateur_id_fkey(full_name))').eq('student_id', profile.id).order('enrolled_at', { ascending: false }),
          supabase.from('labs').select('id, title, difficulty, category, estimated_duration_min').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
        ]);

        setStats(dashRes.data as StudentDashboardType);
        setBadges((badgeRes.data as BadgeAward[]) ?? []);
        setRecentSubs((subsRes.data as FlagSubmission[]) ?? []);

        const courses = ((courseRes.data ?? []) as unknown as { course: EnrolledCourse }[])
          .map((r) => r.course).filter(Boolean) as EnrolledCourse[];
        setEnrolledCourses(courses);

        setAvailableLabs((labRes.data as AvailableLab[]) ?? []);

        if (courses.length > 0) {
          const courseIds = courses.map((c) => c.id);
          const { data: caData } = await supabase
            .from('course_assignments')
            .select('assignment:assignments(id, title, type, due_date, is_published)')
            .in('course_id', courseIds)
            .order('created_at', { ascending: false });

          const allAssignments = ((caData ?? []) as unknown as { assignment: { id: string; title: string; type: string; due_date: string | null; is_published: boolean } }[])
            .map((r) => r.assignment)
            .filter((a): a is { id: string; title: string; type: string; due_date: string | null; is_published: boolean } => Boolean(a) && a.is_published);

          const seen = new Set<string>();
          const unique = allAssignments.filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          }).slice(0, 5);

          const submittedIds = new Set<string>();
          if (unique.length > 0) {
            const assignIds = unique.map((a) => a.id);
            const { data: mySubs } = await supabase
              .from('assignment_submissions')
              .select('assignment_id')
              .eq('student_id', profile.id)
              .in('assignment_id', assignIds);
            (mySubs ?? []).forEach((s: { assignment_id: string }) => submittedIds.add(s.assignment_id));
          }

          const pending = unique
            .filter((a) => !submittedIds.has(a.id))
            .map((a) => ({ id: a.id, title: a.title, type: a.type, due_date: a.due_date, course_title: '' }));
          setPendingAssignments(pending);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile]);

  if (loading) return <LoadingSpinner label="Chargement du tableau de bord..." />;

  const completionRate = stats && stats.total_flags > 0
    ? Math.round((stats.flags_found / stats.total_flags) * 100)
    : 0;

  const successRate = stats && stats.total_flags > 0
    ? Math.round((stats.flags_found / stats.total_flags) * 100)
    : 0;

  // Determine the student's "skill level" based on score
  const skillLevel = (stats?.total_score ?? 0) >= 500 ? 'AVANCÉ' : (stats?.total_score ?? 0) >= 200 ? 'INTERMÉDIAIRE' : 'DÉBUTANT';
  const skillColor = (stats?.total_score ?? 0) >= 500 ? '#ff2e88' : (stats?.total_score ?? 0) >= 200 ? '#ffaa00' : '#00ff9d';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Bonjour, ${profile?.full_name?.split(' ')[0] ?? 'Étudiant'}`}
        subtitle="Voici votre progression sur la plateforme"
      />

      {/* Hero panel: Risk gauge + skill level */}
      <div className="card p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00ff9d]/3 rounded-full blur-3xl" />
        <div className="relative flex flex-col lg:flex-row items-center gap-8">
          <RiskGauge value={completionRate} label="Progression globale" size="lg" />
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-[#00ff9d]" />
              <h3 className="section-title">Statut opérationnel</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-panel p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Trophy className="w-3.5 h-3.5 text-[#ffaa00]" />
                  <span className="text-xs text-cyber-text-muted">Score</span>
                  <InfoTip text="Points accumulés en validant des flags dans les laboratoires" />
                </div>
                <p className="text-xl font-bold font-mono text-cyber-text">{stats?.total_score ?? 0}</p>
              </div>
              <div className="glass-panel p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Flag className="w-3.5 h-3.5 text-[#00ff9d]" />
                  <span className="text-xs text-cyber-text-muted">Flags</span>
                  <InfoTip text="Un flag est une chaîne de caractères cachée dans une machine cible. Le trouver prouve que vous avez réussi l'exercice." />
                </div>
                <p className="text-xl font-bold font-mono text-cyber-text">{stats?.flags_found ?? 0}<span className="text-sm text-cyber-text-muted">/{stats?.total_flags ?? 0}</span></p>
              </div>
              <div className="glass-panel p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-[#00d4ff]" />
                  <span className="text-xs text-cyber-text-muted">Temps</span>
                  <InfoTip text="Temps total passé sur les laboratoires" />
                </div>
                <p className="text-xl font-bold font-mono text-cyber-text">{formatDuration(stats?.time_spent_sec ?? 0)}</p>
              </div>
              <div className="glass-panel p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#ff2e88]" />
                  <span className="text-xs text-cyber-text-muted">Cours</span>
                </div>
                <p className="text-xl font-bold font-mono text-cyber-text">{stats?.courses_enrolled ?? 0}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: skillColor }} />
              <span className="text-sm font-mono font-semibold" style={{ color: skillColor }}>{skillLevel}</span>
              <div className="flex-1 h-1.5 bg-cyber-bg rounded-full overflow-hidden border border-cyber-border">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (stats?.total_score ?? 0) / 5)}%`, background: skillColor, boxShadow: `0 0 8px ${skillColor}40` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending assignments */}
      {pendingAssignments.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-[#ffaa00]" />
            <h3 className="section-title">TP & Devoirs à rendre</h3>
            <InfoTip text="Travaux pratiques et devoirs assignés par vos formateurs. À compléter avant la date limite." />
          </div>
          <div className="space-y-2">
            {pendingAssignments.map((a) => (
              <Link key={a.id} to={`/assignments/${a.id}`} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border hover:border-[#ffaa00]/30 transition-all group">
                <div className="w-8 h-8 bg-[#ffaa00]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-4 h-4 text-[#ffaa00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cyber-text">{a.title}</p>
                  <p className="text-xs text-cyber-text-muted font-mono">{a.type.toUpperCase()}</p>
                </div>
                {a.due_date && (
                  <span className="text-xs text-cyber-text-muted flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3" />
                    {new Date(a.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ffaa00] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Enrolled courses */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#ff2e88]" />
              <h3 className="section-title">Mes cours</h3>
              <InfoTip text="Les cours (rooms) regroupent vos labs et TP. Inscrivez-vous avec un code fourni par votre formateur." />
            </div>
            <Link to="/courses" className="text-xs text-[#00ff9d] hover:underline font-mono">Voir tout →</Link>
          </div>
          {enrolledCourses.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-6 h-6 text-cyber-text-muted" />} title="Aucun cours inscrit" description="Inscrivez-vous avec un code fourni par votre formateur" />
          ) : (
            <div className="space-y-2">
              {enrolledCourses.map((c) => (
                <Link key={c.id} to={`/courses/${c.id}`} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border hover:border-[#ff2e88]/30 transition-all group">
                  <div className="w-8 h-8 bg-[#ff2e88]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-[#ff2e88]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyber-text truncate">{c.title}</p>
                    <p className="text-xs text-cyber-text-muted font-mono">
                      {c.code && <span>{c.code} · </span>}
                      {c.formateur?.full_name ?? 'Formateur'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ff2e88] transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Available labs */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#00ff9d]" />
              <h3 className="section-title">Labs disponibles</h3>
              <InfoTip text="Laboratoires de cybersécurité: des machines cibles à exploiter pour trouver des flags et gagner des points." />
            </div>
            <Link to="/labs" className="text-xs text-[#00ff9d] hover:underline font-mono">Voir tout →</Link>
          </div>
          {availableLabs.length === 0 ? (
            <EmptyState icon={<FlaskConical className="w-6 h-6 text-cyber-text-muted" />} title="Aucun lab disponible" description="Les labs seront ajoutés par les formateurs" />
          ) : (
            <div className="space-y-2">
              {availableLabs.map((l) => (
                <Link key={l.id} to={`/labs/${l.id}`} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border hover:border-[#00ff9d]/30 transition-all group">
                  <div className="w-8 h-8 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FlaskConical className="w-4 h-4 text-[#00ff9d]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyber-text truncate">{l.title}</p>
                    <p className="text-xs text-cyber-text-muted font-mono">{l.category ?? 'Non classé'} · {formatDuration(l.estimated_duration_min * 60)}</p>
                  </div>
                  <SeverityBadge level={difficultyToSeverity(l.difficulty)} showIcon={false} />
                  <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#00ff9d] transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* Badges */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#ffaa00]" />
              <h3 className="section-title">Badges obtenus</h3>
              <InfoTip text="Récompenses débloquées en validant des flags ou en atteignant des objectifs spécifiques." />
            </div>
            <span className="text-xs text-cyber-text-muted font-mono">{badges.length} badge(s)</span>
          </div>
          {badges.length === 0 ? (
            <EmptyState icon={<Award className="w-6 h-6 text-cyber-text-muted" />} title="Aucun badge pour le moment" description="Validez des flags pour débloquer des badges" />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {badges.map((award) => (
                <div key={award.id} className="flex flex-col items-center text-center p-3 bg-cyber-bg rounded-lg border border-cyber-border hover:border-[#ffaa00]/30 transition-all">
                  <div className="w-10 h-10 bg-[#ffaa00]/10 rounded-full flex items-center justify-center mb-2 border border-[#ffaa00]/20" style={{ boxShadow: '0 0 12px rgba(255, 170, 0, 0.1)' }}>
                    <Award className="w-5 h-5 text-[#ffaa00]" />
                  </div>
                  <p className="text-xs font-medium text-cyber-text-dim truncate w-full">{award.badge?.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00d4ff]" />
              <h3 className="section-title">Activité récente</h3>
            </div>
          </div>
          {recentSubs.length === 0 ? (
            <EmptyState icon={<Flag className="w-6 h-6 text-cyber-text-muted" />} title="Aucune activité" description="Commencez par explorer les laboratoires" />
          ) : (
            <div className="space-y-2">
              {recentSubs.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sub.is_correct ? 'bg-[#00ff9d]/10' : 'bg-[#ff3355]/10'}`}>
                    {sub.is_correct ? <Flag className="w-4 h-4 text-[#00ff9d]" /> : <X className="w-4 h-4 text-[#ff3355]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-cyber-text-dim">
                      {sub.is_correct ? 'Flag validé' : 'Tentative échouée'}
                      {sub.points_awarded > 0 && <span className="text-[#00ff9d] font-semibold ml-1 font-mono">+{sub.points_awarded} pts</span>}
                    </p>
                    <p className="text-xs text-cyber-text-muted font-mono">{timeAgo(sub.submitted_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        <Link to="/labs" className="card-hover p-5 group">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-[#00ff9d]" />
            <h4 className="font-semibold text-cyber-text">Laboratoires</h4>
          </div>
          <p className="text-xs text-cyber-text-muted">Explorez les labs disponibles</p>
          <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#00ff9d] mt-2 transition-colors" />
        </Link>
        <Link to="/courses" className="card-hover p-5 group">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-[#ff2e88]" />
            <h4 className="font-semibold text-cyber-text">Cours & Modules</h4>
          </div>
          <p className="text-xs text-cyber-text-muted">Accédez à vos cours en room</p>
          <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ff2e88] transition-colors" />
        </Link>
        <Link to="/leaderboard" className="card-hover p-5 group">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-[#ffaa00]" />
            <h4 className="font-semibold text-cyber-text">Classement</h4>
          </div>
          <p className="text-xs text-cyber-text-muted">Comparez votre score</p>
          <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ffaa00] transition-colors" />
        </Link>
      </div>
    </div>
  );
}
