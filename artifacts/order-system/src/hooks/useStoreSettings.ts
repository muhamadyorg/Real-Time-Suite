import { createContext, useContext, useEffect, useState, createElement, type ReactNode } from "react";
import { subscribeToSettingsUpdated } from "./useSocket";

export interface StoreSettings {
  showPinsToAdmins: boolean;
  canAdminAnalyze: boolean;
  canAdminDeleteOrders: boolean;
  canAdminPrint: boolean;
  canAdminEditOrders: boolean;
  canAdminMarkDelivered: boolean;
}

const DEFAULT_SETTINGS: StoreSettings = {
  showPinsToAdmins: true,
  canAdminAnalyze: true,
  canAdminDeleteOrders: true,
  canAdminPrint: true,
  canAdminEditOrders: true,
  canAdminMarkDelivered: false,
};

const StoreSettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS);

export function StoreSettingsProvider({
  children,
  token,
}: {
  children: ReactNode;
  token: string | null;
}) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  // API dan sozlamalarni yuklash
  useEffect(() => {
    if (!token) return;
    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      })
      .catch(() => {});
  }, [token]);

  // Real-time: settings:updated socket hodisasini tinglash
  useEffect(() => {
    const unsub = subscribeToSettingsUpdated((data) => {
      setSettings((prev) => ({ ...prev, ...data }));
    });
    return unsub;
  }, []);

  return createElement(StoreSettingsContext.Provider, { value: settings }, children);
}

export function useStoreSettings(): StoreSettings {
  return useContext(StoreSettingsContext);
}
