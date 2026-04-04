import { useState, useEffect, useCallback } from "react";

export type PermKey =
  | "show_pins"
  | "can_analyze"
  | "can_edit_orders"
  | "can_delete_orders"
  | "can_print"
  | "can_mark_delivered";

const ALL_KEYS: PermKey[] = [
  "show_pins",
  "can_analyze",
  "can_edit_orders",
  "can_delete_orders",
  "can_print",
  "can_mark_delivered",
];

export function useMyPermissions(token: string | null, role: string | null) {
  const [permissions, setPermissions] = useState<Set<PermKey>>(new Set());
  const [loading, setLoading] = useState(false);

  const isSuperUser = role === "sudo" || role === "superadmin";

  const fetch_ = useCallback(async () => {
    if (!token) { setPermissions(new Set()); return; }
    if (isSuperUser) { setPermissions(new Set(ALL_KEYS)); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/permissions/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setPermissions(new Set()); return; }
      const data = await r.json();
      setPermissions(new Set(data.permissions ?? []));
    } catch {
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  }, [token, isSuperUser]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const has = useCallback((key: PermKey) => isSuperUser || permissions.has(key), [isSuperUser, permissions]);

  return { has, loading, refresh: fetch_ };
}
