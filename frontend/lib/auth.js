import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getSession, setSession } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getSession()) {
      setUser(null);
      return;
    }
    try {
      const { user: me } = await api.get('/auth/me');
      setUser(me);
    } catch {
      setSession(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
    const onExpired = () => setUser(null);
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [refresh]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setSession({ token: data.token, csrfToken: data.csrfToken });
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setSession(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, ready, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
