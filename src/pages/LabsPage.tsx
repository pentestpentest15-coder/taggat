import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Clock, Tag, ChevronRight, Search, Terminal } from 'lucide-react';
import { supabase, type Lab } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, SeverityBadge, difficultyToSeverity, InfoTip } from '@/components/ui';
import { formatDuration } from '@/lib/format';

export default function LabsPage() {
  const { profile } = useAuth();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  useEffect(() => {
    async function load() {
      let query = supabase.from('labs').select('*').order('created_at', { ascending: false });
      if (profile?.role === 'etudiant') {
        query = query.eq('status', 'active');
      }
      const { data } = await query;
      setLabs((data as Lab[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  const filtered = labs.filter((lab) => {
    const matchesSearch = !search ||
      lab.title.toLowerCase().includes(search.toLowerCase()) ||
      lab.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || lab.difficulty === filter;
    return matchesSearch && matchesFilter;
  });

  const difficultyLabels: Record<string, string> = {
    beginner: 'Débutant',
    intermediate: 'Intermédiaire',
    advanced: 'Avancé',
  };

  if (loading) return <LoadingSpinner label="Chargement des laboratoires..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Catalogue des laboratoires"
        subtitle="Explorez les labs disponibles et soumettez vos flags"
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
          <input type="text" placeholder="Rechercher un lab..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <div className="flex gap-2">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all font-mono ${
                filter === f
                  ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]'
                  : 'bg-cyber-bg border-cyber-border text-cyber-text-muted hover:text-cyber-text-dim'
              }`}
            >
              {f === 'all' ? 'TOUS' : difficultyLabels[f].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FlaskConical className="w-6 h-6 text-cyber-text-muted" />} title="Aucun laboratoire trouvé" description="Essayez de modifier vos critères de recherche" />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lab) => (
            <Link key={lab.id} to={`/labs/${lab.id}`} className="card-hover p-5 group flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center border border-[#00ff9d]/20" style={{ boxShadow: '0 0 12px rgba(0, 255, 157, 0.05)' }}>
                  <FlaskConical className="w-5 h-5 text-[#00ff9d]" />
                </div>
                <SeverityBadge level={difficultyToSeverity(lab.difficulty)} />
              </div>

              <h3 className="font-semibold text-cyber-text mb-1 group-hover:text-[#00ff9d] transition-colors">
                {lab.title}
              </h3>
              <p className="text-sm text-cyber-text-muted line-clamp-2 mb-4 flex-1">
                {lab.description ?? 'Aucune description'}
              </p>

              <div className="flex items-center gap-3 text-xs text-cyber-text-muted pt-3 border-t border-cyber-border font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(lab.estimated_duration_min * 60)}
                </span>
                {lab.category && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    {lab.category}
                  </span>
                )}
                {profile?.role !== 'etudiant' && (
                  <span className={`badge ${lab.status === 'active' ? 'badge-active' : lab.status === 'draft' ? 'badge-draft' : 'badge-archived'}`}>
                    {lab.status === 'active' ? 'ACTIF' : lab.status === 'draft' ? 'BROUILLON' : 'ARCHIVÉ'}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 ml-auto text-cyber-text-muted group-hover:text-[#00ff9d] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
