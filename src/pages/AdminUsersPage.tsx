import { useEffect, useState } from 'react';
import { Users, Search, Shield, Terminal, User, UserCheck, UserX, Pencil, CircleCheck as CheckCircle2, Ban, Trash2, Clock, CircleAlert as AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Toast } from '@/components/ui';
import { formatDate } from '@/lib/format';

const roleBadge: Record<UserRole, string> = {
  admin: 'badge-admin',
  formateur: 'badge-formateur',
  etudiant: 'badge-etudiant',
};

const roleLabel: Record<UserRole, string> = {
  admin: 'ADMIN',
  formateur: 'FORMATEUR',
  etudiant: 'ÉTUDIANT',
};

export default function AdminUsersPage() {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | UserRole | 'pending' | 'suspended'>('all');
  const [editModal, setEditModal] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<{ role: UserRole; full_name: string; promo: string }>({
    role: 'etudiant', full_name: '', promo: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [resetModal, setResetModal] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(user: Profile) {
    setEditForm({ role: user.role, full_name: user.full_name ?? '', promo: user.promo ?? '' });
    setEditModal(user);
  }

  async function handleSave() {
    if (!editModal) return;
    const { error } = await supabase.from('profiles')
      .update({ role: editForm.role, full_name: editForm.full_name, promo: editForm.promo })
      .eq('id', editModal.id);
    if (error) { setToast({ message: error.message, type: 'error' }); return; }
    setToast({ message: 'Utilisateur modifié', type: 'success' });
    setEditModal(null);
    load();
  }

  async function approveUser(user: Profile) {
    const { error } = await supabase.from('profiles')
      .update({ is_approved: true, is_active: true })
      .eq('id', user.id);
    if (error) { setToast({ message: error.message, type: 'error' }); return; }
    setToast({ message: `${user.full_name ?? user.email} a été approuvé`, type: 'success' });
    load();
  }

  async function suspendUser(user: Profile) {
    const { error } = await supabase.from('profiles')
      .update({ is_active: false })
      .eq('id', user.id);
    if (error) { setToast({ message: error.message, type: 'error' }); return; }
    setToast({ message: `${user.full_name ?? user.email} a été suspendu`, type: 'info' });
    load();
  }

  async function reactivateUser(user: Profile) {
    const { error } = await supabase.from('profiles')
      .update({ is_active: true })
      .eq('id', user.id);
    if (error) { setToast({ message: error.message, type: 'error' }); return; }
    setToast({ message: `${user.full_name ?? user.email} a été réactivé`, type: 'success' });
    load();
  }

  function openReset(user: Profile) {
    setNewPassword('');
    setShowPassword(false);
    setResetModal(user);
  }

  async function handleResetPassword() {
    if (!resetModal || newPassword.length < 6) return;
    setResetLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setToast({ message: 'Session expirée', type: 'error' }); setResetLoading(false); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ targetUserId: resetModal.id, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setToast({ message: json.error ?? 'Échec de la réinitialisation', type: 'error' }); setResetLoading(false); return; }
      setToast({ message: `Mot de passe réinitialisé pour ${resetModal.full_name ?? resetModal.email}`, type: 'success' });
      setResetModal(null);
    } catch {
      setToast({ message: 'Erreur réseau', type: 'error' });
    }
    setResetLoading(false);
  }

  async function deleteUser(user: Profile) {
    if (!confirm(`Supprimer définitivement le compte de ${user.full_name ?? user.email} ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (error) { setToast({ message: error.message, type: 'error' }); return; }
    setToast({ message: 'Utilisateur supprimé', type: 'info' });
    load();
  }

  const filtered = users.filter((u) => {
    const matchesSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    let matchesFilter = false;
    if (filter === 'all') matchesFilter = true;
    else if (filter === 'pending') matchesFilter = !u.is_approved;
    else if (filter === 'suspended') matchesFilter = u.is_approved && !u.is_active;
    else matchesFilter = u.role === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: users.length,
    pending: users.filter((u) => !u.is_approved).length,
    suspended: users.filter((u) => u.is_approved && !u.is_active).length,
    active: users.filter((u) => u.is_approved && u.is_active).length,
  };

  if (loading) return <LoadingSpinner label="Chargement des utilisateurs..." />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Gestion des utilisateurs" subtitle="Validez, suspendez, bloquez ou supprimez les comptes" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <Users className="w-5 h-5 text-[#00d4ff]" />
            <span className="text-xs text-cyber-text-muted font-mono">TOTAL</span>
          </div>
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">utilisateurs</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <Clock className="w-5 h-5 text-[#ffaa00]" />
            <span className="text-xs text-cyber-text-muted font-mono">ATTENTE</span>
          </div>
          <span className="stat-value">{stats.pending}</span>
          <span className="stat-label">en attente</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <Ban className="w-5 h-5 text-[#ff3355]" />
            <span className="text-xs text-cyber-text-muted font-mono">SUSPENDUS</span>
          </div>
          <span className="stat-value">{stats.suspended}</span>
          <span className="stat-label">suspendus</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1">
            <UserCheck className="w-5 h-5 text-[#00ff9d]" />
            <span className="text-xs text-cyber-text-muted font-mono">ACTIFS</span>
          </div>
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">actifs</span>
        </div>
      </div>

      {/* Pending approvals banner */}
      {stats.pending > 0 && (
        <div className="card p-4 mb-6 border-[#ffaa00]/30 flex items-center gap-3" style={{ background: 'rgba(255, 170, 0, 0.05)' }}>
          <AlertCircle className="w-5 h-5 text-[#ffaa00] flex-shrink-0" />
          <p className="text-sm text-[#ffaa00]">
            <span className="font-semibold font-mono">{stats.pending}</span> compte(s) en attente de validation
          </p>
          <button onClick={() => setFilter('pending')} className="ml-auto btn-secondary text-sm">
            Voir les comptes en attente
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'all', label: 'TOUS' },
            { value: 'pending', label: 'ATTENTE' },
            { value: 'suspended', label: 'SUSPENDUS' },
            { value: 'admin', label: 'ADMINS' },
            { value: 'formateur', label: 'FORMATEURS' },
            { value: 'etudiant', label: 'ÉTUDIANTS' },
          ] as { value: typeof filter; label: string }[]).map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all font-mono ${
                filter === f.value ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]' : 'bg-cyber-bg border-cyber-border text-cyber-text-muted hover:text-cyber-text-dim'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-6 h-6 text-cyber-text-muted" />} title="Aucun utilisateur" />
      ) : (
        <div className="card overflow-hidden">
          <div className="px-6 py-3 border-b border-cyber-border grid grid-cols-12 gap-4 text-xs font-semibold text-cyber-text-muted uppercase tracking-wider font-mono">
            <div className="col-span-4">UTILISATEUR</div>
            <div className="col-span-2">RÔLE</div>
            <div className="col-span-2">STATUT</div>
            <div className="col-span-1">INSCRIT</div>
            <div className="col-span-3 text-right">ACTIONS</div>
          </div>
          <div className="divide-y divide-cyber-border">
            {filtered.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <div key={user.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-cyber-bg transition-colors">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-cyber-surface-hover rounded-full flex items-center justify-center text-xs font-bold text-cyber-text-dim border border-cyber-border flex-shrink-0 font-mono">
                      {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-cyber-text truncate">
                        {user.full_name ?? 'Sans nom'}
                        {isSelf && <span className="text-[#00ff9d] ml-1.5 text-xs font-mono">(VOUS)</span>}
                      </p>
                      <p className="text-xs text-cyber-text-muted truncate font-mono">{user.email}</p>
                    </div>
                  </div>
                  <div className="col-span-2"><span className={roleBadge[user.role]}>{roleLabel[user.role]}</span></div>
                  <div className="col-span-2">
                    {!user.is_approved ? (
                      <span className="flex items-center gap-1 text-xs text-[#ffaa00] font-mono">
                        <Clock className="w-3.5 h-3.5" /> ATTENTE
                      </span>
                    ) : user.is_active ? (
                      <span className="flex items-center gap-1 text-xs text-[#00ff9d] font-mono">
                        <UserCheck className="w-3.5 h-3.5" /> ACTIF
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#ff3355] font-mono">
                        <Ban className="w-3.5 h-3.5" /> SUSPENDU
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-xs text-cyber-text-muted font-mono">{formatDate(user.created_at)}</div>
                  <div className="col-span-3 flex items-center justify-end gap-1.5">
                    {!user.is_approved && (
                      <button
                        onClick={() => approveUser(user)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/20 hover:bg-[#00ff9d]/20 transition-all flex items-center gap-1 font-mono"
                        title="Approuver"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> VALIDER
                      </button>
                    )}
                    {/* Suspend / Reactivate */}
                    {user.is_approved && !isSelf && (
                      user.is_active ? (
                        <button
                          onClick={() => suspendUser(user)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#ffaa00]/10 text-[#ffaa00] border border-[#ffaa00]/20 hover:bg-[#ffaa00]/20 transition-all flex items-center gap-1 font-mono"
                          title="Suspendre"
                        >
                          <Ban className="w-3.5 h-3.5" /> SUSPENDRE
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivateUser(user)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/20 hover:bg-[#00ff9d]/20 transition-all flex items-center gap-1 font-mono"
                          title="Réactiver"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> RÉACTIVER
                        </button>
                      )
                    )}
                    {/* Reset password */}
                    {!isSelf && (
                      <button onClick={() => openReset(user)} className="btn-ghost text-sm" title="Réinitialiser le mot de passe">
                        <KeyRound className="w-4 h-4" />
                      </button>
                    )}
                    {/* Edit */}
                    {!isSelf && (
                      <button onClick={() => openEdit(user)} className="btn-ghost text-sm" title="Modifier le rôle">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {/* Delete */}
                    {!isSelf && (
                      <button
                        onClick={() => deleteUser(user)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#ff3355]/10 text-[#ff3355] border border-[#ff3355]/20 hover:bg-[#ff3355]/20 transition-all flex items-center gap-1 font-mono"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Modifier l'utilisateur">
        {editModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Nom complet</label>
              <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Email</label>
              <input value={editModal.email} disabled className="input opacity-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Rôle</label>
              <div className="grid grid-cols-3 gap-2">
                {(['etudiant', 'formateur', 'admin'] as UserRole[]).map((r) => (
                  <button key={r} type="button" onClick={() => setEditForm({ ...editForm, role: r })}
                    className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                      editForm.role === r ? 'border-[#00d4aa] bg-[#00d4aa]/10 text-[#00d4aa]' : 'border-cyber-border text-cyber-text-muted hover:text-cyber-text-dim'
                    }`}>
                    {roleLabel[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Promo</label>
              <input value={editForm.promo} onChange={(e) => setEditForm({ ...editForm, promo: e.target.value })} className="input" placeholder="Promo 2024..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleSave} className="btn-primary flex-1">Enregistrer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset password modal */}
      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title="Réinitialiser le mot de passe">
        {resetModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#ffaa00]/5 border border-[#ffaa00]/20">
              <KeyRound className="w-5 h-5 text-[#ffaa00] flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-cyber-text">{resetModal.full_name ?? 'Sans nom'}</p>
                <p className="text-xs text-cyber-text-muted font-mono">{resetModal.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Minimum 6 caractères"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-text-muted hover:text-cyber-text-dim"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-cyber-text-muted mt-1.5">L'utilisateur devra se connecter avec ce nouveau mot de passe.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setResetModal(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleResetPassword} disabled={newPassword.length < 6 || resetLoading} className="btn-primary flex-1">
                {resetLoading ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
