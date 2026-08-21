import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FlaskConical, Calendar, ChevronRight, CircleAlert as AlertCircle, ListChecks, Clock, CircleCheck as CheckCircle2, Circle as XCircle, Award, Map, Send } from 'lucide-react';
import { supabase, type Assignment, type Course, type Lab, type AssignmentQuestion, type AssignmentSubmission, type GuidedModule, type GuidedStep } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, EmptyState, Toast, InfoTip, SeverityBadge, difficultyToSeverity } from '@/components/ui';
import { formatDateTime, formatDuration } from '@/lib/format';

const typeBadge: Record<string, string> = { tp: 'badge-tp', devoir: 'badge-devoir', examen: 'badge-examen' };
const typeLabel: Record<string, string> = { tp: 'TP', devoir: 'DEVOIR', examen: 'EXAMEN' };

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [questions, setQuestions] = useState<AssignmentQuestion[]>([]);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [guidedModules, setGuidedModules] = useState<(GuidedModule & { steps: GuidedStep[] })[]>([]);
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [result, setResult] = useState<{ score: number; max_score: number } | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      setAssignment(assignData as Assignment | null);

      const { data: caData } = await supabase
        .from('course_assignments')
        .select('course:courses(*)')
        .eq('assignment_id', id);
      setCourses(((caData ?? []) as unknown as { course: Course }[]).map((r) => r.course).filter(Boolean) as Course[]);

      const { data: labData } = await supabase
        .from('assignment_labs')
        .select('lab:labs(*)')
        .eq('assignment_id', id)
        .order('sort_order');
      setLabs(((labData ?? []) as unknown as { lab: Lab }[]).map((r) => r.lab).filter(Boolean) as Lab[]);

      const { data: qData } = await supabase
        .from('assignment_questions')
        .select('*')
        .eq('assignment_id', id)
        .order('sort_order', { ascending: true });
      setQuestions((qData as AssignmentQuestion[]) ?? []);

      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', id)
        .eq('student_id', profile?.id ?? '')
        .maybeSingle();
      setSubmission(subData as AssignmentSubmission | null);

      const { data: modData } = await supabase
        .from('guided_modules')
        .select('*')
        .eq('assignment_id', id)
        .order('sort_order');
      const mods = (modData as GuidedModule[]) ?? [];
      if (mods.length > 0) {
        const { data: stepData } = await supabase
          .from('guided_steps')
          .select('*')
          .in('module_id', mods.map((m) => m.id))
          .order('sort_order');
        const steps = (stepData as GuidedStep[]) ?? [];
        setGuidedModules(mods.map((m) => ({ ...m, steps: steps.filter((s) => s.module_id === m.id) })));
      }

      setLoading(false);
    }
    load();
  }, [id, profile]);

  const isStaff = profile?.role === 'formateur' || profile?.role === 'admin';
  const isOverdue = assignment?.due_date ? new Date(assignment.due_date) < new Date() : false;

  const hasQuestions = questions.length > 0;
  const hasGuided = guidedModules.length > 0;
  const hasSubmitted = !!submission?.submitted_at;
  const showResult = result || hasSubmitted;

  const allQcmAnswered = questions.every((q) => answers[q.id] !== undefined);
  const allGuidedAnswered = guidedModules.flatMap((m) => m.steps).every((s) => guidedAnswers[s.id]?.trim());
  const canSubmit = (hasQuestions || hasGuided) && allQcmAnswered && allGuidedAnswered && !hasSubmitted && !isOverdue;

  async function handleCombinedSubmit() {
    if (!id) return;
    if (!canSubmit) {
      if (!allQcmAnswered && hasQuestions) {
        setToast({ message: 'Il reste des questions sans réponse', type: 'error' });
        return;
      }
      if (!allGuidedAnswered && hasGuided) {
        setToast({ message: 'Il reste des étapes guidées sans réponse', type: 'error' });
        return;
      }
      return;
    }
    setSubmitting(true);
    const qcmArray = questions.map((q) => ({
      question_id: q.id,
      selected_index: answers[q.id],
    }));
    const guidedArray = guidedModules.flatMap((m) => m.steps).map((s) => ({
      step_id: s.id,
      submitted_value: guidedAnswers[s.id],
    }));
    const { data, error } = await supabase.rpc('submit_assignment_combined', {
      p_assignment_id: id,
      p_qcm_answers: qcmArray,
      p_guided_answers: guidedArray,
    });
    setSubmitting(false);
    if (error) {
      setToast({ message: `Erreur: ${error.message}`, type: 'error' });
      return;
    }
    const res = data as { success: boolean; score: number; max_score: number; error?: string };
    if (!res.success) {
      setToast({ message: res.error ?? 'Erreur', type: 'error' });
      return;
    }
    setResult({ score: res.score, max_score: res.max_score });
    setToast({ message: `Score: ${res.score}/${res.max_score}`, type: 'success' });

    const { data: subData } = await supabase
      .from('assignment_submissions')
      .select('*')
      .eq('assignment_id', id)
      .eq('student_id', profile?.id ?? '')
      .maybeSingle();
    setSubmission(subData as AssignmentSubmission | null);
  }

  if (loading) return <LoadingSpinner label="Chargement..." />;
  if (!assignment) return <EmptyState icon={<AlertCircle className="w-6 h-6 text-cyber-text-muted" />} title="Assignment introuvable" />;

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/assignments')} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <div className="card p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#ffaa00]/3 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 bg-cyber-surface-hover rounded-xl flex items-center justify-center border border-cyber-border flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(255, 170, 0, 0.05)' }}>
            <ClipboardList className="w-7 h-7 text-[#ffaa00]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-cyber-text">{assignment.title}</h1>
              <span className={typeBadge[assignment.type]}>{typeLabel[assignment.type]}</span>
            </div>
            <p className="text-sm text-cyber-text-muted mb-3">{assignment.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-cyber-text-muted font-mono">
              {courses.length > 0 && (
                <span className="flex items-center gap-1">
                  <span>Cours: {courses.map((c) => c.title).join(', ')}</span>
                </span>
              )}
              {assignment.due_date && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-[#ff3355]' : ''}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {isOverdue ? 'RENDU: ' : 'À RENDRE: '}{formatDateTime(assignment.due_date)}
                </span>
              )}
              {assignment.duration_min && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  DURÉE: {formatDuration(assignment.duration_min * 60)}
                </span>
              )}
              {hasQuestions && (
                <span className="flex items-center gap-1">
                  <ListChecks className="w-3.5 h-3.5" />
                  {questions.length} Q
                </span>
              )}
              {hasGuided && (
                <span className="flex items-center gap-1">
                  <Map className="w-3.5 h-3.5" />
                  {guidedModules.length} MODULE(S)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score banner */}
      {showResult && submission && (
        <div className="card p-5 mb-6 border-[#00ff9d]/20" style={{ background: 'rgba(0, 255, 157, 0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center border border-[#00ff9d]/20" style={{ boxShadow: '0 0 16px rgba(0, 255, 157, 0.1)' }}>
              <Award className="w-5 h-5 text-[#00ff9d]" />
            </div>
            <div>
              <p className="text-sm font-medium text-cyber-text">
                Votre score: <span className="text-[#00ff9d] font-bold font-mono">{result?.score ?? submission.score}/{result?.max_score ?? submission.max_score}</span>
              </p>
              <p className="text-xs text-cyber-text-muted font-mono">
                {((result?.score ?? submission.score) / Math.max(1, result?.max_score ?? submission.max_score) * 100).toFixed(0)}% — Soumis le {formatDateTime(submission.submitted_at ?? submission.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Questionnaire */}
      {hasQuestions && !isStaff && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-cyber-text flex items-center gap-2 mb-4">
            <ListChecks className="w-5 h-5 text-[#00ff9d]" /> Questionnaire à choix multiple
            <InfoTip text="Questionnaire à choix multiple (QCM). Sélectionnez la bonne réponse pour chaque question." />
          </h2>

          {hasSubmitted && !result ? (
            <div className="card p-4 text-sm text-cyber-text-dim border-cyber-border font-mono">
              Vous avez déjà soumis vos réponses. Votre score: <span className="text-[#00ff9d] font-bold">{submission!.score}/{submission!.max_score}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="card p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-7 h-7 bg-cyber-surface-hover rounded-lg flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border flex-shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium text-cyber-text flex-1">{q.question_text}</p>
                    <span className="text-xs text-cyber-text-muted flex-shrink-0">{q.points} pt(s)</span>
                  </div>
                  <div className="space-y-2 ml-10">
                    {q.choices.map((choice, idx) => {
                      const selected = answers[q.id] === idx;
                      const showCorrect = hasSubmitted && !result && idx === q.correct_index;
                      const showWrong = hasSubmitted && !result && selected && idx !== q.correct_index;
                      return (
                        <button
                          key={idx}
                          onClick={() => !hasSubmitted && setAnswers({ ...answers, [q.id]: idx })}
                          disabled={hasSubmitted && !result}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                            showCorrect
                              ? 'border-[#00ff9d]/40 bg-[#00ff9d]/10'
                              : showWrong
                                ? 'border-[#ff3355]/40 bg-[#ff3355]/10'
                                : selected
                                  ? 'border-[#00ff9d]/40 bg-[#00ff9d]/5'
                                  : 'border-cyber-border bg-cyber-bg hover:border-cyber-border-light'
                          } ${hasSubmitted && !result ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            showCorrect
                              ? 'border-[#00ff9d] bg-[#00ff9d]/20'
                              : showWrong
                                ? 'border-[#ff3355] bg-[#ff3355]/20'
                                : selected
                                  ? 'border-[#00ff9d] bg-[#00ff9d]'
                                  : 'border-cyber-border-light'
                          }`}>
                            {(selected || showCorrect) && <span className="w-2 h-2 bg-[#00ff9d] rounded-full" />}
                          </span>
                          <span className={`text-sm ${showCorrect ? 'text-[#00ff9d]' : showWrong ? 'text-[#ff3355]' : 'text-cyber-text-dim'}`}>
                            {choice}
                          </span>
                          {showCorrect && <CheckCircle2 className="w-4 h-4 text-[#00ff9d] ml-auto" />}
                          {showWrong && <XCircle className="w-4 h-4 text-[#ff3355] ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guided exercises */}
      {hasGuided && !isStaff && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-cyber-text flex items-center gap-2 mb-4">
            <Map className="w-5 h-5 text-[#00ff9d]" /> Exercices guidés
            <InfoTip text="Exercices pas-à-pas: suivez les instructions et saisissez la réponse attendue pour chaque étape." />
          </h2>

          {hasSubmitted && !result ? (
            <div className="card p-4 text-sm text-cyber-text-dim border-cyber-border font-mono">
              Vous avez déjà soumis vos réponses. Votre score: <span className="text-[#00ff9d] font-bold">{submission!.score}/{submission!.max_score}</span>
            </div>
          ) : (
            <div className="space-y-5">
              {guidedModules.map((mod, mi) => (
                <div key={mod.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-cyber-border">
                    <div className="w-8 h-8 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center text-xs font-bold text-[#00ff9d] border border-[#00ff9d]/20 flex-shrink-0 font-mono">
                      M{mi + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cyber-text">{mod.title}</p>
                      {mod.description && <p className="text-xs text-cyber-text-muted mt-0.5">{mod.description}</p>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {mod.steps.map((step, si) => (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className="w-7 h-7 bg-cyber-surface-hover rounded-lg flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border flex-shrink-0 mt-0.5 font-mono">
                          {si + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-cyber-text-dim mb-2">{step.instruction}</p>
                          <div className="flex items-center gap-2">
                            <input
                              value={guidedAnswers[step.id] ?? ''}
                              onChange={(e) => setGuidedAnswers({ ...guidedAnswers, [step.id]: e.target.value })}
                              disabled={hasSubmitted && !result}
                              className="input flex-1 text-sm"
                              placeholder="Votre réponse..."
                            />
                            <span className="text-xs text-cyber-text-muted flex-shrink-0">{step.points} pt(s)</span>
                          </div>
                          {step.hint && (
                            <p className="text-xs text-[#ffaa00]/60 mt-1.5 flex items-center gap-1 font-mono">
                              <AlertCircle className="w-3 h-3" /> INDICE: {step.hint}
                            </p>
                          )}
                          {result && (
                            <p className={`text-xs mt-1.5 font-medium ${result ? 'text-cyber-text-muted' : ''}`}>
                              {guidedAnswers[step.id]?.trim().toLowerCase() === step.expected_answer.trim().toLowerCase() ? (
                                <span className="text-[#00ff9d] flex items-center gap-1 font-mono"><CheckCircle2 className="w-3.5 h-3.5" /> CORRECT — {step.expected_answer}</span>
                              ) : (
                                <span className="text-[#ff3355] flex items-center gap-1 font-mono"><XCircle className="w-3.5 h-3.5" /> INCORRECT — {step.expected_answer}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single submit button for both exercise types */}
      {!isStaff && (hasQuestions || hasGuided) && !hasSubmitted && (
        <div className="mb-6">
          <button
            onClick={handleCombinedSubmit}
            disabled={!canSubmit || submitting}
            className="btn-primary w-full"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-[#080b12] border-t-transparent rounded-full animate-spin" />
                Soumission...
              </span>
            ) : (
              <><Send className="w-4 h-4" /> Soumettre mes réponses</>
            )}
          </button>
          {!canSubmit && !hasSubmitted && !isOverdue && (hasQuestions || hasGuided) && (
            <p className="text-xs text-cyber-text-muted text-center mt-2 font-mono">
              {hasQuestions && !allQcmAnswered ? 'Répondez à toutes les questions. ' : ''}
              {hasGuided && !allGuidedAnswered ? 'Complétez toutes les étapes guidées.' : ''}
            </p>
          )}
          {isOverdue && (
            <p className="text-xs text-[#ff3355] text-center mt-2 font-mono">La date limite est dépassée.</p>
          )}
        </div>
      )}

      {/* Labs */}
      <h2 className="text-lg font-semibold text-cyber-text flex items-center gap-2 mb-4">
        <FlaskConical className="w-5 h-5 text-[#00ff9d]" /> Laboratoires à compléter
        <InfoTip text="Les labs associés à ce TP/devoir. Complétez-les pour trouver les flags et gagner des points." />
      </h2>

      {labs.length === 0 ? (
        <EmptyState icon={<FlaskConical className="w-6 h-6 text-cyber-text-muted" />} title="Aucun lab" description="Les labs seront ajoutés par le formateur" />
      ) : (
        <div className="space-y-2">
          {labs.map((lab) => (
            <Link key={lab.id} to={`/labs/${lab.id}`} className="card-hover p-4 flex items-center gap-3 group">
              <div className="w-9 h-9 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center border border-[#00ff9d]/20">
                <FlaskConical className="w-4 h-4 text-[#00ff9d]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-cyber-text group-hover:text-[#00ff9d] transition-colors">{lab.title}</p>
                <p className="text-xs text-cyber-text-muted font-mono">{lab.difficulty} — {lab.estimated_duration_min}min</p>
              </div>
              <SeverityBadge level={difficultyToSeverity(lab.difficulty)} showIcon={false} />
              <ChevronRight className="w-4 h-4 text-cyber-text-muted group-hover:text-[#00ff9d] transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
