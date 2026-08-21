import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Clock, Tag, Flag, CircleCheck as CheckCircle2, Circle as XCircle, Send, Lightbulb, Terminal, Server, CircleAlert as AlertCircle, Play, Pause, ExternalLink, Trophy, PartyPopper } from 'lucide-react';
import { supabase, type Lab, type StudentFlag, type VerifyFlagResult, type ActivitySession } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDuration } from '@/lib/format';
import { LoadingSpinner, EmptyState, Toast, SeverityBadge, difficultyToSeverity, InfoTip, Stepper } from '@/components/ui';
import Fireworks from '@/components/Fireworks';

export default function LabDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [lab, setLab] = useState<Lab | null>(null);
  const [flags, setFlags] = useState<StudentFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VerifyFlagResult>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activity, setActivity] = useState<ActivitySession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);
  const [labCompleted, setLabCompleted] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data: labData, error: labErr } = await supabase.from('labs').select('*').eq('id', id).maybeSingle();
      if (labErr) { setToast({ message: `Erreur: ${labErr.message}`, type: 'error' }); }
      setLab(labData as Lab | null);

      if (profile?.role === 'etudiant' && labData) {
        const { data: flagData } = await supabase.rpc('lab_flags_for_student', { p_lab_id: id });
        setFlags((flagData as StudentFlag[]) ?? []);

        const { data: actData } = await supabase
          .from('activity_sessions')
          .select('*')
          .eq('student_id', profile.id)
          .eq('lab_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setActivity(actData as ActivitySession | null);
        if (actData) {
          const act = actData as ActivitySession;
          setElapsed(act.duration_sec);
          if (act.state === 'completed') {
            setLabCompleted(true);
          }
          if (act.state === 'started') {
            const maxSec = (labData as Lab).max_duration_min * 60;
            const rem = Math.max(0, maxSec - act.duration_sec);
            setRemaining(rem);
          }
        }
      } else if (labData) {
        const { data: flagData } = await supabase.from('flags').select('*').eq('lab_id', id).order('sort_order');
        const staffFlags: StudentFlag[] = ((flagData as { id: string; name: string; points: number; hint: string | null; sort_order: number }[]) ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          points: f.points,
          hint: f.hint,
          sort_order: f.sort_order,
          is_solved: false,
        }));
        setFlags(staffFlags);
      }
      setLoading(false);
    }
    load();
  }, [id, profile]);

  useEffect(() => {
    if (autoStarted.current || !profile || !id || !lab) return;
    if (profile.role !== 'etudiant') return;
    if (activity && activity.state !== 'completed') return;
    if (labCompleted) return;
    autoStarted.current = true;
    (async () => {
      const { data, error } = await supabase
        .from('activity_sessions')
        .insert({ student_id: profile.id, lab_id: id, state: 'started' })
        .select('*')
        .single();
      if (error) {
        setToast({ message: `Erreur session: ${error.message}`, type: 'error' });
        return;
      }
      setActivity(data as ActivitySession);
      setElapsed(0);
      setRemaining((lab as Lab).max_duration_min * 60);
      setLabCompleted(false);
    })();
  }, [profile, id, lab, activity, labCompleted]);

  useEffect(() => {
    if (!activity || activity.state !== 'started') return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
      setRemaining((prev) => {
        if (prev === null) return null;
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          completeActivity(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  async function pauseActivity() {
    if (!activity || !profile) return;
    await supabase
      .from('activity_sessions')
      .update({ state: 'paused', duration_sec: elapsed, ended_at: new Date().toISOString() })
      .eq('id', activity.id);
    setActivity({ ...activity, state: 'paused', duration_sec: elapsed, ended_at: new Date().toISOString() });
  }

  async function resumeActivity() {
    if (!activity) return;
    await supabase
      .from('activity_sessions')
      .update({ state: 'started', ended_at: null })
      .eq('id', activity.id);
    setActivity({ ...activity, state: 'started', ended_at: null });
    if (lab) setRemaining(lab.max_duration_min * 60 - elapsed);
  }

  const completeActivity = useCallback(async (auto = false) => {
    if (!activity) return;
    const now = new Date().toISOString();
    await supabase
      .from('activity_sessions')
      .update({ state: 'completed', duration_sec: elapsed, ended_at: now, completed_at: now })
      .eq('id', activity.id);
    setActivity({ ...activity, state: 'completed', duration_sec: elapsed, ended_at: now, completed_at: now } as ActivitySession);
    setRemaining(null);
    setLabCompleted(true);
    if (auto) {
      setToast({ message: 'Temps écoulé — le lab a été automatiquement terminé', type: 'info' });
    }
  }, [activity, elapsed]);

  async function handleTerminate() {
    if (!allFlagsSolved) return;
    await completeActivity(false);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 6000);
  }

  async function handleSubmit(flagId: string) {
    const value = submission[flagId]?.trim();
    if (!value) return;
    setSubmitting(flagId);
    const { data, error } = await supabase.rpc('verify_flag', {
      p_flag_id: flagId,
      p_submitted_value: value,
    });
    if (error) {
      setToast({ message: `Erreur: ${error.message}`, type: 'error' });
    } else {
      const result = data as VerifyFlagResult;
      setResults((prev) => ({ ...prev, [flagId]: result }));
      setToast({ message: result.message, type: result.correct ? 'success' : 'error' });
      if (result.correct && !result.already_solved) {
        setFlags((prev) => prev.map((f) => f.id === flagId ? { ...f, is_solved: true } : f));
      }
    }
    setSubmitting(null);
  }

  if (loading) return <LoadingSpinner label="Chargement du laboratoire..." />;
  if (!lab) return (
    <EmptyState icon={<AlertCircle className="w-6 h-6 text-cyber-text-muted" />} title="Laboratoire introuvable" />
  );

  const solvedCount = flags.filter((f) => f.is_solved).length;
  const totalPoints = flags.reduce((sum, f) => sum + f.points, 0);
  const earnedPoints = flags.filter((f) => f.is_solved).reduce((sum, f) => sum + f.points, 0);
  const timeUp = remaining !== null && remaining <= 0;
  const progressPct = flags.length > 0 ? (solvedCount / flags.length) * 100 : 0;
  const allFlagsSolved = flags.length > 0 && solvedCount === flags.length;
  const currentStep = solvedCount;

  return (
    <div className="animate-fade-in">
      {showFireworks && <Fireworks />}

      <button onClick={() => navigate('/labs')} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Retour aux labs
      </button>

      {/* Lab header */}
      <div className="card p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#00ff9d]/3 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 bg-[#00ff9d]/10 rounded-xl flex items-center justify-center border border-[#00ff9d]/20 flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(0, 255, 157, 0.08)' }}>
            <FlaskConical className="w-7 h-7 text-[#00ff9d]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-cyber-text">{lab.title}</h1>
              <SeverityBadge level={difficultyToSeverity(lab.difficulty)} />
            </div>
            <p className="text-sm text-cyber-text-muted mb-3">{lab.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-cyber-text-muted font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Estimé: {formatDuration(lab.estimated_duration_min * 60)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Max: {formatDuration(lab.max_duration_min * 60)}
              </span>
              {lab.category && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  {lab.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Machine access */}
        {lab.connection_type === 'ip' && lab.machine_ip ? (
          <div className="mt-5 pt-5 border-t border-cyber-border">
            <div className="flex items-center gap-3 bg-cyber-bg rounded-lg p-4 border border-cyber-border">
              <div className="w-10 h-10 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center border border-[#00ff9d]/20 flex-shrink-0">
                <Server className="w-5 h-5 text-[#00ff9d]" />
              </div>
              <div>
                <p className="text-xs text-cyber-text-muted mb-0.5 font-mono">ADRESSE IP DE LA MACHINE CIBLE</p>
                <p className="text-lg font-mono font-bold text-[#00ff9d] tracking-wider">{lab.machine_ip}</p>
              </div>
            </div>
          </div>
        ) : lab.machine_url ? (
          <div className="mt-5 pt-5 border-t border-cyber-border">
            <a href={lab.machine_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm inline-flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Ouvrir la machine à exploiter
            </a>
          </div>
        ) : null}

        {/* Activity tracker */}
        {profile?.role === 'etudiant' && (
          <div className="mt-5 pt-5 border-t border-cyber-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${timeUp ? 'bg-[#ff3355]/10 border-[#ff3355]/20' : 'bg-cyber-surface-hover border-cyber-border'}`}>
                <Terminal className={`w-5 h-5 ${timeUp ? 'text-[#ff3355]' : 'text-cyber-text-dim'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-cyber-text font-mono">
                  {timeUp ? 'TEMPS ÉCOULÉ' : activity?.state === 'completed' ? 'SESSION TERMINÉE' : 'SESSION ACTIVE'}
                </p>
                <p className="text-xs text-cyber-text-muted font-mono">
                  {remaining !== null && activity?.state === 'started'
                    ? `Restant: ${formatDuration(remaining)}`
                    : `Écoulé: ${formatDuration(elapsed)}`}
                </p>
              </div>
            </div>

            {activity?.state === 'started' && !timeUp && (
              <div className="flex gap-2">
                <button onClick={pauseActivity} className="btn-secondary text-sm"><Pause className="w-4 h-4" /> Pause</button>
                <button
                  onClick={handleTerminate}
                  disabled={!allFlagsSolved}
                  className="btn-primary text-sm"
                  title={!allFlagsSolved ? 'Trouvez tous les flags pour terminer le lab' : 'Terminer le lab'}
                >
                  <PartyPopper className="w-4 h-4" /> Terminer
                </button>
              </div>
            )}
            {activity?.state === 'paused' && !timeUp && (
              <div className="flex gap-2">
                <button onClick={resumeActivity} className="btn-secondary text-sm"><Play className="w-4 h-4" /> Reprendre</button>
                <button
                  onClick={handleTerminate}
                  disabled={!allFlagsSolved}
                  className="btn-primary text-sm"
                  title={!allFlagsSolved ? 'Trouvez tous les flags pour terminer le lab' : 'Terminer le lab'}
                >
                  <PartyPopper className="w-4 h-4" /> Terminer
                </button>
              </div>
            )}
            {activity?.state === 'completed' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-cyber-text-dim font-mono">
                  Temps: <span className="text-[#00ff9d] font-semibold">{formatDuration(activity.duration_sec)}</span>
                </span>
                {labCompleted && (
                  <span className="badge bg-[#00ff9d]/10 border-[#00ff9d]/20 text-[#00ff9d]">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> RÉUSSI
                  </span>
                )}
                <button onClick={() => { setActivity(null); autoStarted.current = false; setLabCompleted(false); }} className="btn-primary text-sm">
                  <Play className="w-4 h-4" /> Nouvelle session
                </button>
              </div>
            )}
            {timeUp && activity?.state !== 'completed' && (
              <span className="badge bg-[#ff3355]/10 border-[#ff3355]/20 text-[#ff3355]">TEMPS ÉCOULÉ</span>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      {lab.instructions && (
        <div className="card p-6 mb-6">
          <h3 className="section-title mb-3">
            <Terminal className="w-4 h-4 text-[#00ff9d]" />
            Instructions
          </h3>
          <div className="terminal-block whitespace-pre-wrap leading-relaxed text-cyber-text-dim">
            {lab.instructions}
          </div>
        </div>
      )}

      {/* Progress summary with stepper */}
      {profile?.role === 'etudiant' && flags.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-[#00ff9d]" />
            <h3 className="section-title">Progression des flags</h3>
            <InfoTip text="Un flag est une chaîne de caractères (ex: FLAG{...}) cachée dans la machine cible. Trouvez-le et soumettez-le pour valider l'exercice." />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-2 font-mono">
                <span className="text-cyber-text-dim">{solvedCount}/{flags.length} flags</span>
                <span className="text-[#00ff9d] font-semibold">{earnedPoints}/{totalPoints} pts</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill progress-neon" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
          {flags.length <= 5 && (
            <Stepper
              steps={flags.map((f) => ({ label: f.name }))}
              currentStep={currentStep}
            />
          )}
          {allFlagsSolved && activity?.state !== 'completed' && (
            <div className="mt-4 p-3 rounded-lg bg-[#00ff9d]/10 border border-[#00ff9d]/20 text-sm text-[#00ff9d] flex items-center gap-2 font-mono">
              <PartyPopper className="w-4 h-4" />
              Tous les flags trouvés ! Cliquez sur « Terminer » pour valider le lab.
            </div>
          )}
        </div>
      )}

      {/* Flags */}
      <div>
        <h2 className="text-lg font-semibold text-cyber-text mb-4 flex items-center gap-2">
          <Flag className="w-5 h-5 text-[#00ff9d]" />
          Flags à valider
          <InfoTip text="Chaque flag rapporte des points. Saisissez la valeur exacte du flag (ex: FLAG{exemple123}) dans le champ correspondant." />
        </h2>

        {flags.length === 0 ? (
          <EmptyState
            icon={<Flag className="w-6 h-6 text-cyber-text-muted" />}
            title="Aucun flag pour ce lab"
            description={profile?.role === 'etudiant' ? 'Les flags seront ajoutés par le formateur' : 'Ajoutez des flags depuis la gestion des labs'}
          />
        ) : (
          <div className="space-y-3">
            {flags.map((flag, idx) => {
              const result = results[flag.id];
              const isSubmitting = submitting === flag.id;
              const disabled = flag.is_solved || isSubmitting || timeUp || labCompleted;
              return (
                <div key={flag.id} className={`card p-5 ${flag.is_solved ? 'border-[#00ff9d]/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${flag.is_solved ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30' : 'bg-cyber-surface-hover border-cyber-border'}`}>
                      {flag.is_solved ? (
                        <CheckCircle2 className="w-5 h-5 text-[#00ff9d]" />
                      ) : (
                        <span className="text-xs font-bold text-cyber-text-muted font-mono">{String(idx + 1).padStart(2, '0')}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-cyber-text">{flag.name}</h4>
                        <span className="text-xs text-[#ffaa00] font-semibold flex items-center gap-1 font-mono">
                          <Trophy className="w-3 h-3" /> {flag.points} PTS
                        </span>
                      </div>

                      {flag.hint && (
                        <div className="flex items-start gap-1.5 mt-2 text-xs text-cyber-text-muted bg-cyber-bg rounded-lg p-2.5 border border-cyber-border">
                          <Lightbulb className="w-3.5 h-3.5 text-[#ffaa00] flex-shrink-0 mt-0.5" />
                          <span>{flag.hint}</span>
                        </div>
                      )}

                      {profile?.role === 'etudiant' && (
                        <div className="flex gap-2 mt-3">
                          <input
                            type="text"
                            value={submission[flag.id] ?? ''}
                            onChange={(e) => setSubmission((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) handleSubmit(flag.id); }}
                            placeholder="FLAG{...}"
                            disabled={disabled}
                            className="input flex-1 font-mono text-sm"
                          />
                          {!flag.is_solved && (
                            <button onClick={() => handleSubmit(flag.id)} disabled={disabled || !submission[flag.id]?.trim()} className="btn-primary text-sm whitespace-nowrap">
                              {isSubmitting ? (
                                <span className="w-4 h-4 border-2 border-[#080b12] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <><Send className="w-4 h-4" /> Valider</>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {result && !result.correct && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-[#ff3355] font-mono">
                          <XCircle className="w-3.5 h-3.5" />
                          {result.message}
                        </div>
                      )}

                      {flag.is_solved && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-[#00ff9d] font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          FLAG VALIDÉ — {flag.points} POINTS
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
