import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    let attempts = 0;
    while (attempts < 5) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        setProfile(data as Profile);
        return data as Profile;
      }
      attempts++;
      await new Promise((r) => setTimeout(r, 300));
    }
    console.error('Profile not found after retries');
    setProfile(null);
    return null;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (!mounted) return;

        // After signup, Supabase auto-creates a session. Check the profile:
        // - If approved (first user / bootstrap admin): keep the session and log in.
        // - If not approved: sign out immediately, user must wait for admin approval.
        if (event === 'SIGNED_UP' && newSession?.user) {
          setLoading(true);
          const prof = await loadProfile(newSession.user.id);
          if (prof && prof.is_approved && prof.is_active) {
            setSession(newSession);
            setUser(newSession.user);
            setLoading(false);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          setLoading(true);
          const prof = await loadProfile(newSession.user.id);
          // Safety net: if an unapproved/inactive user somehow has a session, kick them out
          if (prof && (!prof.is_approved || !prof.is_active)) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const prof = await loadProfile(data.user.id);
    if (!prof) {
      await supabase.auth.signOut();
      return { error: 'Profil introuvable. Contactez l\'administrateur.' };
    }
    if (!prof.is_approved) {
      await supabase.auth.signOut();
      setProfile(null);
      return { error: 'Votre compte est en attente de validation par l\'administrateur.' };
    }
    if (!prof.is_active) {
      await supabase.auth.signOut();
      setProfile(null);
      return { error: 'Votre compte a été suspendu. Contactez l\'administrateur.' };
    }
    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    // The onAuthStateChange handler detects SIGNED_UP and checks the profile:
    // - First user (bootstrap admin): approved → session kept → auto-login.
    // - Everyone else: not approved → signed out → AuthPage shows pending screen.
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
