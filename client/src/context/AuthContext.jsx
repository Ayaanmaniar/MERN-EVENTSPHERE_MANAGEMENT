import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { connectSocket, disconnectSocket } from '../api/socket';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('es_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => {
        setUser(r.data.user);
        connectSocket();
      })
      .catch(() => localStorage.removeItem('es_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('es_token', data.token);
    setUser(data.user);
    connectSocket();
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('es_token', data.token);
    setUser(data.user);
    connectSocket();
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('es_token');
    setUser(null);
    disconnectSocket();
  }, []);

  return <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'exhibitor' ? '/exhibitor/profile' : '/');
