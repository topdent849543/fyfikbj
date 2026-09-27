'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token = window.localStorage.getItem('token');
      const storedUser = window.localStorage.getItem('user');

      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/verify');
        const parsedStoredUser = storedUser ? JSON.parse(storedUser) : {};
        const verifiedUser = response?.user ? { ...parsedStoredUser, ...response.user } : parsedStoredUser;

        if (isMounted && verifiedUser) {
          setUser(verifiedUser);
          window.localStorage.setItem('user', JSON.stringify(verifiedUser));
        }
      } catch {
        // The API interceptor removes an invalid token. Clear any stale user as well.
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('user');
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = (nextUser, token) => {
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = () => {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user');
    setUser(null);
  };

  const value = useMemo(() => {
    const can = (permission) => Boolean(user?.isPlatformOwner || user?.permissions?.includes(permission));
    const canAny = (permissions) => Boolean(user?.isPlatformOwner || permissions?.some((permission) => user?.permissions?.includes(permission)));
    const canAll = (permissions) => Boolean(user?.isPlatformOwner || permissions?.every((permission) => user?.permissions?.includes(permission)));
    return { user, isLoading, isAuthenticated: Boolean(user), login, logout, can, canAny, canAll };
  }, [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
