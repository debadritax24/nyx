import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { AuthService } from '../services/auth';
import { supabase } from '../services/supabase';

interface AuthStoreState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  initAuth: async () => {
    try {
      set({ isLoading: true });
      const session = await AuthService.getSession();
      set({
        session,
        user: session?.user || null,
        isAuthenticated: !!session,
        isLoading: false,
      });

      // Listen for session auth changes
      supabase.auth.onAuthStateChange((_event, currentSession) => {
        set({
          session: currentSession,
          user: currentSession?.user || null,
          isAuthenticated: !!currentSession,
        });
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null, session: null });
    }
  },

  signOut: async () => {
    await AuthService.signOut();
    set({ user: null, session: null, isAuthenticated: false });
  },
}));
