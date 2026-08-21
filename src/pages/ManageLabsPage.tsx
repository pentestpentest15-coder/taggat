import { useEffect, useState } from 'react';
import { FlaskConical, Plus, Pencil, Trash2, Flag as FlagIcon, X, Save, Clock, Link as LinkIcon, Users, CircleCheck as CheckCircle2, Circle as XCircle, Play, Pause, Trophy, Server, BookOpen, CalendarCheck } from 'lucide-react';
import { supabase, type Lab, type Flag, type Course } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Toast } from '@/components/ui';
import { formatDuration, formatDateTime } from '@/lib/format';

export default function ManageLabsPage() {
  const { profile } = useAuth();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Lab | null>(null);
  const [flagsModal, setFlagsModal] = useState<Lab | null>(null);
  const [resultsModal, setResultsModal] = useState<Lab | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', instructions: '', difficulty: 'beginner',
    estimated_duration_min: 60, max_duration_min: 120, category: '', status: 'draft' as Lab['status'],
    machine_url: '', machine_ip: '', connection_type: 'url' as 'url' | 'ip',
  });
  const [coursesModal, setCoursesModal] = useState<Lab | null>(null);

  async function loadLabs() {
    if (!profile) return;
    let query = supabase.from('labs').select('*').order('created_at', { ascending: false });
    if (profile.role === 'formateur') query = query.eq('created_by', profile.id);
    const { data, error } = await query;
    if (error) { setToast({ message: `Erreur: ${error.message}`, type: 'error' }); }
    setLabs((data as Lab[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadLabs(); }, [profile]);

  function openCreate() {
    setForm({
      title: '', description: '', instructions: '', difficulty: 'beginner',
      estimated_duration_min: 60, max_duration_min: 120, category: '', status: 'draft',
      machine_url: '', machine_ip: '', connection_type: 'url',
    });
    setEditModal({} as Lab);
  }

  function openEdit(lab: Lab) {
    setForm({
      title: lab.title, description: lab.description ?? '', instructions: lab.instructions ?? '',
      difficulty: lab.difficulty, estimated_duration_min: lab.estimated_duration_min,
      max_duration_min: lab.max_duration_min, category: lab.category ?? '', status: lab.status,
      machine_url: lab.machine_url ?? '', machine_ip: lab.machine_ip ?? '',
      connection_type: (lab.connection_type as 'url' | 'ip') ?? 'url',
    });
    setEditModal(lab);
  }

  async function handleSave() {
    if (!form.title.trim()) { setToast({ message: 'Le titre est requis', type: 'error' }); return; }
    const payload = { ...form };
    if (editModal && editModal.id) {
      const { error } = await supabase.from('labs').update(payload).eq('id', editModal.id);
      if (error) { setToast({ message: 'Erreur lors de la modification', type: 'error' }); return; }
      setToast({ message: 'Lab modifié', type: 'success' });
    } else {
      const { error } = await supabase.from('labs').insert({ ...payload, created_by: profile?.id });
      if (error) { setToast({ message: `Erreur: ${error.message}`, type: 'error' }); return; }
      setToast({ message: 'Lab créé', type: 'success' });
    }
    setEditModal(null);
    loadLabs();
  }

  async function handleDelete(lab: Lab) {
    if (!confirm(`Supprimer le lab "${lab.title}" ?`)) return;
    const { error } = await supabase.from('labs').delete().eq('id', lab.id);
    if (error) { setToast({ message: 'Erreur lors de la suppression', type: 'error' }); return; }
    setToast({ message: 'Lab supprimé', type: 'info' });
    loadLabs();
  }

  if (loading) return <LoadingSpinner label="Chargement..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gérer les laboratoires"
        subtitle="Créez et modifiez les labs de votre catalogue"
        action={<button onClick={openCreate} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Nouveau lab</button>}
      />

      {labs.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="w-6 h-6 text-cyber-text-muted" />}
          title="Aucun laboratoire"
          description="Créez votre premier lab pour vos étudiants"
        />
      ) : (
        <div className="space-y-3">
          {labs.map((lab) => (
            <div key={lab.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#00ff9d]/10 rounded-lg flex items-center justify-center border border-[#00ff9d]/20 flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-[#00ff9d]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-cyber-text">{lab.title}</h3>
                  <span className={`badge ${lab.status === 'active' ? 'badge-active' : lab.status === 'draft' ? 'badge-draft' : 'badge-archived'}`}>
                    {lab.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-cyber-text-muted">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(lab.estimated_duration_min * 60)}</span>
                  {lab.category && <span>{lab.category}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCoursesModal(lab)} className="btn-ghost text-sm" title="Cours associés">
                  <BookOpen className="w-4 h-4" />
                </button>
                <button onClick={() => setResultsModal(lab)} className="btn-ghost text-sm" title="Résultats étudiants">
                  <Users className="w-4 h-4" />
                </button>
                <button onClick={() => setFlagsModal(lab)} className="btn-ghost text-sm" title="Gérer les flags">
                  <FlagIcon className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(lab)} className="btn-ghost text-sm" title="Modifier">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(lab)} className="btn-ghost text-sm text-[#ff3355] hover:text-red-300" title="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={editModal?.id ? 'Modifier le lab' : 'Nouveau lab'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Titre *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="SQL Injection Lab" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px] resize-y" placeholder="Brève description du lab" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Instructions</label>
            <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="input min-h-[120px] resize-y font-mono text-sm" placeholder="Instructions détaillées pour l'étudiant..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Type de connexion à la machine</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, connection_type: 'url' })}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  form.connection_type === 'url'
                    ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]'
                    : 'bg-[#0a0e14] border-cyber-border text-cyber-text-muted hover:text-cyber-text-dim'
                }`}
              >
                <LinkIcon className="w-4 h-4" /> Lien URL
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, connection_type: 'ip' })}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  form.connection_type === 'ip'
                    ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]'
                    : 'bg-[#0a0e14] border-cyber-border text-cyber-text-muted hover:text-cyber-text-dim'
                }`}
              >
                <Server className="w-4 h-4" /> Adresse IP
              </button>
            </div>
            {form.connection_type === 'url' ? (
              <>
                <label className="block text-sm font-medium text-cyber-text-dim mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-4 h-4 text-[#00ff9d]" /> Lien de la machine à exploiter
                </label>
                <input value={form.machine_url} onChange={(e) => setForm({ ...form, machine_url: e.target.value })} className="input font-mono text-sm" placeholder="http://10.0.0.1:8080 ou https://vm.example.com" />
                <p className="text-xs text-cyber-text-muted mt-1">L'étudiant verra un bouton pour ouvrir cette machine dans un nouvel onglet</p>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-cyber-text-dim mb-1.5 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-[#00ff9d]" /> Adresse IP de la machine
                </label>
                <input value={form.machine_ip} onChange={(e) => setForm({ ...form, machine_ip: e.target.value })} className="input font-mono text-sm" placeholder="192.168.1.100" />
                <p className="text-xs text-cyber-text-muted mt-1">L'adresse IP sera affichée à l'étudiant pour qu'il s'y connecte directement</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Difficulté</label>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="input">
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Catégorie</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" placeholder="Web, Réseau, Forensic..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Durée estimée (min)</label>
              <input type="number" value={form.estimated_duration_min} onChange={(e) => setForm({ ...form, estimated_duration_min: parseInt(e.target.value) || 60 })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Durée max (min)</label>
              <input type="number" value={form.max_duration_min} onChange={(e) => setForm({ ...form, max_duration_min: parseInt(e.target.value) || 120 })} className="input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Statut</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Lab['status'] })} className="input">
                <option value="draft">Brouillon</option>
                <option value="active">Actif</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditModal(null)} className="btn-secondary flex-1"><X className="w-4 h-4" /> Annuler</button>
            <button onClick={handleSave} className="btn-primary flex-1"><Save className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Courses modal */}
      {coursesModal && <LabCoursesModal lab={coursesModal} onClose={() => setCoursesModal(null)} />}

      {/* Flags modal */}
      {flagsModal && <FlagsModal lab={flagsModal} onClose={() => { setFlagsModal(null); loadLabs(); }} />}

      {/* Results modal */}
      {resultsModal && <ResultsModal lab={resultsModal} onClose={() => setResultsModal(null)} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function FlagsModal({ lab, onClose }: { lab: Lab; onClose: () => void }) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFlag, setNewFlag] = useState({ name: '', flag_value: '', points: 10, hint: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', flag_value: '', points: 10, hint: '' });
  const [flagToast, setFlagToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('flags').select('*').eq('lab_id', lab.id).order('sort_order');
      setFlags((data as Flag[]) ?? []);
      setLoading(false);
    }
    load();
  }, [lab.id]);

  async function addFlag() {
    if (!newFlag.name.trim() || !newFlag.flag_value.trim()) {
      setFlagToast({ message: 'Le nom et la valeur du flag sont requis', type: 'error' });
      return;
    }
    setAdding(true);
    const { data, error } = await supabase
      .from('flags')
      .insert({ ...newFlag, lab_id: lab.id, sort_order: flags.length })
      .select('*')
      .single();
    setAdding(false);
    if (error) {
      setFlagToast({ message: `Erreur: ${error.message}`, type: 'error' });
      return;
    }
    setFlags([...flags, data as Flag]);
    setNewFlag({ name: '', flag_value: '', points: 10, hint: '' });
    setFlagToast({ message: 'Flag ajouté', type: 'success' });
  }

  async function deleteFlag(id: string) {
    const { error } = await supabase.from('flags').delete().eq('id', id);
    if (error) {
      setFlagToast({ message: `Erreur: ${error.message}`, type: 'error' });
      return;
    }
    setFlags(flags.filter((f) => f.id !== id));
    setFlagToast({ message: 'Flag supprimé', type: 'info' });
  }

  function startEdit(flag: Flag) {
    setEditingId(flag.id);
    setEditForm({ name: flag.name, flag_value: flag.flag_value, points: flag.points, hint: flag.hint ?? '' });
  }

  async function saveEdit(id: string) {
    const { data, error } = await supabase.from('flags').update(editForm).eq('id', id).select('*').single();
    if (error) {
      setFlagToast({ message: `Erreur: ${error.message}`, type: 'error' });
      return;
    }
    setFlags(flags.map((f) => f.id === id ? data as Flag : f));
    setEditingId(null);
    setFlagToast({ message: 'Flag modifié', type: 'success' });
  }

  return (
    <Modal open onClose={onClose} title={`Flags — ${lab.title}`} size="lg">
      <div className="space-y-4">
        {/* Add new flag */}
        <div className="bg-[#0a0e14] rounded-lg p-4 border border-cyber-border space-y-3">
          <h4 className="text-sm font-semibold text-cyber-text-dim flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00ff9d]" /> Ajouter un flag
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <input value={newFlag.name} onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })} className="input text-sm" placeholder="Nom du flag" />
            <input type="number" value={newFlag.points} onChange={(e) => setNewFlag({ ...newFlag, points: parseInt(e.target.value) || 10 })} className="input text-sm" placeholder="Points" />
          </div>
          <input value={newFlag.flag_value} onChange={(e) => setNewFlag({ ...newFlag, flag_value: e.target.value })} className="input text-sm font-mono" placeholder="FLAG{valeur_du_flag}" />
          <input value={newFlag.hint} onChange={(e) => setNewFlag({ ...newFlag, hint: e.target.value })} className="input text-sm" placeholder="Indice (optionnel)" />
          <button onClick={addFlag} disabled={adding} className="btn-primary text-sm w-full">
            {adding ? <span className="w-4 h-4 border-2 border-[#0a0e14] border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> Ajouter</>}
          </button>
        </div>

        {/* Existing flags */}
        {loading ? (
          <p className="text-sm text-cyber-text-muted text-center py-4">Chargement...</p>
        ) : flags.length === 0 ? (
          <p className="text-sm text-cyber-text-muted text-center py-4">Aucun flag pour ce lab</p>
        ) : (
          <div className="space-y-2">
            {flags.map((flag, idx) => (
              <div key={flag.id} className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border">
                {editingId === flag.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input text-sm" placeholder="Nom" />
                      <input type="number" value={editForm.points} onChange={(e) => setEditForm({ ...editForm, points: parseInt(e.target.value) || 10 })} className="input text-sm" />
                    </div>
                    <input value={editForm.flag_value} onChange={(e) => setEditForm({ ...editForm, flag_value: e.target.value })} className="input text-sm font-mono" />
                    <input value={editForm.hint} onChange={(e) => setEditForm({ ...editForm, hint: e.target.value })} className="input text-sm" placeholder="Indice" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-sm flex-1">Annuler</button>
                      <button onClick={() => saveEdit(flag.id)} className="btn-primary text-sm flex-1">Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-cyber-surface-hover rounded-full flex items-center justify-center text-xs font-bold text-cyber-text-muted flex-shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cyber-text">{flag.name}</p>
                      <p className="text-xs text-cyber-text-muted font-mono truncate">{flag.flag_value}</p>
                    </div>
                    <span className="text-xs text-[#ffaa00] font-semibold">{flag.points} pts</span>
                    <button onClick={() => startEdit(flag)} className="btn-ghost text-sm"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteFlag(flag.id)} className="btn-ghost text-sm text-[#ff3355]"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {flagToast && <Toast message={flagToast.message} type={flagToast.type} onClose={() => setFlagToast(null)} />}
    </Modal>
  );
}

interface StudentResult {
  student_id: string;
  full_name: string;
  email: string;
  state: string;
  duration_sec: number;
  started_at: string;
  ended_at: string | null;
  completed_at: string | null;
  flags_solved: number;
  flags_total: number;
  points: number;
}

function ResultsModal({ lab, onClose }: { lab: Lab; onClose: () => void }) {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessions } = await supabase
        .from('activity_sessions')
        .select(`
          student_id,
          state,
          duration_sec,
          started_at,
          ended_at,
          student:profiles!activity_sessions_student_id_fkey(full_name, email)
        `)
        .eq('lab_id', lab.id)
        .order('created_at', { ascending: false });

      const sessionRows = (sessions ?? []) as unknown as {
        student_id: string;
        state: string;
        duration_sec: number;
        started_at: string;
        ended_at: string | null;
        completed_at: string | null;
        student: { full_name: string; email: string } | null;
      }[];

      if (sessionRows.length === 0) {
        setLoading(false);
        return;
      }

      const { data: flags } = await supabase
        .from('flags')
        .select('id')
        .eq('lab_id', lab.id);

      const flagIds = (flags ?? []).map((f: { id: string }) => f.id);
      const flagsTotal = flagIds.length;

      const { data: submissions } = await supabase
        .from('flag_submissions')
        .select('student_id, is_correct, points_awarded')
        .in('flag_id', flagIds);

      const subRows = (submissions ?? []) as { student_id: string; is_correct: boolean; points_awarded: number }[];

      const resultMap: Record<string, { solved: Set<string>; points: number }> = {};
      for (const s of subRows) {
        if (!resultMap[s.student_id]) resultMap[s.student_id] = { solved: new Set(), points: 0 };
        if (s.is_correct) resultMap[s.student_id].solved.add(s.student_id);
        resultMap[s.student_id].points += s.points_awarded;
      }

      const { data: correctSubs } = await supabase
        .from('flag_submissions')
        .select('student_id, flag_id, is_correct')
        .in('flag_id', flagIds)
        .eq('is_correct', true);

      const correctRows = (correctSubs ?? []) as { student_id: string; flag_id: string }[];
      const solvedMap: Record<string, Set<string>> = {};
      for (const c of correctRows) {
        if (!solvedMap[c.student_id]) solvedMap[c.student_id] = new Set();
        solvedMap[c.student_id].add(c.flag_id);
      }

      const merged: StudentResult[] = sessionRows.map((s) => ({
        student_id: s.student_id,
        full_name: s.student?.full_name ?? 'Étudiant',
        email: s.student?.email ?? '',
        state: s.state,
        duration_sec: s.duration_sec,
        started_at: s.started_at,
        ended_at: s.ended_at,
        completed_at: s.completed_at,
        flags_solved: solvedMap[s.student_id]?.size ?? 0,
        flags_total: flagsTotal,
        points: resultMap[s.student_id]?.points ?? 0,
      }));

      setResults(merged);
      setLoading(false);
    }
    load();
  }, [lab.id]);

  const stateLabels: Record<string, { label: string; cls: string }> = {
    started: { label: 'En cours', cls: 'badge-active' },
    paused: { label: 'En pause', cls: 'badge-draft' },
    completed: { label: 'Terminé', cls: 'badge bg-[#00ff9d]/10 border-[#00ff9d]/20 text-[#00ff9d]' },
  };

  return (
    <Modal open onClose={onClose} title={`Résultats — ${lab.title}`} size="lg">
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-cyber-text-muted text-center py-4">Chargement...</p>
        ) : results.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6 text-cyber-text-muted" />}
            title="Aucune activité étudiante"
            description="Aucun étudiant n'a encore ouvert ce lab"
          />
        ) : (
          <>
            <div className="grid grid-cols-12 gap-3 mb-2 text-xs text-cyber-text-muted font-medium px-2">
              <span className="col-span-3">Étudiant</span>
              <span className="col-span-2">Statut</span>
              <span className="col-span-2">Temps</span>
              <span className="col-span-2">Date de réussite</span>
              <span className="col-span-3 text-right">Flags / Points</span>
            </div>
            {results.map((r) => (
              <div key={r.student_id} className="bg-[#0a0e14] rounded-lg p-3 border border-cyber-border mb-2">
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-medium text-cyber-text truncate">{r.full_name}</p>
                    <p className="text-xs text-cyber-text-muted truncate">{r.email}</p>
                  </div>
                  <div className="col-span-2">
                    <span className={`badge ${stateLabels[r.state]?.cls ?? 'badge-draft'}`}>
                      {stateLabels[r.state]?.label ?? r.state}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm text-cyber-text-dim flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyber-text-muted" />
                    {formatDuration(r.duration_sec)}
                  </div>
                  <div className="col-span-2 text-xs text-cyber-text-dim flex items-center gap-1">
                    {r.completed_at ? (
                      <span className="flex items-center gap-1 text-[#00ff9d] font-mono">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {formatDateTime(r.completed_at)}
                      </span>
                    ) : (
                      <span className="text-cyber-text-muted">—</span>
                    )}
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-sm text-[#00ff9d] font-semibold">{r.flags_solved}/{r.flags_total}</span>
                    <span className="text-xs text-[#ffaa00] ml-2 flex items-center gap-0.5 inline-flex">
                      <Trophy className="w-3 h-3" /> {r.points} pts
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}

function LabCoursesModal({ lab, onClose }: { lab: Lab; onClose: () => void }) {
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

      const { data: cl } = await supabase.from('course_labs').select('course_id').eq('lab_id', lab.id);
      setLinkedIds(new Set((cl ?? []).map((r: { course_id: string }) => r.course_id)));
      setLoading(false);
    }
    load();
  }, [lab.id, profile]);

  async function toggleCourse(courseId: string) {
    if (linkedIds.has(courseId)) {
      await supabase.from('course_labs').delete().eq('course_id', courseId).eq('lab_id', lab.id);
      setLinkedIds((prev) => { const next = new Set(prev); next.delete(courseId); return next; });
    } else {
      await supabase.from('course_labs').insert({ course_id: courseId, lab_id: lab.id });
      setLinkedIds((prev) => new Set(prev).add(courseId));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Cours associés — ${lab.title}`} size="lg">
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
