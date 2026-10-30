/**
 * EcoWatch AI — Authentication context.
 *
 * Provides:
 *   - Current user profile (null when logged out)
 *   - login() / logout() / register() actions
 *   - isLoading flag for initial token verification
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authApi, type UserProfile } from '../api/endpoints';
import { setToken } from '../api/client';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem('ecowatch_token')));
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ecowatch_token');
    if (!token) return;
    authApi
      .me()
      .then((profile) => {
        setUser(profile);
        setAuthError(null);
      })
      .catch((error: unknown) => {
        setAuthError(error instanceof Error ? error.message : 'Unable to verify your session.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    setToken(access_token);
    try {
      const profile = await authApi.me();
      setUser(profile);
      setAuthError(null);
    } catch (error) {
      localStorage.removeItem('ecowatch_token');
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ecowatch_token');
    setUser(null);
    setAuthError(null);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await authApi.register(name, email, password);
      await login(email, password);
    },
    [login],
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
