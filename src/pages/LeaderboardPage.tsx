import { useEffect, useState } from 'react';
import { Trophy, Medal, Award, ChevronRight, Crown } from 'lucide-react';
import { supabase, type LeaderboardEntry } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, InfoTip } from '@/components/ui';

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('leaderboard');
      setEntries((data as LeaderboardEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Chargement du classement..." />;

  const myEntry = entries.find((e) => e.student_id === profile?.id);
  const myRank = myEntry?.rank ?? '—';
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Classement"
        subtitle="Comparez votre score avec les autres étudiants"
      />

      {/* My rank highlight */}
      {profile?.role === 'etudiant' && myEntry && (
        <div className="card p-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#00ff9d]/5 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-[#00ff9d]/10 rounded-xl flex items-center justify-center border border-[#00ff9d]/20" style={{ boxShadow: '0 0 16px rgba(0, 255, 157, 0.1)' }}>
              <span className="text-lg font-bold text-[#00ff9d] font-mono">#{myRank}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-cyber-text-dim font-mono">VOTRE RANG</p>
              <p className="font-semibold text-cyber-text">{profile.full_name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#00ff9d] font-mono">{myEntry.total_score}</p>
              <p className="text-xs text-cyber-text-muted font-mono">POINTS</p>
            </div>
          </div>
        </div>
      )}

      {/* Podium - Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {top3.map((entry, idx) => {
            const isMe = entry.student_id === profile?.id;
            const podiumConfig = [
              { icon: Crown, color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.1)', border: 'rgba(255, 170, 0, 0.25)', label: '1ER' },
              { icon: Medal, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)', label: '2ÈME' },
              { icon: Award, color: '#cd7f32', bg: 'rgba(205, 127, 50, 0.1)', border: 'rgba(205, 127, 50, 0.25)', label: '3ÈME' },
            ];
            const c = podiumConfig[idx];
            const Icon = c.icon;
            return (
              <div key={entry.student_id} className="card p-5 text-center relative overflow-hidden" style={idx === 0 ? { borderColor: c.border } : {}}>
                {idx === 0 && <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ background: c.bg }} />}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border" style={{ background: c.bg, borderColor: c.border, boxShadow: `0 0 16px ${c.bg}` }}>
                    <Icon className="w-6 h-6" style={{ color: c.color }} />
                  </div>
                  <p className="text-xs font-mono mb-1" style={{ color: c.color }}>{c.label}</p>
                  <p className="text-sm font-medium text-cyber-text truncate">{entry.full_name}{isMe && <span className="text-[#00ff9d] ml-1 text-xs">(Vous)</span>}</p>
                  <p className="text-xl font-bold font-mono mt-1" style={{ color: c.color }}>{entry.total_score}</p>
                  <p className="text-xs text-cyber-text-muted font-mono">{entry.flags_found} flags</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-3 border-b border-cyber-border grid grid-cols-12 gap-4 text-xs font-semibold text-cyber-text-muted uppercase tracking-wider font-mono">
            <div className="col-span-1">RANG</div>
            <div className="col-span-6">ÉTUDIANT</div>
            <div className="col-span-2 text-right">FLAGS</div>
            <div className="col-span-3 text-right">SCORE</div>
          </div>
          <div className="divide-y divide-cyber-border">
            {rest.map((entry) => {
              const isMe = entry.student_id === profile?.id;
              return (
                <div
                  key={entry.student_id}
                  className={`px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors ${isMe ? 'bg-[#00ff9d]/5' : 'hover:bg-cyber-bg'}`}
                >
                  <div className="col-span-1">
                    <span className="text-cyber-text-muted font-medium font-mono">{entry.rank}</span>
                  </div>
                  <div className="col-span-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-cyber-surface-hover rounded-full flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border font-mono">
                        {entry.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-medium text-cyber-text">
                          {entry.full_name}
                          {isMe && <span className="text-[#00ff9d] ml-2 text-xs font-mono">(VOUS)</span>}
                        </p>
                        {entry.promo && <p className="text-xs text-cyber-text-muted font-mono">{entry.promo}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-cyber-text-dim font-medium font-mono">
                    {entry.flags_found}
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-lg font-bold text-[#00ff9d] font-mono">{entry.total_score}</span>
                    <span className="text-xs text-cyber-text-muted ml-1 font-mono">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <EmptyState icon={<Trophy className="w-6 h-6 text-cyber-text-muted" />} title="Aucun classement disponible" description="Les étudiants n'ont pas encore de points" />
      )}
    </div>
  );
}
