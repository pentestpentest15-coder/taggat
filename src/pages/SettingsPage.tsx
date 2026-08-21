import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Sun, Moon, Save, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { PageHeader } from '@/components/ui';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileMsg(null);

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (error) {
      setProfileMsg({ type: 'error', text: 'Erreur lors de la sauvegarde: ' + error.message });
    } else {
      await refreshProfile();
      setProfileMsg({ type: 'success', text: 'Profil mis à jour avec succès.' });
    }
    setSavingProfile(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);

    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    setSavingPwd(true);

    const { error } = await supabase.auth.updateUser({
      password: newPwd,
    });

    if (error) {
      setPwdMsg({ type: 'error', text: 'Erreur: ' + error.message });
    } else {
      setPwdMsg({ type: 'success', text: 'Mot de passe modifié avec succès.' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    }
    setSavingPwd(false);
  }

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <PageHeader title="Réglages" subtitle="Gérez votre profil et vos préférences" />

      <div className="space-y-6 max-w-2xl">
        {/* Profil */}
        <div className="card p-6">
          <h2 className="section-title mb-5">
            <User className="w-4 h-4 text-[#00ff9d]" /> Informations du profil
          </h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                placeholder="Votre nom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Email</label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                className="input opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-cyber-text-muted mt-1">L'email ne peut pas être modifié.</p>
            </div>
            {profileMsg && (
              <div
                className={`rounded-lg px-4 py-3 text-sm font-mono ${
                  profileMsg.type === 'success'
                    ? 'bg-[#00ff9d]/10 border border-[#00ff9d]/20 text-[#00ff9d]'
                    : 'bg-[#ff3355]/10 border border-[#ff3355]/20 text-[#ff3355]'
                }`}
              >
                {profileMsg.text}
              </div>
            )}
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" />
                  Sauvegarde...
                </span>
              ) : (
                <><Save className="w-4 h-4" /> Sauvegarder</>
              )}
            </button>
          </form>
        </div>

        {/* Mot de passe */}
        <div className="card p-6">
          <h2 className="section-title mb-5">
            <Lock className="w-4 h-4 text-[#00d4ff]" /> Changer le mot de passe
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={6}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                minLength={6}
                className="input"
                placeholder="••••••••"
              />
            </div>
            {pwdMsg && (
              <div
                className={`rounded-lg px-4 py-3 text-sm font-mono ${
                  pwdMsg.type === 'success'
                    ? 'bg-[#00ff9d]/10 border border-[#00ff9d]/20 text-[#00ff9d]'
                    : 'bg-[#ff3355]/10 border border-[#ff3355]/20 text-[#ff3355]'
                }`}
              >
                {pwdMsg.text}
              </div>
            )}
            <button type="submit" disabled={savingPwd} className="btn-electric">
              {savingPwd ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" />
                  Modification...
                </span>
              ) : (
                <><Lock className="w-4 h-4" /> Modifier le mot de passe</>
              )}
            </button>
          </form>
        </div>

        {/* Thème */}
        <div className="card p-6">
          <h2 className="section-title mb-5">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-[#00d4ff]" /> : <Sun className="w-4 h-4 text-[#ffaa00]" />}
            Apparence
          </h2>
          <div className="flex items-center justify-between p-4 rounded-lg border border-cyber-border bg-cyber-surface-hover/30">
            <div>
              <p className="text-sm font-medium text-cyber-text">Thème de l'interface</p>
              <p className="text-xs text-cyber-text-muted mt-1">
                Choisissez entre le thème sombre (par défaut) et le thème clair.
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-cyber-border hover:border-[#00ff9d]/30 transition-all"
              style={{ background: 'rgba(0, 255, 157, 0.08)', color: 'var(--neon)' }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Activer le clair' : 'Activer le sombre'}
            </button>
          </div>
          {theme === 'dark' ? (
            <p className="text-xs text-cyber-text-muted mt-3 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-[#00ff9d]" /> Thème sombre actif
            </p>
          ) : (
            <p className="text-xs text-cyber-text-muted mt-3 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-[#00ff9d]" /> Thème clair actif
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
