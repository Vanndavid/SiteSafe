import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, authApi, configureAuthHandlers, setAccessToken } from '../api/client';
import type { AuthResponse, AuthUser } from './types';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const applyAuthResponse = (data: AuthResponse, setUser: (user: AuthUser) => void) => {
  setAccessToken(data.accessToken);
  setUser(data.user);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await authApi.post<AuthResponse>('/api/auth/refresh');
      applyAuthResponse(response.data, setUser);
      return response.data.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    configureAuthHandlers({
      refreshAccessToken,
      onSessionExpired: clearSession,
    });
  }, [clearSession, refreshAccessToken]);

  useEffect(() => {
    const restoreSession = async () => {
      setIsLoading(true);

      try {
        await refreshAccessToken();
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, [refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.post<AuthResponse>('/api/auth/login', { email, password });
    applyAuthResponse(response.data, setUser);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const response = await authApi.post<AuthResponse>('/api/auth/register', {
      name,
      email,
      password,
    });
    applyAuthResponse(response.data, setUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.post('/api/auth/logout');
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const demoLogin = useCallback(async () => {
    const demoEmail = 'demo@mail.com';
    const demoPassword = 'dem@123!';

    try {
      await login(demoEmail, demoPassword);
    } catch {
      await register('Demo User', demoEmail, demoPassword);
    }
  }, [login, register]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      demoLogin,
    }),
    [demoLogin, isLoading, login, logout, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export { api };
