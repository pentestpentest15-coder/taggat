import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FlaskConical, BookOpen, ClipboardList, Flag,
  ChevronRight, Activity, UserCheck, Terminal, Cpu, Server,
} from 'lucide-react';
import { supabase, type FormateurStats, type FlagSubmission } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, InfoTip, SeverityBadge, difficultyToSeverity } from '@/components/ui';
import { timeAgo } from '@/lib/format';

interface CourseWithStudents {
  id: string;
  title: string;
  code: string | null;
  student_count: number;
}

interface RecentLab {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  flag_count: number;
}

interface SubmissionWithStudent extends FlagSubmission {
  student?: { full_name: string };
  flag?: { name: string; lab: { title: string } };
}

export default function FormateurDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<FormateurStats | null>(null);
  const [recentSubs, setRecentSubs] = useState<SubmissionWithStudent[]>([]);
  const [courses, setCourses] = useState<CourseWithStudents[]>([]);
  const [recentLabs, setRecentLabs] = useState<RecentLab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      try {
        const { data: statsData } = await supabase.rpc('formateur_stats', { p_formateur_id: profile.id });
        setStats(statsData as FormateurStats);

        const { data: courseData } = await supabase
          .from('courses')
          .select('id, title, code')
          .eq('formateur_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);
        const courseList = (courseData as { id: string; title: string; code: string | null }[]) ?? [];

        if (courseList.length > 0) {
          const courseIds = courseList.map((c) => c.id);
          const { data: enrollData } = await supabase
            .from('course_enrollments')
            .select('course_id')
            .in('course_id', courseIds);
          const counts = new Map<string, number>();
          (enrollData as { course_id: string }[] ?? []).forEach((e) => {
            counts.set(e.course_id, (counts.get(e.course_id) ?? 0) + 1);
          });
          setCourses(courseList.map((c) => ({
            id: c.id,
            title: c.title,
            code: c.code,
            student_count: counts.get(c.id) ?? 0,
          })));
        }

        const { data: labData } = await supabase
          .from('labs')
          .select('id, title, status, difficulty')
          .eq('created_by', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);
        const labList = (labData as { id: string; title: string; status: string; difficulty: string }[]) ?? [];
        if (labList.length > 0) {
          const labIds = labList.map((l) => l.id);
          const { data: flagData } = await supabase
            .from('flags')
            .select('lab_id')
            .in('lab_id', labIds);
          const flagCounts = new Map<string, number>();
          (flagData as { lab_id: string }[] ?? []).forEach((f) => {
            flagCounts.set(f.lab_id, (flagCounts.get(f.lab_id) ?? 0) + 1);
          });
          setRecentLabs(labList.map((l) => ({
            id: l.id,
            title: l.title,
            status: l.status,
            difficulty: l.difficulty,
            flag_count: flagCounts.get(l.id) ?? 0,
          })));
        }

        const { data: subsData } = await supabase
          .from('flag_submissions')
          .select(`
            *,
            student:profiles!flag_submissions_student_id_fkey(full_name),
            flag:flags(name, lab:labs(title))
          `)
          .in('flag_id', (
            await supabase
              .from('flags')
              .select('id')
              .in('lab_id', (
                await supabase.from('labs').select('id').eq('created_by', profile.id)
              ).data?.map((l: { id: string }) => l.id) ?? [])
          ).data?.map((f: { id: string }) => f.id) ?? [])
          .order('submitted_at', { ascending: false })
          .limit(10);

        setRecentSubs((subsData as SubmissionWithStudent[]) ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile]);

  if (loading) return <LoadingSpinner label="Chargement des statistiques..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Bonjour, ${profile?.full_name?.split(' ')[0] ?? 'Formateur'}`}
        subtitle="Vue d'ensemble de vos cours et laboratoires"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <Users className="w-5 h-5 text-[#00d4ff]" />
            <span className="text-xs text-cyber-text-muted font-mono">ÉTUDIANTS</span>
            <InfoTip text="Nombre total d'étudiants inscrits à vos cours" />
          </div>
          <span className="stat-value">{stats?.total_students ?? 0}</span>
          <span className="stat-label">inscrits à vos cours</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <FlaskConical className="w-5 h-5 text-[#00ff9d]" />
            <span className="text-xs text-cyber-text-muted font-mono">LABS</span>
            <InfoTip text="Laboratoires de cybersécurité actifs sur le total créé" />
          </div>
          <span className="stat-value">{stats?.active_labs ?? 0}</span>
          <span className="stat-label">sur {stats?.total_labs ?? 0} total</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <BookOpen className="w-5 h-5 text-[#ff2e88]" />
            <span className="text-xs text-cyber-text-muted font-mono">COURS</span>
          </div>
          <span className="stat-value">{stats?.total_courses ?? 0}</span>
          <span className="stat-label">cours créés</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <ClipboardList className="w-5 h-5 text-[#ffaa00]" />
            <span className="text-xs text-cyber-text-muted font-mono">TP</span>
            <InfoTip text="Travaux pratiques, devoirs et examens créés" />
          </div>
          <span className="stat-value">{stats?.total_assignments ?? 0}</span>
          <span className="stat-label">assignments</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <Flag className="w-5 h-5 text-[#00ff9d]" />
            <span className="text-xs text-cyber-text-muted font-mono">SOUMISSIONS</span>
            <InfoTip text="Tentatives de validation de flags par les étudiants" />
          </div>
          <span className="stat-value">{stats?.total_submissions ?? 0}</span>
          <span className="stat-label">tentatives de flags</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <UserCheck className="w-5 h-5 text-[#00d4ff]" />
            <span className="text-xs text-cyber-text-muted font-mono">ENGAGEMENT</span>
          </div>
          <span className="stat-value">
            {stats && stats.total_submissions > 0
              ? Math.round((stats.total_submissions > 0 ? 1 : 0) * 100)
              : 0}%
          </span>
          <span className="stat-label">taux d'engagement</span>
        </div>
      </div>

      {/* Quick management links */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Link to="/manage/labs" className="card-hover p-5 group">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="w-5 h-5 text-[#00ff9d]" />
            <h4 className="font-semibold text-cyber-text">Gérer les labs</h4>
          </div>
          <p className="text-xs text-cyber-text-muted">Créer, modifier et gérer les laboratoires</p>
          <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#00ff9d] mt-2 transition-colors" />
        </Link>
        <Link to="/manage/courses" className="card-hover p-5 group">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-5 h-5 text-[#ff2e88]" />
            <h4 className="font-semibold text-cyber-text">Gérer les cours</h4>
          </div>
          <p className="text-xs text-cyber-text-muted">Créer des cours et inscrire des étudiants</p>
          <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ff2e88] transition-colors" />
        </Link>
        <Link to="/manage/assignments" className="card-hover p-5 group">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-5 h-5 text-[#ffaa00]" />
            <h4 className="font-semibold text-cyber-text">Gérer TP/Devoirs</h4>
          </div>
          <p className="text-xs text-cyber-text-muted">Créer des TP, devoirs et examens</p>
          <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ffaa00] transition-colors" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My courses with student counts */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#ff2e88]" />
              <h3 className="section-title">Mes cours</h3>
            </div>
            <Link to="/manage/courses" className="text-xs text-[#00ff9d] hover:underline font-mono">Gérer →</Link>
          </div>
          {courses.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-6 h-6 text-cyber-text-muted" />} title="Aucun cours créé" description="Créez votre premier cours pour inscrire des étudiants" />
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <Link key={c.id} to={`/courses/${c.id}`} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border hover:border-[#ff2e88]/30 transition-all group">
                  <div className="w-8 h-8 bg-[#ff2e88]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-[#ff2e88]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyber-text truncate">{c.title}</p>
                    {c.code && <p className="text-xs text-cyber-text-muted font-mono">{c.code}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-cyber-text-dim bg-cyber-surface-hover px-2.5 py-1 rounded-md border border-cyber-border font-mono">
                    <Users className="w-3 h-3" />
                    {c.student_count}
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#ff2e88] transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My recent labs */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#00ff9d]" />
              <h3 className="section-title">Mes labs récents</h3>
            </div>
            <Link to="/manage/labs" className="text-xs text-[#00ff9d] hover:underline font-mono">Gérer →</Link>
          </div>
          {recentLabs.length === 0 ? (
            <EmptyState icon={<FlaskConical className="w-6 h-6 text-cyber-text-muted" />} title="Aucun lab créé" description="Créez votre premier laboratoire de cybersécurité" />
          ) : (
            <div className="space-y-2">
              {recentLabs.map((l) => (
                <Link key={l.id} to={`/labs/${l.id}`} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border hover:border-[#00ff9d]/30 transition-all group">
                  <div className="w-8 h-8 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FlaskConical className="w-4 h-4 text-[#00ff9d]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyber-text truncate">{l.title}</p>
                    <p className="text-xs text-cyber-text-muted font-mono">{l.flag_count} flag(s)</p>
                  </div>
                  <SeverityBadge level={difficultyToSeverity(l.difficulty)} showIcon={false} />
                  <span className={`badge ${l.status === 'active' ? 'badge-active' : l.status === 'draft' ? 'badge-draft' : 'badge-archived'}`}>
                    {l.status === 'active' ? 'ACTIF' : l.status === 'draft' ? 'BROUILLON' : 'ARCHIVÉ'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#00ff9d] transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent submissions */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00d4ff]" />
            <h3 className="section-title">Soumissions récentes de vos étudiants</h3>
            <InfoTip text="Dernières tentatives de validation de flags par les étudiants inscrits à vos cours" />
          </div>
        </div>
        {recentSubs.length === 0 ? (
          <EmptyState icon={<Flag className="w-6 h-6 text-cyber-text-muted" />} title="Aucune soumission" description="Les étudiants n'ont pas encore soumis de flags" />
        ) : (
          <div className="space-y-2">
            {recentSubs.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 p-3 bg-cyber-bg rounded-lg border border-cyber-border">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sub.is_correct ? 'bg-[#00ff9d]/10' : 'bg-[#ff3355]/10'}`}>
                  {sub.is_correct ? <Flag className="w-4 h-4 text-[#00ff9d]" /> : <span className="text-[#ff3355] text-xs font-bold">✕</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-cyber-text-dim">
                    <span className="font-medium">{sub.student?.full_name ?? 'Étudiant'}</span>
                    {' — '}
                    {sub.is_correct ? 'Flag validé' : 'Tentative échouée'}
                    {sub.flag?.name && <span className="text-cyber-text-muted ml-1 font-mono">· {sub.flag.name}</span>}
                    {sub.flag?.lab?.title && <span className="text-cyber-text-muted ml-1 font-mono">· {sub.flag.lab.title}</span>}
                    {sub.points_awarded > 0 && <span className="text-[#00ff9d] font-semibold ml-1 font-mono">+{sub.points_awarded} pts</span>}
                  </p>
                  <p className="text-xs text-cyber-text-muted font-mono">{timeAgo(sub.submitted_at)}</p>
                </div>
                <span className={`badge ${sub.is_correct ? 'badge-active' : 'badge-draft'}`}>
                  {sub.is_correct ? 'CORRECT' : 'ÉCHEC'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
