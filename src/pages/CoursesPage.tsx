import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Users, FlaskConical, Plus, UserPlus, FolderTree, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase, type Course } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Toast } from '@/components/ui';

interface CourseWithStats extends Course {
  student_count?: number;
  lab_count?: number;
  is_enrolled?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {};

export default function CoursesPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollModal, setEnrollModal] = useState<Course | null>(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadCourses();
  }, [profile]);

  async function loadCourses() {
    if (!profile) return;
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    const allCourses = (data as Course[]) ?? [];
    if (allCourses.length === 0) { setCourses([]); setLoading(false); return; }

    const courseIds = allCourses.map((c) => c.id);

    const [enrollmentsRes, labLinksRes, myEnrollmentsRes] = await Promise.all([
      supabase.from('course_enrollments').select('course_id').in('course_id', courseIds),
      supabase.from('course_labs').select('course_id').in('course_id', courseIds),
      profile.role === 'etudiant'
        ? supabase.from('course_enrollments').select('course_id').eq('student_id', profile.id).in('course_id', courseIds)
        : Promise.resolve({ data: [] as { course_id: string }[] | null }),
    ]);

    const studentCounts = new Map<string, number>();
    for (const e of (enrollmentsRes.data ?? []) as { course_id: string }[]) {
      studentCounts.set(e.course_id, (studentCounts.get(e.course_id) ?? 0) + 1);
    }

    const labCounts = new Map<string, number>();
    for (const l of (labLinksRes.data ?? []) as { course_id: string }[]) {
      labCounts.set(l.course_id, (labCounts.get(l.course_id) ?? 0) + 1);
    }

    const enrolledIds = new Set(((myEnrollmentsRes.data ?? []) as { course_id: string }[]).map((e) => e.course_id));

    setCourses(allCourses.map((course) => ({
      ...course,
      student_count: studentCounts.get(course.id) ?? 0,
      lab_count: labCounts.get(course.id) ?? 0,
      is_enrolled: enrolledIds.has(course.id),
    })));
    setLoading(false);
  }

  async function handleEnroll() {
    if (!profile || !enrollCode.trim()) return;
    const { data: course } = await supabase
      .from('courses')
      .select('*')
      .eq('code', enrollCode.trim().toUpperCase())
      .maybeSingle();

    if (!course) {
      setToast({ message: 'Code de cours introuvable', type: 'error' });
      return;
    }

    const { error } = await supabase
      .from('course_enrollments')
      .insert({ course_id: (course as Course).id, student_id: profile.id });

    if (error) {
      if (error.code === '23505') {
        setToast({ message: 'Vous êtes déjà inscrit à ce cours', type: 'info' });
      } else {
        setToast({ message: 'Erreur lors de l\'inscription', type: 'error' });
      }
    } else {
      setToast({ message: 'Inscription réussie !', type: 'success' });
      setEnrollModal(null);
      setEnrollCode('');
      loadCourses();
    }
  }

  const groupedCourses = useMemo(() => {
    const groups: Record<string, CourseWithStats[]> = {};
    for (const course of courses) {
      const canAccess = profile?.role !== 'etudiant' || course.is_enrolled || course.is_published;
      if (!canAccess) continue;
      const cat = course.category?.trim() || 'Non classé';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(course);
    }
    return groups;
  }, [courses, profile]);

  const categoryNames = useMemo(() => Object.keys(groupedCourses).sort((a, b) => {
    if (a === 'Non classé') return 1;
    if (b === 'Non classé') return -1;
    return a.localeCompare(b);
  }), [groupedCourses]);

  if (loading) return <LoadingSpinner label="Chargement des cours..." />;

  const totalVisible = categoryNames.reduce((sum, cat) => sum + groupedCourses[cat].length, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cours & Modules"
        subtitle="Vos cours en room et leurs laboratoires associés"
        action={profile?.role === 'etudiant' ? (
          <button onClick={() => setEnrollModal({} as Course)} className="btn-primary text-sm">
            <UserPlus className="w-4 h-4" /> Rejoindre un cours
          </button>
        ) : undefined}
      />

      {totalVisible === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6 text-cyber-text-muted" />}
          title="Aucun cours disponible"
          description={profile?.role === 'etudiant'
            ? 'Utilisez un code fourni par votre formateur pour rejoindre un cours'
            : 'Créez un cours depuis la gestion des cours'}
        />
      ) : (
        <div className="space-y-8">
          {categoryNames.map((category) => (
            <div key={category}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#00d4ff]/10 rounded-lg flex items-center justify-center border border-[#00d4ff]/20">
                  <FolderTree className="w-4 h-4 text-[#00d4ff]" />
                </div>
                <h2 className="text-lg font-semibold text-cyber-text">{category}</h2>
                <span className="text-xs text-cyber-text-muted font-mono ml-1">
                  {groupedCourses[category].length} COURS
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-[#1e2a3a] to-transparent ml-2" />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedCourses[category].map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="card-hover p-5 group flex flex-col relative"
                  >
                    {course.is_enrolled && profile?.role === 'etudiant' && (
                      <span className="absolute top-3 right-3 flex items-center gap-1 text-[#00ff9d] text-xs font-mono font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> INSCRIT
                      </span>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-[#ff2e88]/10 rounded-lg flex items-center justify-center border border-[#ff2e88]/20 flex-shrink-0" style={{ boxShadow: '0 0 12px rgba(255, 46, 136, 0.05)' }}>
                        <BookOpen className="w-5 h-5 text-[#ff2e88]" />
                      </div>
                      {!course.is_enrolled && (
                        <span className={course.is_published ? "badge-active ml-auto" : "badge-draft ml-auto"}>
                          {course.is_published ? 'PUBLIÉ' : 'BROUILLON'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-cyber-text mb-1 group-hover:text-[#00ff9d] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-sm text-cyber-text-muted line-clamp-2 mb-4 flex-1">
                      {course.description ?? 'Aucune description'}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-cyber-text-muted pt-3 border-t border-cyber-border font-mono">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {course.student_count} ÉT.
                      </span>
                      <span className="flex items-center gap-1">
                        <FlaskConical className="w-3.5 h-3.5" />
                        {course.lab_count} LAB(S)
                      </span>
                      {course.code && (
                        <span className="ml-auto text-[#00ff9d] font-mono">{course.code}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!enrollModal} onClose={() => setEnrollModal(null)} title="Rejoindre un cours" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-cyber-text-dim">
            Saisissez le code fourni par votre formateur pour vous inscrire au cours.
          </p>
          <input
            type="text"
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value)}
            placeholder="ex: SEC-2024-01"
            className="input font-mono uppercase"
            onKeyDown={(e) => { if (e.key === 'Enter') handleEnroll(); }}
          />
          <button onClick={handleEnroll} className="btn-primary w-full">
            <Plus className="w-4 h-4" /> S'inscrire
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
