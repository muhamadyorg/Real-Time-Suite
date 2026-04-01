import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthState {
  token: string | null;
  storeId: number | null;
  storeUsername: string | null;
  storeName: string | null;
  accountId: number | null;
  accountName: string | null;
  role: string | null;
  serviceTypeId: number | null;
}

interface AuthContextType extends AuthState {
  setStoreAuth: (token: string, storeId: number, storeUsername: string, storeName: string, role: string) => void;
  setPinAuth: (token: string, accountId: number, accountName: string, role: string, serviceTypeId?: number | null) => void;
  clearPinAuth: () => void;
  clearStoreAuth: () => void;
}

const defaultState: AuthState = {
  token: null,
  storeId: null,
  storeUsername: null,
  storeName: null,
  accountId: null,
  accountName: null,
  role: null,
  serviceTypeId: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('auth_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAuthTokenGetter(() => parsed.token);
        return parsed;
      } catch (e) {
        return defaultState;
      }
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem('auth_state', JSON.stringify(state));
    setAuthTokenGetter(() => state.token);
  }, [state]);

  const setStoreAuth = (token: string, storeId: number, storeUsername: string, storeName: string, role: string) => {
    setState({
      ...defaultState,
      token,
      storeId,
      storeUsername,
      storeName,
      role,
    });
  };

  const setPinAuth = (token: string, accountId: number, accountName: string, role: string, serviceTypeId?: number | null) => {
    setState((prev) => ({
      ...prev,
      token,
      accountId,
      accountName,
      role,
      serviceTypeId: serviceTypeId ?? null,
    }));
  };

  const clearPinAuth = () => {
    setState((prev) => ({
      ...prev,
      accountId: null,
      accountName: null,
      role: 'store',
      serviceTypeId: null,
    }));
  };

  const clearStoreAuth = () => {
    setState(defaultState);
  };

  return (
    <AuthContext.Provider value={{ ...state, setStoreAuth, setPinAuth, clearPinAuth, clearStoreAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
