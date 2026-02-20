import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthUser {
  adminId: string;
  isSuperAdmin: boolean;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setKey: (key: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'admin_key';

const ADMIN_API_BASE = import.meta.env.DEV
  ? '/api/admin'
  : 'https://avatar-server-1018338671074.me-west1.run.app/api/admin';

async function fetchMe(key: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/me`, {
      headers: { 'X-Admin-Key': key },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore key from localStorage and validate it
  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY);
    if (!storedKey) {
      setIsLoading(false);
      return;
    }
    fetchMe(storedKey).then((u) => {
      setUser(u);
      setIsLoading(false);
    });
  }, []);

  async function setKey(key: string): Promise<boolean> {
    const u = await fetchMe(key);
    if (!u) return false;
    localStorage.setItem(STORAGE_KEY, key);
    setUser(u);
    return true;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, setKey, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
