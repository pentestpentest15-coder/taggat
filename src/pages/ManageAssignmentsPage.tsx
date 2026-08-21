import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, X, Save, FlaskConical, ListChecks, Map, Eye, CircleCheck as CheckCircle2, Clock, BookOpen } from 'lucide-react';
import { supabase, type Assignment, type Course, type Lab, type AssignmentQuestion, type GuidedModule, type GuidedStep } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Toast } from '@/components/ui';

const typeBadge: Record<string, string> = { tp: 'badge-tp', devoir: 'badge-devoir', examen: 'badge-examen' };
const typeLabel: Record<string, string> = { tp: 'TP', devoir: 'Devoir', examen: 'Examen' };

export default function ManageAssignmentsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [coursesModal, setCoursesModal] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Assignment | null>(null);
  const [labsModal, setLabsModal] = useState<Assignment | null>(null);
  const [questionsModal, setQuestionsModal] = useState<Assignment | null>(null);
  const [guidedModal, setGuidedModal] = useState<Assignment | null>(null);
  const [submissionsModal, setSubmissionsModal] = useState<Assignment | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', type: 'tp' as Assignment['type'],
    due_date: '', is_published: false, duration_min: '',
  });

  async function load() {
    if (!profile) return;
    let assignQuery = supabase.from('assignments').select('*').order('created_at', { ascending: false });
    if (profile.role === 'formateur') assignQuery = assignQuery.eq('created_by', profile.id);
    const { data: assignData, error: assignErr } = await assignQuery;
    if (assignErr) { setToast({ message: `Erreur TP: ${assignErr.message}`, type: 'error' }); }
    setAssignments((assignData as Assignment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [profile]);

  function openCreate() {
    setForm({ title: '', description: '', type: 'tp', due_date: '', is_published: false, duration_min: '' });
    setEditModal({} as Assignment);
  }

  function openEdit(a: Assignment) {
    setForm({
      title: a.title, description: a.description ?? '', type: a.type,
      due_date: a.due_date ? new Date(a.due_date).toISOString().slice(0, 16) : '', is_published: a.is_published,
      duration_min: a.duration_min ? String(a.duration_min) : '',
    });
    setEditModal(a);
  }

  async function handleSave() {
    if (!form.title.trim()) { setToast({ message: 'Titre requis', type: 'error' }); return; }
    const payload = {
      ...form,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      duration_min: form.duration_min ? parseInt(form.duration_min, 10) : null,
    };
    if (editModal?.id) {
      const { error } = await supabase.from('assignments').update(payload).eq('id', editModal.id);
      if (error) { setToast({ message: error.message, type: 'error' }); return; }
      setToast({ message: 'Assignment modifié', type: 'success' });
    } else {
      const { error } = await supabase.from('assignments').insert({ ...payload, created_by: profile?.id });
      if (error) { setToast({ message: `Erreur: ${error.message}`, type: 'error' }); return; }
      setToast({ message: 'Assignment créé', type: 'success' });
    }
    setEditModal(null);
    load();
  }

  async function handleDelete(a: Assignment) {
    if (!confirm(`Supprimer "${a.title}" ?`)) return;
    await supabase.from('assignments').delete().eq('id', a.id);
    setToast({ message: 'Supprimé', type: 'info' });
    load();
  }

  if (loading) return <LoadingSpinner label="Chargement..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gérer TP & Devoirs"
        subtitle="Créez des travaux pratiques, devoirs et examens"
        action={<button onClick={openCreate} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Nouveau</button>}
      />

      {assignments.length === 0 ? (
        <EmptyState icon={<ClipboardList className="w-6 h-6 text-cyber-text-muted" />} title="Aucun assignment" description="Créez votre premier TP, devoir ou examen" />
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-cyber-surface-hover rounded-lg flex items-center justify-center border border-cyber-border flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-cyber-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-cyber-text">{a.title}</h3>
                  <span className={typeBadge[a.type]}>{typeLabel[a.type]}</span>
                  {!a.is_published && <span className="badge-draft">Brouillon</span>}
                </div>
                <p className="text-xs text-cyber-text-muted">{typeLabel[a.type]}{a.is_published ? '' : ' · Brouillon'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCoursesModal(a)} className="btn-ghost text-sm" title="Cours associés"><BookOpen className="w-4 h-4" /></button>
                <button onClick={() => setQuestionsModal(a)} className="btn-ghost text-sm" title="Questionnaire QCM"><ListChecks className="w-4 h-4" /></button>
                <button onClick={() => setGuidedModal(a)} className="btn-ghost text-sm" title="Exercices guidés"><Map className="w-4 h-4" /></button>
                <button onClick={() => setSubmissionsModal(a)} className="btn-ghost text-sm" title="Suivi des étudiants"><Eye className="w-4 h-4" /></button>
                <button onClick={() => setLabsModal(a)} className="btn-ghost text-sm" title="Labs"><FlaskConical className="w-4 h-4" /></button>
                <button onClick={() => openEdit(a)} className="btn-ghost text-sm"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(a)} className="btn-ghost text-sm text-[#ff3355]"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={editModal?.id ? 'Modifier' : 'Nouveau assignment'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Titre *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="TP SQL Injection" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px] resize-y" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Assignment['type'] })} className="input">
              <option value="tp">TP</option>
              <option value="devoir">Devoir</option>
              <option value="examen">Examen</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Date limite</label>
            <input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Durée (minutes)</label>
            <input type="number" min="1" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} className="input" placeholder="Ex: 60" />
            <p className="text-xs text-cyber-text-muted mt-1">Laissez vide si pas de limite de temps</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded border-cyber-border bg-[#0a0e14] text-[#00ff9d] focus:ring-[#00ff9d]/30" />
            <span className="text-sm text-cyber-text-dim">Publier (visible par les étudiants)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditModal(null)} className="btn-secondary flex-1"><X className="w-4 h-4" /> Annuler</button>
            <button onClick={handleSave} className="btn-primary flex-1"><Save className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Courses modal */}
      {coursesModal && <AssignmentCoursesModal assignment={coursesModal} onClose={() => setCoursesModal(null)} />}

      {/* Labs modal */}
      {labsModal && <AssignmentLabsModal assignment={labsModal} onClose={() => setLabsModal(null)} />}

      {/* Questions modal */}
      {questionsModal && <AssignmentQuestionsModal assignment={questionsModal} onClose={() => setQuestionsModal(null)} />}

      {/* Guided exercises modal */}
      {guidedModal && <GuidedExercisesModal assignment={guidedModal} onClose={() => setGuidedModal(null)} />}

      {/* Submissions / student tracking modal */}
      {submissionsModal && <SubmissionsModal assignment={submissionsModal} onClose={() => setSubmissionsModal(null)} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function AssignmentLabsModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const { profile } = useAuth();
  const [allLabs, setAllLabs] = useState<Lab[]>([]);
  const [assignLabIds, setAssignLabIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      let query = supabase.from('labs').select('*').order('title');
      if (profile.role === 'formateur') query = query.eq('created_by', profile.id);
      const { data: labs } = await query;
      setAllLabs((labs as Lab[]) ?? []);

      const { data: al } = await supabase.from('assignment_labs').select('lab_id').eq('assignment_id', assignment.id);
      setAssignLabIds(new Set((al ?? []).map((r: { lab_id: string }) => r.lab_id)));
      setLoading(false);
    }
    load();
  }, [assignment.id, profile]);

  async function toggleLab(labId: string) {
    if (assignLabIds.has(labId)) {
      await supabase.from('assignment_labs').delete().eq('assignment_id', assignment.id).eq('lab_id', labId);
      setAssignLabIds((prev) => { const next = new Set(prev); next.delete(labId); return next; });
    } else {
      await supabase.from('assignment_labs').insert({ assignment_id: assignment.id, lab_id: labId });
      setAssignLabIds((prev) => new Set(prev).add(labId));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Labs — ${assignment.title}`} size="lg">
      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : allLabs.length === 0 ? (
        <p className="text-center text-cyber-text-muted py-4 text-sm">Aucun lab disponible.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {allLabs.map((lab) => (
            <div key={lab.id} className="flex items-center gap-3 p-3 bg-[#0a0e14] rounded-lg border border-cyber-border">
              <div className="w-8 h-8 bg-cyber-surface-hover rounded-lg flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-cyber-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cyber-text truncate">{lab.title}</p>
                <p className="text-xs text-cyber-text-muted">{lab.difficulty}</p>
              </div>
              <button onClick={() => toggleLab(lab.id)} className={assignLabIds.has(lab.id) ? 'btn-danger text-sm' : 'btn-primary text-sm'}>
                {assignLabIds.has(lab.id) ? 'Retirer' : 'Ajouter'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AssignmentQuestionsModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const [questions, setQuestions] = useState<AssignmentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssignmentQuestion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    question_text: '',
    choices: ['', '', '', ''],
    correct_index: 0,
    points: 1,
  });

  async function load() {
    const { data, error } = await supabase
      .from('assignment_questions')
      .select('*')
      .eq('assignment_id', assignment.id)
      .order('sort_order', { ascending: true });
    if (error) { setToast(`Erreur: ${error.message}`); }
    setQuestions((data as AssignmentQuestion[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [assignment.id]);

  function openCreate() {
    setForm({ question_text: '', choices: ['', '', '', ''], correct_index: 0, points: 1 });
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(q: AssignmentQuestion) {
    setForm({
      question_text: q.question_text,
      choices: q.choices.length >= 2 ? q.choices : [...q.choices, '', ''].slice(0, 4),
      correct_index: q.correct_index,
      points: q.points,
    });
    setEditing(q);
    setShowForm(true);
  }

  async function handleSave() {
    const cleanChoices = form.choices.map((c) => c.trim()).filter(Boolean);
    if (!form.question_text.trim() || cleanChoices.length < 2) {
      setToast('Question et au moins 2 choixs requis');
      return;
    }
    if (form.correct_index >= cleanChoices.length) {
      setToast('Index de réponse correcte invalide');
      return;
    }
    const payload = {
      assignment_id: assignment.id,
      question_text: form.question_text.trim(),
      choices: cleanChoices,
      correct_index: form.correct_index,
      points: form.points,
      sort_order: editing?.sort_order ?? questions.length,
    };
    if (editing) {
      const { error } = await supabase.from('assignment_questions').update(payload).eq('id', editing.id);
      if (error) { setToast(error.message); return; }
      setToast('Question modifiée');
    } else {
      const { error } = await supabase.from('assignment_questions').insert(payload);
      if (error) { setToast(error.message); return; }
      setToast('Question ajoutée');
    }
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function handleDelete(q: AssignmentQuestion) {
    if (!confirm('Supprimer cette question ?')) return;
    await supabase.from('assignment_questions').delete().eq('id', q.id);
    setToast('Question supprimée');
    load();
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <Modal open onClose={onClose} title={`Questionnaire — ${assignment.title}`} size="lg">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-cyber-text-muted">
          {questions.length} question(s) — {totalPoints} point(s) au total
        </p>
        {!showForm && (
          <button onClick={openCreate} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Ajouter une question</button>
        )}
      </div>

      {showForm && (
        <div className="card p-4 mb-4 space-y-3 bg-[#0a0e14] border-cyber-border">
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Question *</label>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              className="input min-h-[60px] resize-y"
              placeholder="Quelle est la réponse à..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Choix de réponses (cochez la bonne réponse)</label>
            <div className="space-y-2">
              {form.choices.map((choice, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correct_index === i}
                    onChange={() => setForm({ ...form, correct_index: i })}
                    className="w-4 h-4 text-[#00ff9d] bg-[#0a0e14] border-cyber-border focus:ring-[#00ff9d]/30"
                  />
                  <input
                    value={choice}
                    onChange={(e) => {
                      const next = [...form.choices];
                      next[i] = e.target.value;
                      setForm({ ...form, choices: next });
                    }}
                    className="input flex-1"
                    placeholder={`Choix ${i + 1}`}
                  />
                  {form.choices.length > 2 && (
                    <button
                      onClick={() => {
                        const next = form.choices.filter((_, idx) => idx !== i);
                        const newCorrect = form.correct_index >= i && form.correct_index > 0 ? form.correct_index - 1 : 0;
                        setForm({ ...form, choices: next, correct_index: newCorrect });
                      }}
                      className="btn-ghost text-sm text-[#ff3355]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.choices.length < 6 && (
              <button
                onClick={() => setForm({ ...form, choices: [...form.choices, ''] })}
                className="btn-ghost text-sm mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter un choix
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-cyber-text-dim">Points</label>
            <input
              type="number"
              min="1"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: parseInt(e.target.value, 10) || 1 })}
              className="input w-24"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1"><X className="w-4 h-4" /> Annuler</button>
            <button onClick={handleSave} className="btn-primary flex-1"><Save className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : questions.length === 0 ? (
        <EmptyState icon={<ListChecks className="w-6 h-6 text-cyber-text-muted" />} title="Aucune question" description="Ajoutez des questions à choix multiple" />
      ) : (
        <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
          {questions.map((q, i) => (
            <div key={q.id} className="card p-4 bg-[#0a0e14] border-cyber-border">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-cyber-surface-hover rounded-lg flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cyber-text mb-2">{q.question_text}</p>
                  <div className="space-y-1">
                    {q.choices.map((choice, idx) => (
                      <div key={idx} className={`flex items-center gap-2 text-xs ${idx === q.correct_index ? 'text-[#00ff9d]' : 'text-cyber-text-muted'}`}>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${idx === q.correct_index ? 'border-[#00ff9d] bg-[#00ff9d]/10' : 'border-cyber-border'}`}>
                          {idx === q.correct_index && <span className="w-1.5 h-1.5 bg-[#00ff9d] rounded-full" />}
                        </span>
                        {choice}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-cyber-text-muted mt-2">{q.points} point(s)</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(q)} className="btn-ghost text-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(q)} className="btn-ghost text-sm text-[#ff3355]"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </Modal>
  );
}

function GuidedExercisesModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const [modules, setModules] = useState<(GuidedModule & { steps: GuidedStep[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<GuidedModule | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [showStepForm, setShowStepForm] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<GuidedStep | null>(null);
  const [stepForm, setStepForm] = useState({ instruction: '', expected_answer: '', hint: '', points: 1 });

  async function load() {
    const { data: modData, error: modErr } = await supabase
      .from('guided_modules')
      .select('*')
      .eq('assignment_id', assignment.id)
      .order('sort_order');
    if (modErr) { setToast(modErr.message); setLoading(false); return; }
    const mods = (modData as GuidedModule[]) ?? [];

    const { data: stepData, error: stepErr } = await supabase
      .from('guided_steps')
      .select('*')
      .in('module_id', mods.map((m) => m.id))
      .order('sort_order');
    if (stepErr) { setToast(stepErr.message); setLoading(false); return; }
    const steps = (stepData as GuidedStep[]) ?? [];

    const withSteps = mods.map((m) => ({
      ...m,
      steps: steps.filter((s) => s.module_id === m.id),
    }));
    setModules(withSteps);
    setLoading(false);
  }

  useEffect(() => { load(); }, [assignment.id]);

  function openCreateModule() {
    setModuleForm({ title: '', description: '' });
    setEditingModule(null);
    setShowModuleForm(true);
  }

  function openEditModule(m: GuidedModule) {
    setModuleForm({ title: m.title, description: m.description ?? '' });
    setEditingModule(m);
    setShowModuleForm(true);
  }

  async function handleSaveModule() {
    if (!moduleForm.title.trim()) { setToast('Titre du module requis'); return; }
    const payload = {
      assignment_id: assignment.id,
      title: moduleForm.title.trim(),
      description: moduleForm.description.trim() || null,
      sort_order: editingModule?.sort_order ?? modules.length,
    };
    if (editingModule) {
      const { error } = await supabase.from('guided_modules').update(payload).eq('id', editingModule.id);
      if (error) { setToast(error.message); return; }
      setToast('Module modifié');
    } else {
      const { error } = await supabase.from('guided_modules').insert(payload);
      if (error) { setToast(error.message); return; }
      setToast('Module ajouté');
    }
    setShowModuleForm(false);
    setEditingModule(null);
    load();
  }

  async function handleDeleteModule(m: GuidedModule) {
    if (!confirm(`Supprimer le module "${m.title}" et toutes ses étapes ?`)) return;
    await supabase.from('guided_modules').delete().eq('id', m.id);
    setToast('Module supprimé');
    load();
  }

  function openCreateStep(moduleId: string) {
    setStepForm({ instruction: '', expected_answer: '', hint: '', points: 1 });
    setEditingStep(null);
    setShowStepForm(moduleId);
  }

  function openEditStep(s: GuidedStep) {
    setStepForm({
      instruction: s.instruction,
      expected_answer: s.expected_answer,
      hint: s.hint ?? '',
      points: s.points,
    });
    setEditingStep(s);
    setShowStepForm(s.module_id);
  }

  async function handleSaveStep(moduleId: string) {
    if (!stepForm.instruction.trim() || !stepForm.expected_answer.trim()) {
      setToast('Instruction et réponse attendue requises');
      return;
    }
    const mod = modules.find((m) => m.id === moduleId);
    const payload = {
      module_id: moduleId,
      instruction: stepForm.instruction.trim(),
      expected_answer: stepForm.expected_answer.trim(),
      hint: stepForm.hint.trim() || null,
      points: stepForm.points,
      step_number: editingStep?.step_number ?? (mod?.steps.length ?? 0) + 1,
      sort_order: editingStep?.sort_order ?? mod?.steps.length ?? 0,
    };
    if (editingStep) {
      const { error } = await supabase.from('guided_steps').update(payload).eq('id', editingStep.id);
      if (error) { setToast(error.message); return; }
      setToast('Étape modifiée');
    } else {
      const { error } = await supabase.from('guided_steps').insert(payload);
      if (error) { setToast(error.message); return; }
      setToast('Étape ajoutée');
    }
    setShowStepForm(null);
    setEditingStep(null);
    load();
  }

  async function handleDeleteStep(s: GuidedStep) {
    if (!confirm('Supprimer cette étape ?')) return;
    await supabase.from('guided_steps').delete().eq('id', s.id);
    setToast('Étape supprimée');
    load();
  }

  const totalSteps = modules.reduce((sum, m) => sum + m.steps.length, 0);
  const totalPoints = modules.reduce(
    (sum, m) => sum + m.steps.reduce((s, st) => s + st.points, 0),
    0
  );

  return (
    <Modal open onClose={onClose} title={`Exercices guidés — ${assignment.title}`} size="lg">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-cyber-text-muted">
          {modules.length} module(s) — {totalSteps} étape(s) — {totalPoints} point(s)
        </p>
        {!showModuleForm && (
          <button onClick={openCreateModule} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Nouveau module
          </button>
        )}
      </div>

      {showModuleForm && (
        <div className="card p-4 mb-4 space-y-3 bg-[#0a0e14] border-cyber-border">
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Titre du module *</label>
            <input
              value={moduleForm.title}
              onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
              className="input"
              placeholder="Module 1 : Découverte réseau"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Description</label>
            <textarea
              value={moduleForm.description}
              onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
              className="input min-h-[60px] resize-y"
              placeholder="Objectif du module..."
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowModuleForm(false); setEditingModule(null); }} className="btn-secondary flex-1">
              <X className="w-4 h-4" /> Annuler
            </button>
            <button onClick={handleSaveModule} className="btn-primary flex-1">
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : modules.length === 0 ? (
        <EmptyState icon={<Map className="w-6 h-6 text-cyber-text-muted" />} title="Aucun module" description="Créez des modules avec des étapes guidées" />
      ) : (
        <div className="space-y-3 max-h-[55vh] overflow-y-auto scrollbar-thin">
          {modules.map((m, mi) => (
            <div key={m.id} className="card bg-[#0a0e14] border-cyber-border overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-cyber-surface-hover rounded-lg flex items-center justify-center text-xs font-bold text-[#00ff9d] border border-cyber-border flex-shrink-0">
                  M{mi + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cyber-text">{m.title}</p>
                  {m.description && <p className="text-xs text-cyber-text-muted mt-0.5">{m.description}</p>}
                  <p className="text-xs text-cyber-text-muted mt-1">{m.steps.length} étape(s)</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setExpandedModule(expandedModule === m.id ? null : m.id)}
                    className="btn-ghost text-sm"
                    title={expandedModule === m.id ? 'Réduire' : 'Développer'}
                  >
                    {expandedModule === m.id ? '−' : '+'}
                  </button>
                  <button onClick={() => openEditModule(m)} className="btn-ghost text-sm"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDeleteModule(m)} className="btn-ghost text-sm text-[#ff3355]"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {expandedModule === m.id && (
                <div className="border-t border-cyber-border p-3 space-y-2 bg-[#070b10]">
                  {m.steps.length === 0 && (
                    <p className="text-xs text-cyber-text-muted text-center py-2">Aucune étape. Ajoutez-en une ci-dessous.</p>
                  )}
                  {m.steps.map((s, si) => (
                    <div key={s.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0a0e14] border border-cyber-border">
                      <div className="w-6 h-6 bg-cyber-surface-hover rounded flex items-center justify-center text-[10px] font-bold text-cyber-text-dim border border-cyber-border flex-shrink-0 mt-0.5">
                        {si + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-cyber-text-dim">{s.instruction}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[#00ff9d] bg-[#00ff9d]/10 px-1.5 py-0.5 rounded">
                            Réponse: {s.expected_answer}
                          </span>
                          {s.hint && <span className="text-[10px] text-[#ffaa00]/70">Indice: {s.hint}</span>}
                          <span className="text-[10px] text-cyber-text-muted">{s.points} pt(s)</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditStep(s)} className="btn-ghost text-sm"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => handleDeleteStep(s)} className="btn-ghost text-sm text-[#ff3355]"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}

                  {showStepForm === m.id ? (
                    <div className="p-3 rounded-lg bg-[#0a0e14] border border-[#00ff9d]/20 space-y-2.5">
                      <div>
                        <label className="block text-xs font-medium text-cyber-text-dim mb-1">Instruction *</label>
                        <textarea
                          value={stepForm.instruction}
                          onChange={(e) => setStepForm({ ...stepForm, instruction: e.target.value })}
                          className="input min-h-[50px] resize-y text-sm"
                          placeholder="Identifier les machines du réseau."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-cyber-text-dim mb-1">Réponse attendue *</label>
                        <input
                          value={stepForm.expected_answer}
                          onChange={(e) => setStepForm({ ...stepForm, expected_answer: e.target.value })}
                          className="input text-sm"
                          placeholder="192.168.1.1"
                        />
                        <p className="text-[10px] text-cyber-text-muted mt-1">La comparaison est insensible à la casse et aux espaces</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-cyber-text-dim mb-1">Indice (optionnel)</label>
                          <input
                            value={stepForm.hint}
                            onChange={(e) => setStepForm({ ...stepForm, hint: e.target.value })}
                            className="input text-sm"
                            placeholder="Utilisez nmap..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-cyber-text-dim mb-1">Points</label>
                          <input
                            type="number"
                            min="1"
                            value={stepForm.points}
                            onChange={(e) => setStepForm({ ...stepForm, points: parseInt(e.target.value, 10) || 1 })}
                            className="input text-sm w-24"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setShowStepForm(null); setEditingStep(null); }} className="btn-secondary flex-1 text-sm">
                          <X className="w-3.5 h-3.5" /> Annuler
                        </button>
                        <button onClick={() => handleSaveStep(m.id)} className="btn-primary flex-1 text-sm">
                          <Save className="w-3.5 h-3.5" /> Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openCreateStep(m.id)} className="btn-ghost text-sm w-full mt-1">
                      <Plus className="w-3.5 h-3.5" /> Ajouter une étape
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </Modal>
  );
}

interface SubmissionRow {
  submission_id: string;
  student_id: string;
  full_name: string;
  email: string;
  score: number;
  max_score: number;
  submitted_at: string | null;
  started_at: string;
}

function SubmissionsModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get all course_ids linked to this assignment
      const { data: caData } = await supabase
        .from('course_assignments')
        .select('course_id')
        .eq('assignment_id', assignment.id);
      const courseIds = ((caData ?? []) as { course_id: string }[]).map((r) => r.course_id);

      let students: { id: string; full_name: string; email: string }[] = [];
      if (courseIds.length > 0) {
        const { data: enrollData } = await supabase
          .from('course_enrollments')
          .select('student:profiles!course_enrollments_student_id_fkey(id, full_name, email)')
          .in('course_id', courseIds);

        students = ((enrollData ?? []) as unknown as { student: { id: string; full_name: string; email: string } | null }[])
          .map((r) => r.student)
          .filter(Boolean) as { id: string; full_name: string; email: string }[];
        // Deduplicate students enrolled in multiple courses
        const seen = new Set<string>();
        students = students.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      }

      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('id, student_id, score, max_score, submitted_at, started_at')
        .eq('assignment_id', assignment.id)
        .order('submitted_at', { ascending: false });

      const subs = (subData ?? []) as { id: string; student_id: string; score: number; max_score: number; submitted_at: string | null; started_at: string }[];

      const subMap: Record<string, typeof subs[number]> = {};
      for (const s of subs) {
        if (!subMap[s.student_id]) subMap[s.student_id] = s;
      }

      const rows: SubmissionRow[] = students.map((st) => {
        const sub = subMap[st.id];
        return {
          submission_id: sub?.id ?? '',
          student_id: st.id,
          full_name: st.full_name,
          email: st.email,
          score: sub?.score ?? 0,
          max_score: sub?.max_score ?? 0,
          submitted_at: sub?.submitted_at ?? null,
          started_at: sub?.started_at ?? '',
        };
      });

      setSubmissions(rows.filter((r) => r.submitted_at));
      setEnrolledStudents(rows.filter((r) => !r.submitted_at));
      setLoading(false);
    }
    load();
  }, [assignment.id]);

  return (
    <Modal open onClose={onClose} title={`Suivi — ${assignment.title}`} size="lg">
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-cyber-text-muted text-center py-4">Chargement...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border text-center">
                <p className="text-2xl font-bold text-cyber-text">{enrolledStudents.length + submissions.length}</p>
                <p className="text-xs text-cyber-text-muted">Inscrits</p>
              </div>
              <div className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border text-center">
                <p className="text-2xl font-bold text-[#00ff9d]">{submissions.length}</p>
                <p className="text-xs text-cyber-text-muted">Rendus</p>
              </div>
              <div className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border text-center">
                <p className="text-2xl font-bold text-[#ffaa00]">{enrolledStudents.length}</p>
                <p className="text-xs text-cyber-text-muted">Non rendus</p>
              </div>
            </div>

            {submissions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cyber-text-dim mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> Étudiants ayant rendu le TP
                </h4>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-thin">
                  {submissions.map((r) => {
                    const pct = r.max_score > 0 ? (r.score / r.max_score) * 100 : 0;
                    return (
                      <div key={r.student_id} className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-cyber-surface-hover rounded-full flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border flex-shrink-0">
                            {r.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-cyber-text truncate">{r.full_name}</p>
                            <p className="text-xs text-cyber-text-muted truncate">{r.email}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-[#00ff9d]">{r.score}/{r.max_score}</p>
                            <p className="text-xs text-cyber-text-muted">{pct.toFixed(0)}%</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-[#0a0e14] rounded-full overflow-hidden border border-cyber-border">
                          <div
                            className="h-full bg-gradient-to-r from-[#00ff9d] to-[#00b894] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-cyber-text-muted mt-1.5">
                          Rendu le {new Date(r.submitted_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {enrolledStudents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-cyber-text-dim mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#ffaa00]" /> Étudiants n'ayant pas rendu
                </h4>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto scrollbar-thin">
                  {enrolledStudents.map((r) => (
                    <div key={r.student_id} className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border flex items-center gap-3">
                      <div className="w-8 h-8 bg-cyber-surface-hover rounded-full flex items-center justify-center text-xs font-bold text-cyber-text-muted border border-cyber-border flex-shrink-0">
                        {r.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-cyber-text-dim truncate">{r.full_name}</p>
                        <p className="text-xs text-cyber-text-muted truncate">{r.email}</p>
                      </div>
                      <span className="badge-draft text-xs">Non rendu</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {submissions.length === 0 && enrolledStudents.length === 0 && (
              <EmptyState icon={<Eye className="w-6 h-6 text-cyber-text-muted" />} title="Aucun étudiant inscrit" description="Aucun étudiant n'est inscrit à ce cours" />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function AssignmentCoursesModal({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const { profile } = useAuth();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      let query = supabase.from('courses').select('*').order('title');
      if (profile.role === 'formateur') query = query.eq('formateur_id', profile.id);
      const { data: courses } = await query;
      setAllCourses((courses as Course[]) ?? []);

      const { data: ca } = await supabase.from('course_assignments').select('course_id').eq('assignment_id', assignment.id);
      setLinkedIds(new Set((ca ?? []).map((r: { course_id: string }) => r.course_id)));
      setLoading(false);
    }
    load();
  }, [assignment.id, profile]);

  async function toggleCourse(courseId: string) {
    if (linkedIds.has(courseId)) {
      await supabase.from('course_assignments').delete().eq('course_id', courseId).eq('assignment_id', assignment.id);
      setLinkedIds((prev) => { const next = new Set(prev); next.delete(courseId); return next; });
    } else {
      await supabase.from('course_assignments').insert({ course_id: courseId, assignment_id: assignment.id });
      setLinkedIds((prev) => new Set(prev).add(courseId));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Cours associés — ${assignment.title}`} size="lg">
      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : allCourses.length === 0 ? (
        <p className="text-center text-cyber-text-muted py-4 text-sm">Aucun cours disponible. Créez d'abord un cours.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {allCourses.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 bg-[#0a0e14] rounded-lg border border-cyber-border">
              <div className="w-8 h-8 bg-[#ff2e88]/10 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#ff2e88]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cyber-text truncate">{c.title}</p>
                {c.code && <p className="text-xs text-cyber-text-muted font-mono">{c.code}</p>}
              </div>
              <button
                onClick={() => toggleCourse(c.id)}
                className={linkedIds.has(c.id) ? 'btn-danger text-sm' : 'btn-primary text-sm'}
              >
                {linkedIds.has(c.id) ? 'Retirer' : 'Associer'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
