import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, X, Save, Users, FlaskConical, UserPlus, UserMinus, ClipboardList, Link as LinkIcon, Server, Upload, FileText, Trash } from 'lucide-react';
import { supabase, type Course, type Profile, type Lab, type Assignment, type AssignmentType } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Toast } from '@/components/ui';
import { formatDuration } from '@/lib/format';

export default function ManageCoursesPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Course | null>(null);
  const [enrollModal, setEnrollModal] = useState<Course | null>(null);
  const [labsModal, setLabsModal] = useState<Course | null>(null);
  const [assignmentsModal, setAssignmentsModal] = useState<Course | null>(null);
  const [createLabModal, setCreateLabModal] = useState<Course | null>(null);
  const [createAssignModal, setCreateAssignModal] = useState<Course | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({ title: '', description: '', code: '', category: '', is_published: false });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [existingDocName, setExistingDocName] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function loadCourses() {
    if (!profile) return;
    let query = supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (profile.role === 'formateur') query = query.eq('formateur_id', profile.id);
    const { data, error } = await query;
    if (error) { setToast({ message: `Erreur: ${error.message}`, type: 'error' }); }
    setCourses((data as Course[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadCourses(); }, [profile]);

  function openCreate() {
    setForm({ title: '', description: '', code: '', category: '', is_published: false });
    setDocFile(null);
    setExistingDocName(null);
    setEditModal({} as Course);
  }

  function openEdit(course: Course) {
    setForm({ title: course.title, description: course.description ?? '', code: course.code ?? '', category: course.category ?? '', is_published: course.is_published });
    setDocFile(null);
    setExistingDocName(course.document_name ?? null);
    setEditModal(course);
  }

  async function handleSave() {
    if (!form.title.trim()) { setToast({ message: 'Le titre est requis', type: 'error' }); return; }
    const code = form.code.trim().toUpperCase() || null;
    setUploadingDoc(true);

    let documentPath: string | null = editModal?.document_path ?? null;
    let documentName: string | null = editModal?.document_name ?? null;

    // Upload new document if selected
    if (docFile) {
      const fileExt = docFile.name.split('.').pop() ?? 'pdf';
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('course-documents')
        .upload(filePath, docFile);
      if (uploadError) {
        setToast({ message: `Erreur upload: ${uploadError.message}`, type: 'error' });
        setUploadingDoc(false);
        return;
      }
      // Delete old document if exists
      if (editModal?.document_path) {
        await supabase.storage.from('course-documents').remove([editModal.document_path]);
      }
      documentPath = filePath;
      documentName = docFile.name;
    }

    if (editModal?.id) {
      const { error } = await supabase.from('courses').update({ ...form, code, document_path: documentPath, document_name: documentName }).eq('id', editModal.id);
      if (error) { setToast({ message: error.message, type: 'error' }); setUploadingDoc(false); return; }
      setToast({ message: 'Cours modifié', type: 'success' });
    } else {
      const { error } = await supabase.from('courses').insert({ ...form, code, document_path: documentPath, document_name: documentName, formateur_id: profile?.id });
      if (error) { setToast({ message: error.message, type: 'error' }); setUploadingDoc(false); return; }
      setToast({ message: 'Cours créé', type: 'success' });
    }
    setUploadingDoc(false);
    setEditModal(null);
    loadCourses();
  }

  async function handleRemoveDoc() {
    if (!editModal?.id || !editModal?.document_path) return;
    if (!confirm('Supprimer le document de ce cours ?')) return;
    await supabase.storage.from('course-documents').remove([editModal.document_path]);
    await supabase.from('courses').update({ document_path: null, document_name: null }).eq('id', editModal.id);
    setExistingDocName(null);
    setToast({ message: 'Document supprimé', type: 'info' });
    loadCourses();
  }

  async function handleDelete(course: Course) {
    if (!confirm(`Supprimer le cours "${course.title}" ?`)) return;
    await supabase.from('courses').delete().eq('id', course.id);
    setToast({ message: 'Cours supprimé', type: 'info' });
    loadCourses();
  }

  if (loading) return <LoadingSpinner label="Chargement..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gérer les cours"
        subtitle="Créez des cours (rooms) et inscrivez des étudiants"
        action={<button onClick={openCreate} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Nouveau cours</button>}
      />

      {courses.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-6 h-6 text-cyber-text-muted" />} title="Aucun cours" description="Créez votre premier cours" />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <div key={course.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#ff2e88]/10 rounded-lg flex items-center justify-center border border-[#ff2e88]/20 flex-shrink-0">
                <BookOpen className="w-5 h-5 text-[#ff2e88]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-cyber-text">{course.title}</h3>
                  {course.is_published
                    ? <span className="badge-active">Publié</span>
                    : <span className="badge-draft">Brouillon</span>}
                </div>
                <div className="flex items-center gap-3">
                  {course.category && <span className="text-xs text-[#00d4ff] font-mono">{course.category}</span>}
                  {course.code && <p className="text-xs text-cyber-text-muted font-mono">Code: {course.code}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLabsModal(course)} className="btn-ghost text-sm" title="Labs du cours"><FlaskConical className="w-4 h-4" /></button>
                <button onClick={() => setAssignmentsModal(course)} className="btn-ghost text-sm" title="TP/Devoirs du cours"><ClipboardList className="w-4 h-4" /></button>
                <button onClick={() => setEnrollModal(course)} className="btn-ghost text-sm" title="Étudiants"><Users className="w-4 h-4" /></button>
                <button onClick={() => openEdit(course)} className="btn-ghost text-sm"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(course)} className="btn-ghost text-sm text-[#ff3355]"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={editModal?.id ? 'Modifier le cours' : 'Nouveau cours'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Titre *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Sécurité Web 101" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px] resize-y" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Code d'inscription</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input font-mono uppercase" placeholder="SEC-2024-01" />
            <p className="text-xs text-cyber-text-muted mt-1">Les étudiants utilisent ce code pour s'inscrire</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Catégorie / Domaine</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" placeholder="Web, Réseau, Cryptographie, Forensics..." />
            <p className="text-xs text-cyber-text-muted mt-1">Regroupe les cours par domaine dans la page des cours</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Documentation du cours (PDF)</label>
            {existingDocName && !docFile ? (
              <div className="flex items-center gap-3 p-3 bg-[#0a0e14] rounded-lg border border-cyber-border">
                <FileText className="w-5 h-5 text-[#00d4ff] flex-shrink-0" />
                <span className="flex-1 text-sm text-cyber-text truncate">{existingDocName}</span>
                <button type="button" onClick={handleRemoveDoc} className="btn-ghost text-sm text-[#ff3355]"><Trash className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="doc-upload"
                />
                <label htmlFor="doc-upload" className="flex items-center gap-3 p-4 bg-[#0a0e14] rounded-lg border border-dashed border-cyber-border hover:border-[#00ff9d]/30 cursor-pointer transition-all">
                  <Upload className="w-5 h-5 text-cyber-text-muted" />
                  <span className="text-sm text-cyber-text-dim">
                    {docFile ? docFile.name : 'Cliquez pour sélectionner un fichier (PDF, DOC, TXT)'}
                  </span>
                </label>
              </div>
            )}
            <p className="text-xs text-cyber-text-muted mt-1">Les étudiants pourront consulter ce document en lecture seule dans la page du cours. Téléchargement non autorisé.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded border-cyber-border bg-[#0a0e14] text-[#00ff9d] focus:ring-[#00ff9d]/30" />
            <span className="text-sm text-cyber-text-dim">Publier le cours (visible par les étudiants)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditModal(null)} className="btn-secondary flex-1"><X className="w-4 h-4" /> Annuler</button>
            <button onClick={handleSave} disabled={uploadingDoc} className="btn-primary flex-1">
              {uploadingDoc ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" /> Upload...</span> : <><Save className="w-4 h-4" /> Enregistrer</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Enrollment modal */}
      {enrollModal && <EnrollModal course={enrollModal} onClose={() => setEnrollModal(null)} />}
      {/* Course labs modal */}
      {labsModal && <CourseLabsModal course={labsModal} onClose={() => setLabsModal(null)} onCreateLab={() => setCreateLabModal(labsModal)} />}
      {/* Course assignments modal */}
      {assignmentsModal && <CourseAssignmentsModal course={assignmentsModal} onClose={() => setAssignmentsModal(null)} onCreateAssignment={() => setCreateAssignModal(assignmentsModal)} />}
      {/* Create lab from course */}
      {createLabModal && <CreateLabModal course={createLabModal} onClose={() => setCreateLabModal(null)} onCreated={() => setLabsModal(createLabModal)} />}
      {/* Create assignment from course */}
      {createAssignModal && <CreateAssignmentModal course={createAssignModal} onClose={() => setCreateAssignModal(null)} onCreated={() => setAssignmentsModal(createAssignModal)} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function EnrollModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<(Profile & { enrolled: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data: allStudents } = await supabase.from('profiles').select('*').eq('role', 'etudiant').order('full_name');
      const { data: enrolled } = await supabase.from('course_enrollments').select('student_id').eq('course_id', course.id);
      const enrolledIds = new Set((enrolled ?? []).map((e: { student_id: string }) => e.student_id));
      const withEnrolled = ((allStudents as Profile[]) ?? []).map((s) => ({ ...s, enrolled: enrolledIds.has(s.id) }));
      setStudents(withEnrolled);
      setLoading(false);
    }
    load();
  }, [course.id]);

  async function toggleEnroll(student: Profile & { enrolled: boolean }) {
    if (student.enrolled) {
      await supabase.from('course_enrollments').delete().eq('course_id', course.id).eq('student_id', student.id);
      setStudents(students.map((s) => s.id === student.id ? { ...s, enrolled: false } : s));
    } else {
      await supabase.from('course_enrollments').insert({ course_id: course.id, student_id: student.id });
      setStudents(students.map((s) => s.id === student.id ? { ...s, enrolled: true } : s));
    }
  }

  const filtered = students.filter((s) =>
    !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal open onClose={onClose} title={`Étudiants — ${course.title}`} size="lg">
      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : (
        <div className="space-y-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input" placeholder="Rechercher un étudiant..." />
          <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-cyber-text-muted py-4 text-sm">Aucun étudiant trouvé</p>
            ) : filtered.map((student) => (
              <div key={student.id} className="flex items-center gap-3 p-3 bg-[#0a0e14] rounded-lg border border-cyber-border">
                <div className="w-8 h-8 bg-cyber-surface-hover rounded-full flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border">
                  {student.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cyber-text truncate">{student.full_name}</p>
                  <p className="text-xs text-cyber-text-muted truncate">{student.email}</p>
                </div>
                <button
                  onClick={() => toggleEnroll(student)}
                  className={student.enrolled ? 'btn-danger text-sm' : 'btn-primary text-sm'}
                >
                  {student.enrolled ? <><UserMinus className="w-3.5 h-3.5" /> Désinscrire</> : <><UserPlus className="w-3.5 h-3.5" /> Inscrire</>}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-cyber-text-muted text-center">{students.filter((s) => s.enrolled).length} étudiant(s) inscrit(s)</p>
        </div>
      )}
    </Modal>
  );
}

function CourseLabsModal({ course, onClose, onCreateLab }: { course: Course; onClose: () => void; onCreateLab: () => void }) {
  const { profile } = useAuth();
  const [allLabs, setAllLabs] = useState<Lab[]>([]);
  const [courseLabIds, setCourseLabIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    let query = supabase.from('labs').select('*').order('title');
    if (profile.role === 'formateur') query = query.eq('created_by', profile.id);
    const { data: labs } = await query;
    setAllLabs((labs as Lab[]) ?? []);

    const { data: cl } = await supabase.from('course_labs').select('lab_id').eq('course_id', course.id);
    setCourseLabIds(new Set((cl ?? []).map((r: { lab_id: string }) => r.lab_id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, [course.id, profile]);

  async function toggleLab(labId: string) {
    if (courseLabIds.has(labId)) {
      await supabase.from('course_labs').delete().eq('course_id', course.id).eq('lab_id', labId);
      setCourseLabIds((prev) => { const next = new Set(prev); next.delete(labId); return next; });
    } else {
      await supabase.from('course_labs').insert({ course_id: course.id, lab_id: labId });
      setCourseLabIds((prev) => new Set(prev).add(labId));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Labs — ${course.title}`} size="lg">
      <div className="mb-3">
        <button onClick={onCreateLab} className="btn-primary text-sm w-full"><Plus className="w-4 h-4" /> Créer un nouveau lab pour ce cours</button>
      </div>
      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : allLabs.length === 0 ? (
        <p className="text-center text-cyber-text-muted py-4 text-sm">Aucun lab disponible. Créez-en un avec le bouton ci-dessus.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {allLabs.map((lab) => (
            <div key={lab.id} className="flex items-center gap-3 p-3 bg-[#0a0e14] rounded-lg border border-cyber-border">
              <div className="w-8 h-8 bg-cyber-surface-hover rounded-lg flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-cyber-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cyber-text truncate">{lab.title}</p>
                <p className="text-xs text-cyber-text-muted">{lab.difficulty} — {lab.estimated_duration_min}min</p>
              </div>
              <button
                onClick={() => toggleLab(lab.id)}
                className={courseLabIds.has(lab.id) ? 'btn-danger text-sm' : 'btn-primary text-sm'}
              >
                {courseLabIds.has(lab.id) ? 'Retirer' : 'Ajouter'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CourseAssignmentsModal({ course, onClose, onCreateAssignment }: { course: Course; onClose: () => void; onCreateAssignment: () => void }) {
  const { profile } = useAuth();
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [courseAssignIds, setCourseAssignIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    let query = supabase.from('assignments').select('*').order('title');
    if (profile.role === 'formateur') query = query.eq('created_by', profile.id);
    const { data: assigns } = await query;
    setAllAssignments((assigns as Assignment[]) ?? []);

    const { data: ca } = await supabase.from('course_assignments').select('assignment_id').eq('course_id', course.id);
    setCourseAssignIds(new Set((ca ?? []).map((r: { assignment_id: string }) => r.assignment_id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, [course.id, profile]);

  async function toggleAssignment(assignmentId: string) {
    if (courseAssignIds.has(assignmentId)) {
      await supabase.from('course_assignments').delete().eq('course_id', course.id).eq('assignment_id', assignmentId);
      setCourseAssignIds((prev) => { const next = new Set(prev); next.delete(assignmentId); return next; });
    } else {
      await supabase.from('course_assignments').insert({ course_id: course.id, assignment_id: assignmentId });
      setCourseAssignIds((prev) => new Set(prev).add(assignmentId));
    }
  }

  const typeLabel: Record<string, string> = { tp: 'TP', devoir: 'Devoir', examen: 'Examen' };

  return (
    <Modal open onClose={onClose} title={`TP & Devoirs — ${course.title}`} size="lg">
      <div className="mb-3">
        <button onClick={onCreateAssignment} className="btn-primary text-sm w-full"><Plus className="w-4 h-4" /> Créer un nouveau TP/devoir pour ce cours</button>
      </div>
      {loading ? (
        <p className="text-center text-cyber-text-muted py-4">Chargement...</p>
      ) : allAssignments.length === 0 ? (
        <p className="text-center text-cyber-text-muted py-4 text-sm">Aucun TP/devoir disponible. Créez-en un avec le bouton ci-dessus.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {allAssignments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-[#0a0e14] rounded-lg border border-cyber-border">
              <div className="w-8 h-8 bg-cyber-surface-hover rounded-lg flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-cyber-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cyber-text truncate">{a.title}</p>
                <p className="text-xs text-cyber-text-muted">{typeLabel[a.type] ?? a.type}{a.is_published ? '' : ' · Brouillon'}</p>
              </div>
              <button
                onClick={() => toggleAssignment(a.id)}
                className={courseAssignIds.has(a.id) ? 'btn-danger text-sm' : 'btn-primary text-sm'}
              >
                {courseAssignIds.has(a.id) ? 'Retirer' : 'Ajouter'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CreateLabModal({ course, onClose, onCreated }: { course: Course; onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', difficulty: 'beginner', category: '',
    estimated_duration_min: 60, max_duration_min: 120, status: 'draft' as Lab['status'],
    connection_type: 'url' as 'url' | 'ip', machine_url: '', machine_ip: '',
  });

  async function handleSave() {
    if (!form.title.trim()) { setToast('Le titre est requis'); return; }
    setSaving(true);
    const { data: lab, error } = await supabase.from('labs').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      difficulty: form.difficulty,
      category: form.category.trim() || null,
      estimated_duration_min: form.estimated_duration_min,
      max_duration_min: form.max_duration_min,
      status: form.status,
      connection_type: form.connection_type,
      machine_url: form.connection_type === 'url' ? form.machine_url.trim() || null : null,
      machine_ip: form.connection_type === 'ip' ? form.machine_ip.trim() || null : null,
      created_by: profile?.id,
    }).select('*').single();
    setSaving(false);
    if (error) { setToast(`Erreur: ${error.message}`); return; }

    // Link lab to this course
    await supabase.from('course_labs').insert({ course_id: course.id, lab_id: (lab as Lab).id });
    onCreated();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Nouveau lab — ${course.title}`} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Titre *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="SQL Injection Lab" />
        </div>
        <div>
          <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[60px] resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Type de connexion</label>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setForm({ ...form, connection_type: 'url' })} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${form.connection_type === 'url' ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]' : 'bg-[#0a0e14] border-cyber-border text-cyber-text-muted'}`}>
              <LinkIcon className="w-4 h-4" /> Lien URL
            </button>
            <button type="button" onClick={() => setForm({ ...form, connection_type: 'ip' })} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${form.connection_type === 'ip' ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]' : 'bg-[#0a0e14] border-cyber-border text-cyber-text-muted'}`}>
              <Server className="w-4 h-4" /> Adresse IP
            </button>
          </div>
          {form.connection_type === 'url' ? (
            <input value={form.machine_url} onChange={(e) => setForm({ ...form, machine_url: e.target.value })} className="input font-mono text-sm" placeholder="http://10.0.0.1:8080" />
          ) : (
            <input value={form.machine_ip} onChange={(e) => setForm({ ...form, machine_ip: e.target.value })} className="input font-mono text-sm" placeholder="192.168.1.100" />
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
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" placeholder="Web, Réseau..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Durée estimée (min)</label>
            <input type="number" value={form.estimated_duration_min} onChange={(e) => setForm({ ...form, estimated_duration_min: parseInt(e.target.value) || 60 })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Statut</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Lab['status'] })} className="input">
              <option value="draft">Brouillon</option>
              <option value="active">Actif</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1"><X className="w-4 h-4" /> Annuler</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <span className="w-4 h-4 border-2 border-[#0a0e14] border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Créer et associer</>}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </Modal>
  );
}

function CreateAssignmentModal({ course, onClose, onCreated }: { course: Course; onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', type: 'tp' as AssignmentType,
    due_date: '', is_published: false, duration_min: '',
  });

  async function handleSave() {
    if (!form.title.trim()) { setToast('Le titre est requis'); return; }
    setSaving(true);
    const { data: assignment, error } = await supabase.from('assignments').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      is_published: form.is_published,
      duration_min: form.duration_min ? parseInt(form.duration_min, 10) : null,
      created_by: profile?.id,
    }).select('*').single();
    setSaving(false);
    if (error) { setToast(`Erreur: ${error.message}`); return; }

    // Link assignment to this course
    await supabase.from('course_assignments').insert({ course_id: course.id, assignment_id: (assignment as Assignment).id });
    onCreated();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Nouveau TP/Devoir — ${course.title}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Titre *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="TP SQL Injection" />
        </div>
        <div>
          <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[60px] resize-y" />
        </div>
        <div>
          <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssignmentType })} className="input">
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
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded border-cyber-border bg-[#0a0e14] text-[#00ff9d] focus:ring-[#00ff9d]/30" />
          <span className="text-sm text-cyber-text-dim">Publier (visible par les étudiants)</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1"><X className="w-4 h-4" /> Annuler</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <span className="w-4 h-4 border-2 border-[#0a0e14] border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Créer et associer</>}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </Modal>
  );
}
