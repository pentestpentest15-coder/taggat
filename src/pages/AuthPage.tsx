import { useState } from 'react';
import { Shield, User, Lock, Mail, UserPlus, LogIn, CircleCheck as CheckCircle2, Terminal, Fingerprint, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        setError(error);
      } else {
        setRegistered(true);
      }
    }
    setLoading(false);
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cyber-bg">
      <img src="/A4444D2A-50B8-4A12-8A67-E9218C774E67.PNG" alt="" aria-hidden="true" className="app-watermark" />
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-lg border border-cyber-border bg-cyber-surface/80 backdrop-blur-xl flex items-center justify-center hover:border-[#00ff9d]/30 transition-all"
        title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5 text-[#ffaa00]" /> : <Moon className="w-5 h-5 text-[#00d4ff]" />}
      </button>
        <div className="absolute inset-0 cyber-grid-bg" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00ff9d]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-3xl" />
        <div className="relative z-10 w-full max-w-md">
          <div className="card p-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00ff9d]/10 rounded-2xl mb-4 border border-[#00ff9d]/20" style={{ boxShadow: '0 0 24px rgba(0, 255, 157, 0.15)' }}>
              <CheckCircle2 className="w-8 h-8 text-[#00ff9d]" />
            </div>
            <h2 className="text-xl font-bold text-cyber-text mb-2">Compte créé !</h2>
            <p className="text-cyber-text-dim text-sm mb-6">
              Votre compte a été enregistré. Un administrateur doit le valider avant que vous puissiez vous connecter. Vous recevrez une notification lorsque ce sera fait.
            </p>
            <button
              onClick={() => {
                setRegistered(false);
                setMode('login');
                setEmail('');
                setPassword('');
                setFullName('');
              }}
              className="btn-secondary w-full"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cyber-bg">
      {/* Watermark */}
      <img src="/A4444D2A-50B8-4A12-8A67-E9218C774E67.PNG" alt="" aria-hidden="true" className="app-watermark" />
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-lg border border-cyber-border bg-cyber-surface/80 backdrop-blur-xl flex items-center justify-center hover:border-[#00ff9d]/30 transition-all"
        title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5 text-[#ffaa00]" /> : <Moon className="w-5 h-5 text-[#00d4ff]" />}
      </button>

      {/* Background effects */}
      <div className="absolute inset-0 cyber-grid-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00ff9d]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff2e88]/3 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-4 border border-[#00ff9d]/20 relative overflow-hidden bg-black" style={{ boxShadow: '0 0 32px rgba(0, 255, 157, 0.1)' }}>
            <img src="/2125FDD5-E2B2-40EB-A24A-352C069DF8F7.PNG" alt="Logo TÀGGAT" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-sm font-semibolt text-cyber-text tracking-tight">Jàngé Ci Jëf</h1>
          <h1 className="text-2xl font-bold text-cyber-text tracking-tight">PentestLab</h1>
          <p className="text-cyber-text-muted mt-1 text-sm font-mono">Plateforme de formation en cybersécurité</p>
        </div>

        <div className="card p-8 animate-fade-in">
          {/* Tab switch */}
          <div className="flex gap-1 mb-6 p-1 bg-cyber-bg rounded-lg border border-cyber-border">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${mode === 'login' ? 'bg-[#00ff9d] text-cyber-bg' : 'text-cyber-text-dim hover:text-cyber-text'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${mode === 'register' ? 'bg-[#00ff9d] text-cyber-bg' : 'text-cyber-text-dim hover:text-cyber-text'}`}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jean Dupont" className="input pl-10" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jean@exemple.fr" className="input pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-cyber-text-dim mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="input pl-10" />
              </div>
            </div>

            {error && (
              <div className="bg-[#ff3355]/10 border border-[#ff3355]/20 rounded-lg px-4 py-3 text-sm text-[#ff3355] animate-slide-in font-mono">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" />
                  Chargement...
                </span>
              ) : mode === 'login' ? (
                <><LogIn className="w-4 h-4" /> Se connecter</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Créer un compte</>
              )}
            </button>
          </form>

          {mode === 'register' && (
            <p className="mt-4 text-xs text-cyber-text-muted text-center">
              Les nouveaux comptes doivent être validés par un administrateur avant de pouvoir se connecter.
            </p>
          )}

          <div className="mt-6 pt-6 border-t border-cyber-border">
            <div className="flex items-center justify-center gap-2 text-xs text-cyber-text-muted font-mono">
              <Terminal className="w-3 h-3 text-[#00ff9d]" />
              <span>Environnement de test de sécurité offensive et défensive</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-cyber-text-muted font-mono">
              <Fingerprint className="w-3 h-3" />
              <span>SECURE // ENCRYPTED // MONITORED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
