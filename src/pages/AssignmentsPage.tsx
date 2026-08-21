import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ChevronRight, Calendar, FlaskConical, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase, type Assignment } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, InfoTip } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

interface AssignmentWithLabCount extends Assignment {
  lab_count?: number;
}

const typeBadge: Record<string, string> = {
  tp: 'badge-tp',
  devoir: 'badge-devoir',
  examen: 'badge-examen',
};

const typeLabel: Record<string, string> = {
  tp: 'TP',
  devoir: 'DEVOIR',
  examen: 'EXAMEN',
};

export default function AssignmentsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithLabCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const { data } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });
      const allAssignments = (data as AssignmentWithLabCount[]) ?? [];
      if (allAssignments.length === 0) { setAssignments([]); setLoading(false); return; }

      const assignIds = allAssignments.map((a) => a.id);
      const { data: labLinks } = await supabase
        .from('assignment_labs')
        .select('assignment_id')
        .in('assignment_id', assignIds);

      const counts = new Map<string, number>();
      for (const l of (labLinks ?? []) as { assignment_id: string }[]) {
        counts.set(l.assignment_id, (counts.get(l.assignment_id) ?? 0) + 1);
      }

      setAssignments(allAssignments.map((a) => ({ ...a, lab_count: counts.get(a.id) ?? 0 })));
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <LoadingSpinner label="Chargement des TP et devoirs..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="TP & Devoirs"
        subtitle="Vos travaux pratiques, devoirs et examens"
      />

      {assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6 text-cyber-text-muted" />}
          title="Aucun TP ou devoir"
          description={profile?.role === 'etudiant' ? 'Vos formateurs n\'ont pas encore publié de TP' : 'Créez un TP depuis la gestion des assignments'}
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
            return (
              <Link
                key={assignment.id}
                to={`/assignments/${assignment.id}`}
                className="card-hover p-5 group flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-cyber-surface-hover rounded-lg flex items-center justify-center border border-cyber-border flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-cyber-text-dim" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-cyber-text group-hover:text-[#00ff9d] transition-colors">
                      {assignment.title}
                    </h3>
                    <span className={typeBadge[assignment.type]}>{typeLabel[assignment.type]}</span>
                    {!assignment.is_published && <span className="badge-draft">BROUILLON</span>}
                  </div>
                  <p className="text-sm text-cyber-text-muted line-clamp-1">
                    {assignment.description ?? 'Aucune description'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-cyber-text-muted font-mono">
                    {assignment.due_date && (
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-[#ff3355]' : ''}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {isOverdue ? 'RENDU: ' : 'À RENDRE: '}{formatDateTime(assignment.due_date)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FlaskConical className="w-3.5 h-3.5" />
                      {assignment.lab_count} lab(s)
                    </span>
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-[#ff3355]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        EN RETARD
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-cyber-text-muted group-hover:text-[#00ff9d] transition-colors flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
