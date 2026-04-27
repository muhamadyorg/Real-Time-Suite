import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, ShoppingBag, Wallet, ChevronDown, ChevronUp, Calendar, X, Layers, Search, Phone, TrendingDown, BadgeCheck, Users, Plus } from "lucide-react";

interface AnalyticsViewProps {
  storeId: number;
  token: string;
  serviceTypes?: { id: number; name: string }[];
}

type Period = "daily" | "weekly" | "monthly";
type ViewMode = "batafsil" | "jami" | "mijozlar" | "dokon";
type TxType = "naqd" | "qarz" | "tolov" | "tuzatish" | "click" | "dokonga";
const TX_META: Record<TxType, { label: string; icon: string; color: string }> = {
  naqd:     { label: "Naqd",     icon: "💵", color: "text-green-600 bg-green-50 dark:bg-green-950/30" },
  click:    { label: "Click",    icon: "📲", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  dokonga:  { label: "Dokonga",  icon: "🏪", color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  qarz:     { label: "Nasiya",   icon: "📋", color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
  tolov:    { label: "To'lov",   icon: "💰", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
  tuzatish: { label: "Tuzatish", icon: "✏️", color: "text-gray-600 bg-gray-50 dark:bg-gray-950/30" },
};
const STORE_PAY_TYPES: TxType[] = ["naqd", "click", "dokonga"];
const fmtDate = (d: string | Date) => {
  try { return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};
const fmtAmt = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const balNum = (v: any) => parseFloat(String(v ?? "0"));
const PERIOD_LABELS: Record<Period, string> = {
  daily: "Kun",
  weekly: "Hafta",
  monthly: "Oylik",
};
const PERIOD_DAYS: Record<Period, number> = { daily: 30, weekly: 84, monthly: 365 };

// Balon tsex — maxsus hisoblash
const BALON_SERVICE_NAME = "Balon tsex";
const BALON_SM_UNITS = new Set(["20", "30", "40", "50", "60", "70", "80", "90"]);

// Aggregated rows (Jami view) dan balon totalni hisoblash
const calcBalonFromRows = (rows: any[]) => {
  let cm = 0, kardon = 0;
  for (const r of rows) {
    if (r.service_type_name !== BALON_SERVICE_NAME) continue;
    const q = Number(r.total_quantity ?? 0);
    if (r.unit === "metr") cm += q * 100;
    else if (r.unit === "kardon") kardon += Math.round(q);
    else if (BALON_SM_UNITS.has(String(r.unit))) cm += q * parseInt(r.unit);
  }
  return { metr: Math.floor(cm / 100), sm: cm % 100, kardon };
};

// Individual orders (Batafsil view) dan balon totalni hisoblash
const calcBalonFromOrders = (orders: any[]) => {
  let cm = 0, kardon = 0;
  for (const o of orders) {
    if (o.service_type_name !== BALON_SERVICE_NAME) continue;
    const q = Number(o.quantity ?? 0);
    if (o.unit === "metr") cm += q * 100;
    else if (o.unit === "kardon") kardon += Math.round(q);
    else if (BALON_SM_UNITS.has(String(o.unit))) cm += q * parseInt(o.unit);
  }
  return { metr: Math.floor(cm / 100), sm: cm % 100, kardon };
};

// Balon totalini chiroyli matn sifatida ko'rsatish
const fmtBalon = (metr: number, sm: number, kardon: number): string | null => {
  const parts: string[] = [];
  if (metr > 0 || sm > 0) {
    let s = `${metr} metr`;
    if (sm > 0) s += ` ${sm} sm`;
    parts.push(s);
  }
  if (kardon > 0) parts.push(`${kardon} kardon`);
  return parts.length ? parts.join(" va ") : null;
};

const fmtNum = (n: number | null | undefined) =>
  n == null ? "0" : Math.round(n).toLocaleString("uz-UZ");

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "0" : Math.round(n).toLocaleString("uz-UZ");

const fmtPeriod = (isoStr: string, period: Period) => {
  const d = new Date(isoStr);
  if (period === "daily")   return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (period === "weekly")  return `${d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} hafta`;
  if (period === "monthly") return d.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
  return isoStr.slice(0, 10);
};

const fmtDateLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });
};

const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const fmtTime = (val: any) => {
  try {
    return new Date(val).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

const fmtPrice = (v: any) => {
  const n = parseFloat(v ?? "0");
  if (!n) return null;
  return Math.round(n).toLocaleString("uz-UZ") + " so'm";
};

const fmtQty = (qty: any, unit: any) => {
  const n = parseFloat(qty ?? "0");
  if (!n) return null;
  return Math.round(n).toLocaleString("uz-UZ") + (unit ? ` ${unit}` : " dona");
};

const STATUS_LABELS: Record<string, string> = {
  new: "Yangi", accepted: "Qabul", ready: "Tayyor", delivered: "Yetkazildi", cancelled: "Bekor",
};

// Batafsil view uchun: period ga qarab guruhlash kaliti
const getGroupKey = (dateStr: string, p: Period): string => {
  const s = typeof dateStr === "string" ? dateStr.slice(0, 10) : "";
  if (!s) return "unknown";
  if (p === "daily") return s;
  if (p === "monthly") return s.slice(0, 7); // "YYYY-MM"
  // weekly → Dushanba kunini topamiz
  const d = new Date(s + "T00:00:00");
  const day = d.getDay(); // 0=Yak, 1=Du, ...
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getTime() + offset * 86400000);
  return monday.toISOString().slice(0, 10);
};

// Guruhlash header labelini format qilish
const fmtGroupHeader = (key: string, p: Period): string => {
  if (p === "daily") return fmtDay(key);
  if (p === "monthly") {
    const d = new Date(key + "-01T00:00:00");
    return d.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
  }
  // weekly — bosh kundan 6 kun keyingi sana
  const start = new Date(key + "T00:00:00");
  const end = new Date(start.getTime() + 6 * 86400000);
  return `${fmtDay(key)} – ${fmtDay(end.toISOString().slice(0, 10))}`;
};

// Payment type badge
const PAYMENT_META: Record<string, { label: string; icon: string; cls: string }> = {
  naqd:    { label: "Naqd",    icon: "💵", cls: "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  click:   { label: "Click",   icon: "📲", cls: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
  dokonga: { label: "Dokonga", icon: "🏪", cls: "text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800" },
  qarz:    { label: "Nasiya",  icon: "📋", cls: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
  tolov:   { label: "To'lov",  icon: "💰", cls: "text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800" },
};

export function AnalyticsView({ storeId, token, serviceTypes = [] }: AnalyticsViewProps) {
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const [period, setPeriod] = useState<Period>("daily");
  const [selTypes, setSelTypes] = useState<number[]>([]);
  const [selClientId, setSelClientId] = useState<number | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [view, setView] = useState<ViewMode>("batafsil");

  // Mijozlar (nasiya) state
  const [allTx, setAllTx] = useState<any[]>([]);
  const [nasiyaServiceTypes, setNasiyaServiceTypes] = useState<any[]>([]);
  const [nasiyaLoading, setNasiyaLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showOnlyDebt, setShowOnlyDebt] = useState(false);
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [clientTx, setClientTx] = useState<Record<number, any[]>>({});
  const [clientTxLoading, setClientTxLoading] = useState<number | null>(null);
  // Payment modal
  const [payClient, setPayClient] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState<TxType>("tolov");
  const [payNote, setPayNote] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payServiceTypeId, setPayServiceTypeId] = useState<string>("");

  // DOKON view state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dokonDate, setDokonDate] = useState(todayStr);
  const [dokonClientId, setDokonClientId] = useState<number | null>(null);
  const [dokonServiceTypeId, setDokonServiceTypeId] = useState<number | null>(null);
  const [dokonOrders, setDokonOrders] = useState<any[]>([]);
  const [dokonTx, setDokonTx] = useState<any[]>([]);
  const [dokonLoading, setDokonLoading] = useState(false);

  // Aggregated
  const [aggData, setAggData] = useState<any>(null);
  const [aggLoading, setAggLoading] = useState(false);

  // Individual orders (batafsil)
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // Jami drill-down (eski)
  const [specificDate, setSpecificDate] = useState<string>("");
  const [useSpecificDate, setUseSpecificDate] = useState(false);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [drillOrders, setDrillOrders] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // Quick "+" tranzaksiya modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickClientId, setQuickClientId] = useState<number | null>(null);
  const [quickClientSearch, setQuickClientSearch] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickType, setQuickType] = useState<"+" | "-">("+");
  const [quickTxType, setQuickTxType] = useState<TxType>("tolov");
  const [quickNote, setQuickNote] = useState("");
  const [quickServiceTypeId, setQuickServiceTypeId] = useState<string>("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickClientBal, setQuickClientBal] = useState<number | null>(null);
  const [quickClientBalLoading, setQuickClientBalLoading] = useState(false);

  const openQuick = () => {
    setQuickOpen(true);
    setQuickClientId(null);
    setQuickClientSearch("");
    setQuickAmount("");
    setQuickType("+");
    setQuickTxType("tolov");
    setQuickNote("");
    setQuickServiceTypeId("");
    setQuickClientBal(null);
  };

  const selectQuickClient = async (c: any) => {
    setQuickClientId(c.id);
    setQuickClientSearch(c.name);
    setQuickClientBal(null);
    setQuickClientBalLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${c.id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setQuickClientBal(d.balance ?? 0);
    } catch { setQuickClientBal(null); } finally { setQuickClientBalLoading(false); }
  };

  const doQuickTx = async () => {
    if (!quickClientId) return;
    const amt = parseFloat(quickAmount.replace(/\s/g, "") || "0");
    if (!amt || amt <= 0) return;
    setQuickLoading(true);
    try {
      const type: TxType = quickType === "-" ? "qarz" : quickTxType;
      const stId = quickServiceTypeId ? parseInt(quickServiceTypeId) : (nasiyaServiceTypes[0]?.id ?? null);
      const note = quickNote || (quickType === "-" ? `Qarz qo'shildi` : `To'lov qabul qilindi`);
      const res = await fetch(`${apiBase}/api/client-accounts/${quickClientId}/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, amount: amt, note, serviceTypeId: stId, storeId }),
      });
      if (res.ok) {
        setQuickOpen(false);
        fetchNasiyaData();
      } else {
        const e = await res.json();
        alert(e.error ?? "Xatolik");
      }
    } catch { alert("Tarmoq xatosi"); } finally { setQuickLoading(false); }
  };

  // Fetch clients + allTx + nasiyaServiceTypes
  const fetchNasiyaData = useCallback(async () => {
    setNasiyaLoading(true);
    try {
      const [cRes, stRes, txRes] = await Promise.all([
        fetch(`${apiBase}/api/client-accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/service-types`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/client-accounts/all/transactions?limit=500`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cRes.ok) { const d = await cRes.json(); setClients(Array.isArray(d) ? d : []); }
      if (stRes.ok) {
        const all = await stRes.json();
        setNasiyaServiceTypes((all as any[]).filter((s: any) => s.nasiyaEnabled));
      }
      if (txRes.ok) { const d = await txRes.json(); setAllTx(Array.isArray(d) ? d : []); }
    } catch {}
    setNasiyaLoading(false);
  }, [storeId, token, apiBase]);

  useEffect(() => { fetchNasiyaData(); }, [fetchNasiyaData]);

  const loadClientTx = async (clientId: number) => {
    if (clientTx[clientId]) return;
    setClientTxLoading(clientId);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${clientId}/transactions?limit=200`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const data = await r.json(); setClientTx(prev => ({ ...prev, [clientId]: data })); }
    } catch {}
    setClientTxLoading(null);
  };

  const toggleExpand = async (clientId: number) => {
    if (expandedClient === clientId) { setExpandedClient(null); return; }
    setExpandedClient(clientId);
    await loadClientTx(clientId);
  };

  const doPayment = async () => {
    if (!payClient) return;
    const amount = parseFloat(payAmount.replace(/\s/g, "") || "0");
    if (amount <= 0) return;
    setPayLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${payClient.id}/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: payType, amount, note: payNote || undefined, storeId, serviceTypeId: payServiceTypeId ? Number(payServiceTypeId) : undefined }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      const closedClient = payClient;
      setPayClient(null); setPayAmount(""); setPayNote("");
      await fetchNasiyaData();
      setClientTx(prev => { const n = { ...prev }; delete n[closedClient.id]; return n; });
    } catch {}
    setPayLoading(false);
  };

  const clientBreakdown = (clientId: number) => {
    const txs = allTx.filter((t: any) => t.client_id === clientId);
    const bd: Record<TxType, number> = { naqd: 0, qarz: 0, tolov: 0, tuzatish: 0, click: 0, dokonga: 0 };
    for (const t of txs) { const k = t.type as TxType; if (bd[k] !== undefined) bd[k] += Math.abs(parseFloat(t.amount ?? "0")); }
    return { ...bd, dokonBerishi: bd.naqd + bd.click + bd.dokonga };
  };

  // DOKON view fetch
  const fetchDokon = useCallback(async () => {
    setDokonLoading(true);
    try {
      const tz = "+05:00";
      const pStart = `${dokonDate}T00:00:00${tz}`;
      const pEnd   = `${dokonDate}T23:59:59${tz}`;
      const cid  = dokonClientId ? `&clientId=${dokonClientId}` : "";
      const stid = dokonServiceTypeId ? `&serviceTypeIds=${dokonServiceTypeId}` : "";
      const [ordRes, txRes] = await Promise.all([
        fetch(`${apiBase}/api/analytics/orders?storeId=${storeId}&periodStart=${encodeURIComponent(pStart)}&periodEnd=${encodeURIComponent(pEnd)}${cid}${stid}`,
          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/client-accounts/all/transactions?limit=1000`,
          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (ordRes.ok) setDokonOrders(await ordRes.json());
      if (txRes.ok) {
        const allTxData = await txRes.json();
        // Filter to the selected date
        setDokonTx((allTxData as any[]).filter((t: any) => {
          const d = new Date(t.created_at).toISOString().slice(0, 10);
          if (d !== dokonDate) return false;
          if (dokonClientId && t.client_id !== dokonClientId) return false;
          return true;
        }));
      }
    } catch {}
    setDokonLoading(false);
  }, [storeId, token, apiBase, dokonDate, dokonClientId, dokonServiceTypeId]);

  useEffect(() => { if (view === "dokon") fetchDokon(); }, [view, fetchDokon]);

  const fetchAgg = useCallback(async () => {
    setAggLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      const cid = selClientId ? `&clientId=${selClientId}` : "";
      let url: string;
      if (useSpecificDate && specificDate) {
        url = `${apiBase}/api/analytics?storeId=${storeId}&period=daily&date=${specificDate}${ids}${cid}`;
      } else {
        url = `${apiBase}/api/analytics?storeId=${storeId}&period=${period}&days=${PERIOD_DAYS[period]}${ids}${cid}`;
      }
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setAggData(await r.json());
    } catch {}
    setAggLoading(false);
  }, [storeId, period, selTypes, selClientId, token, apiBase, useSpecificDate, specificDate]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      const cid = selClientId ? `&clientId=${selClientId}` : "";
      const r = await fetch(
        `${apiBase}/api/analytics/orders?storeId=${storeId}&days=${PERIOD_DAYS[period]}${ids}${cid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) setOrders(await r.json());
    } catch {}
    setOrdersLoading(false);
  }, [storeId, period, selTypes, selClientId, token, apiBase]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchAgg(), fetchOrders()]);
    setLastFetch(new Date());
  }, [fetchAgg, fetchOrders]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    setCollapsedDays(new Set());
  }, [period]);
  useEffect(() => {
    if (useSpecificDate) return;
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll, useSpecificDate]);

  const toggleType = (id: number) =>
    setSelTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Jami drill-down
  const fetchDrillOrders = async (periodStart: string, periodEnd: string, serviceTypeId?: number) => {
    setDrillLoading(true);
    try {
      const stId = serviceTypeId ? `&serviceTypeId=${serviceTypeId}` : "";
      const r = await fetch(
        `${apiBase}/api/analytics/orders?storeId=${storeId}&periodStart=${periodStart}&periodEnd=${periodEnd}${stId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) setDrillOrders(await r.json());
    } catch {}
    setDrillLoading(false);
  };

  const togglePeriod = (periodKey: string, periodStart: string, periodEnd: string) => {
    if (expandedPeriod === periodKey) {
      setExpandedPeriod(null);
      setDrillOrders([]);
    } else {
      setExpandedPeriod(periodKey);
      setDrillOrders([]);
      fetchDrillOrders(periodStart, periodEnd);
    }
  };

  const getPeriodRange = (periodStr: string, p: Period) => {
    const d = new Date(periodStr);
    let start: Date, end: Date;
    if (p === "monthly") {
      start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    } else if (p === "weekly") {
      start = d;
      end = new Date(d.getTime() + 7 * 86400000);
    } else {
      start = d;
      end = new Date(d.getTime() + 86400000);
    }
    const fmt = (dd: Date) => dd.toISOString().slice(0, 10) + "T00:00:00+05:00";
    return { start: fmt(start), end: fmt(end) };
  };

  // Aggregated groups for Jami view
  const aggRows: any[] = aggData?.rows ?? [];
  const aggSummary = aggData?.summary;
  const activePeriod = useSpecificDate ? "daily" : period;

  const periodGroups = aggRows.reduce((acc: any, row: any) => {
    const key = row.period;
    if (!acc[key]) acc[key] = { period: key, orderCount: 0, totalPrice: 0, unitTotals: {}, types: [] };
    acc[key].orderCount += row.order_count;
    acc[key].totalPrice += row.total_price;
    const unitKey = row.unit || "dona";
    acc[key].unitTotals[unitKey] = (acc[key].unitTotals[unitKey] ?? 0) + row.total_quantity;
    acc[key].types.push(row);
    return acc;
  }, {});
  const periodList = Object.values(periodGroups) as any[];

  // Individual orders grouped by period (daily/weekly/monthly)
  const dayGroups = orders.reduce((acc: any, o: any) => {
    const rawDate = typeof o.day === "string"
      ? o.day.slice(0, 10)
      : o.created_at
        ? new Date(o.created_at).toISOString().slice(0, 10)
        : "unknown";
    const key = getGroupKey(rawDate, period);
    if (!acc[key]) acc[key] = { day: key, orders: [], totalPrice: 0 };
    acc[key].orders.push(o);
    acc[key].totalPrice += parseFloat(o.price ?? "0");
    return acc;
  }, {});
  const dayList = (Object.values(dayGroups) as any[]).sort((a, b) => b.day.localeCompare(a.day));

  const toggleDay = (day: string) =>
    setCollapsedDays(prev => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n; });

  const batafsiliPayBreak = (() => {
    if (view !== "batafsil") return null;
    const m: Record<string, number> = {};
    for (const o of orders) {
      const t = o.payment_type as string | null;
      if (t) m[t] = (m[t] ?? 0) + Math.abs(parseFloat(o.price ?? "0"));
    }
    return m;
  })();

  const summary = view === "batafsil"
    ? {
        total_orders: orders.length,
        total_price: orders.reduce((s, o) => s + parseFloat(o.price ?? "0"), 0),
        naqd_total: batafsiliPayBreak?.naqd ?? 0,
        click_total: batafsiliPayBreak?.click ?? 0,
        dokonga_total: batafsiliPayBreak?.dokonga ?? 0,
        qarz_total: batafsiliPayBreak?.qarz ?? 0,
      }
    : aggSummary;

  const loading = aggLoading || ordersLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Hisobotlar</h2>
          {lastFetch && (
            <span className="text-xs text-muted-foreground">
              · {lastFetch.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openQuick} className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50">
            <Plus className="w-3.5 h-3.5" />
            Tranzaksiya
          </Button>
          <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Yangilash
          </Button>
        </div>
      </div>

      {/* View + Period selectors */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* View toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setView("batafsil")}
            className={`px-3 py-1.5 text-sm font-semibold transition-all ${view === "batafsil" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            Batafsil
          </button>
          <button
            onClick={() => setView("jami")}
            className={`px-3 py-1.5 text-sm font-semibold transition-all ${view === "jami" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            Jami
          </button>
          <button
            onClick={() => setView("mijozlar")}
            className={`px-3 py-1.5 text-sm font-semibold transition-all flex items-center gap-1 ${view === "mijozlar" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="w-3.5 h-3.5" />Mijozlar
          </button>
          <button
            onClick={() => setView("dokon")}
            className={`px-3 py-1.5 text-sm font-semibold transition-all flex items-center gap-1 ${view === "dokon" ? "bg-amber-500 text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            🏪 DOKON
          </button>
        </div>

        {/* Period — only for batafsil/jami */}
        {(view === "batafsil" || view === "jami") && (["daily", "weekly", "monthly"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              period === p
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}

        {/* Calendar (only Jami) */}
        {view === "jami" && (
          <button
            onClick={() => { setUseSpecificDate(v => !v); if (!specificDate) setSpecificDate(new Date().toISOString().slice(0, 10)); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              useSpecificDate ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Kun
          </button>
        )}
      </div>

      {/* Specific date input (Jami only) */}
      {view === "jami" && useSpecificDate && (
        <div className="flex items-center gap-2">
          <Input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className="h-9 w-44" />
          <span className="text-sm font-medium text-primary">{specificDate ? fmtDateLabel(specificDate) : ""}</span>
          <button onClick={() => setUseSpecificDate(false)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Service type filter */}
      {serviceTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Xizmat:</span>
          {serviceTypes.map(st => {
            const sel = selTypes.includes(st.id);
            return (
              <button key={st.id} onClick={() => toggleType(st.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  sel ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                }`}>
                {st.name}
              </button>
            );
          })}
          {selTypes.length > 0 && (
            <button onClick={() => setSelTypes([])} className="text-xs text-muted-foreground hover:text-foreground underline">Barchasi</button>
          )}
        </div>
      )}

      {/* Client filter */}
      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Mijoz:</span>
          <select
            className="h-8 rounded-lg border border-border bg-card text-sm px-2 pr-6 text-foreground max-w-[200px]"
            value={selClientId ?? ""}
            onChange={e => setSelClientId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Barcha mijozlar —</option>
            {clients.map((c: any) => (
              <option key={c.id} value={c.id}>
                {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || `#${c.id}`}
              </option>
            ))}
          </select>
          {selClientId && (
            <button onClick={() => setSelClientId(null)} className="text-xs text-muted-foreground hover:text-foreground underline">Tozalash</button>
          )}
        </div>
      )}

      {/* Summary cards */}
      {(() => {
        const sNaqd    = summary?.naqd_total    ?? 0;
        const sClick   = summary?.click_total   ?? 0;
        const sDokonga = summary?.dokonga_total  ?? 0;
        const sQarz    = summary?.qarz_total     ?? 0;
        const hasPayBreak = (sNaqd + sClick + sDokonga + sQarz) > 0;
        return (
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Zakazlar</span>
                </div>
                <div className="text-2xl font-black tabular-nums">
                  {loading && !aggData && !orders.length ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_orders)}
                </div>
                <div className="text-xs text-muted-foreground">ta</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Jami summa</span>
                </div>
                <div className="text-xl font-black tabular-nums leading-tight">
                  {loading && !aggData && !orders.length ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtMoney(summary?.total_price)}
                </div>
                <div className="text-xs text-muted-foreground">so'm</div>
              </CardContent>
            </Card>
            {hasPayBreak && (
              <Card className="col-span-2 border-border/50">
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {sNaqd > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-semibold">
                        💵 Naqd: <b>{fmtMoney(sNaqd)}</b>
                      </span>
                    )}
                    {sClick > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full font-semibold">
                        📲 Click: <b>{fmtMoney(sClick)}</b>
                      </span>
                    )}
                    {sDokonga > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2.5 py-1 rounded-full font-semibold">
                        🏪 Dokonga: <b>{fmtMoney(sDokonga)}</b>
                      </span>
                    )}
                    {sQarz > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full font-semibold">
                        📋 Nasiya: <b>{fmtMoney(sQarz)}</b>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ===== BATAFSIL VIEW ===== */}
      {view === "batafsil" && (
        <>
          {ordersLoading && !orders.length ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : dayList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Ma'lumot topilmadi</div>
          ) : (
            <div className="space-y-2">
              {dayList.map((group: any) => {
                const collapsed = collapsedDays.has(group.day);
                const dayBalon = calcBalonFromOrders(group.orders);
                const dayBalonStr = fmtBalon(dayBalon.metr, dayBalon.sm, dayBalon.kardon);

                // Payment breakdown for this group
                const payBrk: Record<string, number> = {};
                for (const o of group.orders) {
                  const t = o.payment_type as string | null;
                  if (t) payBrk[t] = (payBrk[t] ?? 0) + Math.abs(parseFloat(o.price ?? "0"));
                }
                const dokongaBerish = (payBrk.naqd ?? 0) + (payBrk.dokonga ?? 0);
                const qarzSum = payBrk.qarz ?? 0;
                const hasPayBreakdown = Object.keys(payBrk).length > 0;

                return (
                  <Card key={group.day} className="overflow-hidden">
                    {/* Day header */}
                    <button
                      className="w-full px-4 py-2.5 bg-muted/50 flex items-center justify-between hover:bg-muted/80 transition-colors"
                      onClick={() => toggleDay(group.day)}
                    >
                      <div className="flex items-center gap-2">
                        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-bold text-sm">{fmtGroupHeader(group.day, period)}</span>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap justify-end">
                        <span><b className="text-foreground">{group.orders.length}</b> ta</span>
                        {dayBalonStr && (
                          <span className="text-violet-600 dark:text-violet-400 font-semibold">{dayBalonStr}</span>
                        )}
                        {group.totalPrice > 0 && (
                          <span><b className="text-amber-600 dark:text-amber-400">{fmtMoney(group.totalPrice)} so'm</b></span>
                        )}
                      </div>
                    </button>

                    {/* Payment breakdown row (always visible if exists) */}
                    {hasPayBreakdown && (
                      <div className="px-4 py-1.5 bg-muted/20 border-b border-border/40 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {payBrk.naqd > 0 && <span className="text-green-600">💵 {fmtMoney(payBrk.naqd)}</span>}
                        {payBrk.click > 0 && <span className="text-blue-600">📲 {fmtMoney(payBrk.click)}</span>}
                        {payBrk.dokonga > 0 && <span className="text-orange-600">🏪 {fmtMoney(payBrk.dokonga)}</span>}
                        {qarzSum > 0 && <span className="text-red-600">📋 {fmtMoney(qarzSum)} nasiya</span>}
                        {payBrk.tolov > 0 && <span className="text-purple-600">💰 {fmtMoney(payBrk.tolov)} to'lov</span>}
                        {dokongaBerish > 0 && (
                          <span className="ml-auto font-semibold text-amber-700 dark:text-amber-400">🏪 Dokonga: {fmtMoney(dokongaBerish)}</span>
                        )}
                      </div>
                    )}

                    {/* Order rows */}
                    {!collapsed && (
                      <div className="divide-y divide-border/40">
                        {group.orders.map((o: any) => {
                          const price = fmtPrice(o.price);
                          const qty = fmtQty(o.quantity, o.unit);
                          const pmeta = o.payment_type ? PAYMENT_META[o.payment_type as string] : null;
                          return (
                            <div key={o.id} className="px-4 py-2.5">
                              {/* Mobile layout */}
                              <div className="flex items-center justify-between gap-2 sm:hidden">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-sm">{o.service_type_name}</span>
                                    {pmeta && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${pmeta.cls}`}>{pmeta.icon} {pmeta.label}</span>
                                    )}
                                  </div>
                                  {o.client_name && <div className="text-xs text-muted-foreground truncate">{o.client_name}</div>}
                                  <div className="text-[10px] text-muted-foreground/60">{fmtTime(o.created_at)} · #{o.order_id ?? o.id}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  {qty && <div className="text-xs">{qty}</div>}
                                  {price
                                    ? <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">{price}</div>
                                    : <div className="text-xs text-muted-foreground italic">narx yo'q</div>}
                                </div>
                              </div>
                              {/* Desktop layout */}
                              <div className="hidden sm:flex items-center gap-3 text-sm">
                                <div className="text-xs text-muted-foreground w-10 shrink-0">{fmtTime(o.created_at)}</div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{o.service_type_name}</span>
                                  {o.client_name && <span className="ml-2 text-xs text-muted-foreground">{o.client_name}</span>}
                                  {o.client_phone && <span className="ml-1 text-xs text-muted-foreground">· {o.client_phone}</span>}
                                </div>
                                <div className="text-xs w-24 text-right">{qty ?? "—"}</div>
                                {pmeta && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${pmeta.cls}`}>{pmeta.icon} {pmeta.label}</span>
                                )}
                                <div className="text-xs w-28 text-right">
                                  {price
                                    ? <span className="font-semibold text-amber-600 dark:text-amber-400">{price}</span>
                                    : <span className="text-muted-foreground italic">narx yo'q</span>}
                                </div>
                                <div className="text-xs text-muted-foreground w-16 text-right">#{o.order_id ?? o.id}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== JAMI VIEW (old aggregated + drill-down) ===== */}
      {view === "jami" && (
        <>
          {aggLoading && !aggData ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : periodList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Ma'lumot topilmadi</div>
          ) : (
            <div className="space-y-2">
              {periodList.map((group: any) => {
                const pKey = group.period;
                const { start, end } = getPeriodRange(pKey, activePeriod);
                const isExpanded = expandedPeriod === pKey;

                // Balon tsex totali
                const balonTotals = calcBalonFromRows(group.types);
                const balonStr = fmtBalon(balonTotals.metr, balonTotals.sm, balonTotals.kardon);

                // Boshqa (non-balon) unit totallari
                const nonBalonUnitTotals: Record<string, number> = {};
                for (const r of group.types) {
                  if (r.service_type_name === BALON_SERVICE_NAME) continue;
                  const uk = r.unit || "dona";
                  nonBalonUnitTotals[uk] = (nonBalonUnitTotals[uk] ?? 0) + r.total_quantity;
                }
                const unitStr = Object.entries(nonBalonUnitTotals)
                  .map(([u, q]) => `${fmtNum(q)} ${u}`)
                  .join(" · ");
                return (
                  <Card key={pKey} className="overflow-hidden">
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 bg-muted/50 flex items-center justify-between hover:bg-muted/80 transition-colors"
                      onClick={() => togglePeriod(pKey, start, end)}
                    >
                      <span className="font-semibold text-sm">{fmtPeriod(pKey, activePeriod)}</span>
                      <div className="flex gap-3 items-center text-xs text-muted-foreground flex-wrap justify-end">
                        <span><b className="text-foreground">{fmtNum(group.orderCount)}</b> ta</span>
                        {unitStr && <span className="text-foreground font-medium">{unitStr}</span>}
                        {balonStr && (
                          <span className="text-violet-600 dark:text-violet-400 font-semibold">{balonStr}</span>
                        )}
                        {group.totalPrice > 0 && (
                          <span><b className="text-amber-600 dark:text-amber-400">{fmtMoney(group.totalPrice)}</b> so'm</span>
                        )}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {group.types.length > 1 && (() => {
                      // Balon tsex qatorlarini bitta qilib ko'rsat
                      const balonRows = group.types.filter((r: any) => r.service_type_name === BALON_SERVICE_NAME);
                      const otherRows = group.types.filter((r: any) => r.service_type_name !== BALON_SERVICE_NAME);
                      const balonOrderCount = balonRows.reduce((s: number, r: any) => s + (r.order_count ?? 0), 0);
                      const balonPrice = balonRows.reduce((s: number, r: any) => s + (r.total_price ?? 0), 0);
                      const balonB = calcBalonFromRows(balonRows);
                      const balonDisplayStr = fmtBalon(balonB.metr, balonB.sm, balonB.kardon);

                      // Unique non-balon rows (service_type_id level, merge units per type)
                      const otherMerged: Record<number, any> = {};
                      for (const r of otherRows) {
                        if (!otherMerged[r.service_type_id]) {
                          otherMerged[r.service_type_id] = { ...r };
                        } else {
                          otherMerged[r.service_type_id].order_count += r.order_count;
                          otherMerged[r.service_type_id].total_price += r.total_price;
                          otherMerged[r.service_type_id].total_quantity += r.total_quantity;
                        }
                      }

                      const allDisplayRows = [
                        ...Object.values(otherMerged),
                        ...(balonRows.length ? [{ _isBalon: true, order_count: balonOrderCount, total_price: balonPrice }] : []),
                      ];

                      return (
                        <div className="divide-y divide-border/50 border-t">
                          {allDisplayRows.map((r: any, i: number) => (
                            <div key={r._isBalon ? "balon" : `${r.service_type_id}-${i}`}
                              className="px-4 py-2 flex items-center justify-between text-sm">
                              <span className="text-muted-foreground font-medium">
                                {r._isBalon ? BALON_SERVICE_NAME : r.service_type_name}
                              </span>
                              <div className="flex gap-3 text-xs flex-wrap justify-end">
                                <span className="text-foreground">{fmtNum(r.order_count)} ta</span>
                                {r._isBalon
                                  ? balonDisplayStr && <span className="text-violet-600 dark:text-violet-400 font-semibold">{balonDisplayStr}</span>
                                  : <span className="text-foreground">{fmtNum(r.total_quantity)} {r.unit || "dona"}</span>
                                }
                                {r.total_price > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400">{fmtMoney(r.total_price)} so'm</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {isExpanded && (
                      <div className="border-t bg-background">
                        {drillLoading ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                        ) : drillOrders.length === 0 ? (
                          <div className="text-center py-4 text-xs text-muted-foreground">Zakazlar topilmadi</div>
                        ) : (
                          <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
                            {drillOrders.map((o: any) => (
                              <div key={o.id} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                                <div className="font-mono text-xs text-primary font-bold shrink-0 pt-0.5">#{o.order_id}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{o.service_type_name}</span>
                                    {o.client_name && <span className="text-xs text-muted-foreground">— {o.client_name}</span>}
                                  </div>
                                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span>{fmtNum(parseFloat(o.quantity))} {o.unit || ""}</span>
                                    {o.price && parseFloat(o.price) > 0 && (
                                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{fmtMoney(parseFloat(o.price))} so'm</span>
                                    )}
                                    {o.product && <span>{o.product}</span>}
                                    <span>{STATUS_LABELS[o.status] ?? o.status}</span>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground shrink-0">
                                  {fmtTime(o.created_at)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== MIJOZLAR VIEW ===== */}
      {view === "mijozlar" && (() => {
        const filteredClients = clients.filter(c => {
          const bal = balNum(c.balance);
          if (showOnlyDebt && bal >= 0) return false;
          if (search) {
            const s = search.toLowerCase();
            if (!(`${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase().includes(s) || (c.phone ?? "").includes(s))) return false;
          }
          return true;
        });
        const totalDebt   = clients.reduce((s, c) => s + (balNum(c.balance) < 0 ? Math.abs(balNum(c.balance)) : 0), 0);
        const totalHaq    = clients.reduce((s, c) => s + (balNum(c.balance) > 0 ? balNum(c.balance) : 0), 0);
        const totalDokon  = allTx.filter((t: any) => STORE_PAY_TYPES.includes(t.type as TxType)).reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);
        return (
          <div className="space-y-4">
            {nasiyaLoading && !clients.length ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-200 dark:border-red-800 text-center">
                    <div className="text-base font-bold text-red-600">{fmtMoney(totalDebt)}</div>
                    <div className="text-[10px] text-red-500 mt-0.5">Jami qarz</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3 border border-orange-200 dark:border-orange-800 text-center">
                    <div className="text-base font-bold text-orange-600">{fmtMoney(totalDokon)}</div>
                    <div className="text-[10px] text-orange-500 mt-0.5">Dokonga berishi</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 border border-green-200 dark:border-green-800 text-center">
                    <div className="text-base font-bold text-green-600">{fmtMoney(totalHaq)}</div>
                    <div className="text-[10px] text-green-500 mt-0.5">Ortiqcha to'lov</div>
                  </div>
                </div>

                {/* Search + filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Mijoz qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                  <button
                    onClick={() => setShowOnlyDebt(!showOnlyDebt)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0 ${showOnlyDebt ? "bg-red-500 text-white border-red-500" : "bg-card border-border text-muted-foreground"}`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />Qarzdorlar
                  </button>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={fetchNasiyaData}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>

                {/* Client list */}
                <div className="space-y-2">
                  {filteredClients.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Mijoz topilmadi</div>}
                  {filteredClients.map(client => {
                    const isExp = expandedClient === client.id;
                    const bd = clientBreakdown(client.id);
                    const bal = balNum(client.balance);
                    return (
                      <div key={client.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                        <div className="w-full text-left p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(client.id)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{[client.firstName, client.lastName].filter(Boolean).join(" ") || "Noma'lum"}</span>
                              {client.phone && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Phone className="w-3 h-3" />{client.phone}</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {bal < 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 font-semibold">−{fmtMoney(bal)} qarz</span>}
                              {bal > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 font-semibold">+{fmtMoney(bal)} haq</span>}
                              {bal === 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">0</span>}
                              {bd.dokonBerishi > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600">🏪 {fmtMoney(bd.dokonBerishi)}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={e => { e.stopPropagation(); setPayClient(client); setPayAmount(""); setPayNote(""); setPayType("tolov"); setPayServiceTypeId(""); }}>
                              <Wallet className="w-3 h-3 mr-1" />To'lov
                            </Button>
                            <button className="text-muted-foreground" onClick={() => toggleExpand(client.id)}>
                              {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        {isExp && (
                          <div className="border-t">
                            <div className="p-3 bg-muted/20 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              {bd.qarz > 0 && <div className="flex justify-between bg-red-50 dark:bg-red-950/30 rounded-lg px-2 py-1.5"><span className="text-red-500">📋 Nasiya</span><span className="font-bold text-red-600">{fmtMoney(bd.qarz)}</span></div>}
                              {bd.tolov > 0 && <div className="flex justify-between bg-purple-50 dark:bg-purple-950/30 rounded-lg px-2 py-1.5"><span className="text-purple-500">💰 To'lov</span><span className="font-bold text-purple-600">{fmtMoney(bd.tolov)}</span></div>}
                              {bd.naqd > 0 && <div className="flex justify-between bg-green-50 dark:bg-green-950/30 rounded-lg px-2 py-1.5"><span className="text-green-500">💵 Naqd</span><span className="font-bold text-green-600">{fmtMoney(bd.naqd)}</span></div>}
                              {bd.click > 0 && <div className="flex justify-between bg-blue-50 dark:bg-blue-950/30 rounded-lg px-2 py-1.5"><span className="text-blue-500">📲 Click</span><span className="font-bold text-blue-600">{fmtMoney(bd.click)}</span></div>}
                              {bd.dokonga > 0 && <div className="flex justify-between bg-orange-50 dark:bg-orange-950/30 rounded-lg px-2 py-1.5"><span className="text-orange-500">🏪 Dokonga</span><span className="font-bold text-orange-600">{fmtMoney(bd.dokonga)}</span></div>}
                              {bd.dokonBerishi > 0 && <div className="col-span-full flex justify-between bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1.5 border border-amber-200"><span className="text-amber-700 font-semibold">🏪 Dokonga berishi kerak</span><span className="font-bold text-amber-700">{fmtMoney(bd.dokonBerishi)}</span></div>}
                            </div>
                            {clientTxLoading === client.id ? (
                              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                            ) : (
                              <div className="divide-y divide-border/40 max-h-64 overflow-y-auto">
                                {(clientTx[client.id] ?? []).length === 0 && <div className="text-center py-4 text-xs text-muted-foreground">Tranzaksiya yo'q</div>}
                                {(clientTx[client.id] ?? []).map((tx: any) => {
                                  const meta = TX_META[tx.type as TxType] ?? TX_META.tuzatish;
                                  return (
                                    <div key={tx.id} className="flex items-start justify-between px-3 py-2 text-xs">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.color}`}>{meta.icon} {meta.label}</span>
                                        <div className="min-w-0">
                                          <div className="text-muted-foreground truncate">{tx.service_type_name || tx.note || "—"}</div>
                                          {tx.order_code && <div className="text-muted-foreground/60">#{tx.order_code}</div>}
                                          <div className="text-muted-foreground/50">{fmtDate(tx.created_at)}</div>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 ml-2">
                                        <div className={`font-bold ${tx.type === "qarz" ? "text-red-500" : tx.type === "tolov" ? "text-purple-600" : tx.type === "naqd" ? "text-green-600" : tx.type === "click" ? "text-blue-600" : tx.type === "dokonga" ? "text-orange-600" : "text-foreground"}`}>
                                          {tx.type === "qarz" ? "−" : "+"}{fmtMoney(Math.abs(parseFloat(tx.amount ?? "0")))}
                                        </div>
                                        <div className="text-muted-foreground/50 text-[10px]">Bal: {balNum(tx.balance_after) < 0 ? `−${fmtMoney(balNum(tx.balance_after))}` : `+${fmtMoney(balNum(tx.balance_after))}`}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ===== DOKON VIEW ===== */}
      {view === "dokon" && (() => {
        // Summary calculations from dokonOrders + dokonTx
        const ordNaqd    = dokonOrders.filter(o => o.payment_type === "naqd").reduce((s, o) => s + parseFloat(o.price ?? "0"), 0);
        const ordClick   = dokonOrders.filter(o => o.payment_type === "click").reduce((s, o) => s + parseFloat(o.price ?? "0"), 0);
        const ordDokonga = dokonOrders.filter(o => o.payment_type === "dokonga").reduce((s, o) => s + parseFloat(o.price ?? "0"), 0);
        const ordQarz    = dokonOrders.filter(o => o.payment_type === "qarz").reduce((s, o) => s + parseFloat(o.price ?? "0"), 0);
        const dokonJami  = ordNaqd + ordDokonga;
        const txTolov    = dokonTx.filter(t => t.type === "tolov").reduce((s, t) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);
        const txNaqd     = dokonTx.filter(t => t.type === "naqd").reduce((s, t) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);
        const txClick    = dokonTx.filter(t => t.type === "click").reduce((s, t) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);
        const txDokonga  = dokonTx.filter(t => t.type === "dokonga").reduce((s, t) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);
        const txQarz     = dokonTx.filter(t => t.type === "qarz").reduce((s, t) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);

        return (
          <div className="space-y-4">
            {/* Date + filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <Input type="date" value={dokonDate} onChange={e => setDokonDate(e.target.value)} className="h-9 w-44" />
              {clients.length > 0 && (
                <select
                  className="h-9 rounded-lg border border-border bg-card text-sm px-2 max-w-[180px]"
                  value={dokonClientId ?? ""}
                  onChange={e => setDokonClientId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Barcha mijozlar —</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || `#${c.id}`}</option>
                  ))}
                </select>
              )}
              {serviceTypes.length > 0 && (
                <select
                  className="h-9 rounded-lg border border-border bg-card text-sm px-2 max-w-[160px]"
                  value={dokonServiceTypeId ?? ""}
                  onChange={e => setDokonServiceTypeId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Barcha xizmatlar —</option>
                  {serviceTypes.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={fetchDokon} disabled={dokonLoading}>
                {dokonLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Yangilash
              </Button>
            </div>

            {dokonLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Payment summary cards */}
                <div className="grid grid-cols-2 gap-2">
                  <Card className="border-amber-200 dark:border-amber-800 col-span-2">
                    <CardContent className="p-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        📅 {new Date(dokonDate + "T12:00:00").toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" })} — Zakazlar hisobi
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        <div><span className="text-muted-foreground text-xs">Zakazlar: </span><b>{dokonOrders.length} ta</b></div>
                        {dokonOrders.length > 0 && (
                          <div><span className="text-muted-foreground text-xs">Jami summa: </span><b className="text-amber-600">{fmtMoney(dokonOrders.reduce((s, o) => s + parseFloat(o.price ?? "0"), 0))} so'm</b></div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ordNaqd > 0 && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 px-2 py-1 rounded-full font-semibold">💵 Naqd: {fmtMoney(ordNaqd)}</span>}
                        {ordClick > 0 && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 px-2 py-1 rounded-full font-semibold">📲 Click: {fmtMoney(ordClick)}</span>}
                        {ordDokonga > 0 && <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 px-2 py-1 rounded-full font-semibold">🏪 Dokonga: {fmtMoney(ordDokonga)}</span>}
                        {ordQarz > 0 && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 px-2 py-1 rounded-full font-semibold">📋 Nasiya: {fmtMoney(ordQarz)}</span>}
                        {dokonJami > 0 && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 px-2 py-1 rounded-full font-bold border border-amber-300">🏪 Dokonga jami: {fmtMoney(dokonJami)}</span>}
                      </div>
                    </CardContent>
                  </Card>

                  {(txTolov > 0 || txNaqd > 0 || txClick > 0 || txDokonga > 0 || txQarz > 0) && (
                    <Card className="border-purple-200 dark:border-purple-800 col-span-2">
                      <CardContent className="p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">💰 Mijozlar tranzaksiyalari (nasiya to'lovlari)</div>
                        <div className="flex flex-wrap gap-2">
                          {txTolov > 0 && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 px-2 py-1 rounded-full font-semibold">💰 Qarz uzildi: {fmtMoney(txTolov)}</span>}
                          {txNaqd > 0 && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 px-2 py-1 rounded-full font-semibold">💵 Naqd tx: {fmtMoney(txNaqd)}</span>}
                          {txClick > 0 && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 px-2 py-1 rounded-full font-semibold">📲 Click tx: {fmtMoney(txClick)}</span>}
                          {txDokonga > 0 && <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 px-2 py-1 rounded-full font-semibold">🏪 Dokonga tx: {fmtMoney(txDokonga)}</span>}
                          {txQarz > 0 && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 px-2 py-1 rounded-full font-semibold">📋 Yangi nasiya: {fmtMoney(txQarz)}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Order list */}
                {dokonOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Bu sanada zakazlar topilmadi</div>
                ) : (
                  <Card className="overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/50 text-sm font-semibold">Zakazlar ro'yxati ({dokonOrders.length} ta)</div>
                    <div className="divide-y divide-border/40">
                      {dokonOrders.map((o: any) => {
                        const pmeta = o.payment_type ? PAYMENT_META[o.payment_type as string] : null;
                        const price = fmtPrice(o.price);
                        const qty = fmtQty(o.quantity, o.unit);
                        return (
                          <div key={o.id} className="px-4 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <div className="text-xs text-muted-foreground w-10 shrink-0">{fmtTime(o.created_at)}</div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm">{o.service_type_name}</span>
                                {o.client_name && <span className="ml-2 text-xs text-muted-foreground">{o.client_name}</span>}
                                {o.client_phone && <span className="ml-1 text-xs text-muted-foreground">· {o.client_phone}</span>}
                              </div>
                              <div className="flex items-center gap-2 text-xs shrink-0">
                                {qty && <span className="text-muted-foreground">{qty}</span>}
                                {pmeta && <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${pmeta.cls}`}>{pmeta.icon} {pmeta.label}</span>}
                                {price && <span className="font-bold text-amber-600 dark:text-amber-400">{price}</span>}
                                <span className="text-muted-foreground/50">#{o.order_id ?? o.id}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Client tx list */}
                {dokonTx.length > 0 && (
                  <Card className="overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/50 text-sm font-semibold">Nasiya tranzaksiyalari ({dokonTx.length} ta)</div>
                    <div className="divide-y divide-border/40">
                      {dokonTx.map((tx: any) => {
                        const meta = TX_META[tx.type as TxType] ?? TX_META.tuzatish;
                        return (
                          <div key={tx.id} className="px-4 py-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.color}`}>{meta.icon} {meta.label}</span>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{tx.client_name ?? "Noma'lum"}</div>
                                {tx.client_phone && <div className="text-muted-foreground">{tx.client_phone}</div>}
                                <div className="text-muted-foreground/60">{tx.service_type_name || tx.note || ""}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <div className={`font-bold ${tx.type === "qarz" ? "text-red-500" : tx.type === "tolov" ? "text-purple-600" : tx.type === "naqd" ? "text-green-600" : tx.type === "click" ? "text-blue-600" : tx.type === "dokonga" ? "text-orange-600" : "text-foreground"}`}>
                                {tx.type === "qarz" ? "−" : "+"}{fmtMoney(Math.abs(parseFloat(tx.amount ?? "0")))}
                              </div>
                              <div className="text-muted-foreground/50">{fmtTime(tx.created_at)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Payment Modal (Mijozlar view) */}
      <Dialog open={!!payClient} onOpenChange={v => { if (!v) setPayClient(null); }}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" />To'lov yozish</DialogTitle>
            <DialogDescription>
              {payClient && [payClient.firstName, payClient.lastName].filter(Boolean).join(" ")}
              {payClient && (
                <span className={`ml-2 font-bold ${balNum(payClient.balance) < 0 ? "text-red-500" : "text-green-600"}`}>
                  ({balNum(payClient.balance) < 0 ? `−${fmtMoney(balNum(payClient.balance))} qarz` : `+${fmtMoney(balNum(payClient.balance))}`})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {(["tolov", "naqd", "click", "dokonga", "qarz", "tuzatish"] as TxType[]).map(t => {
                const m = TX_META[t];
                return (
                  <button key={t} onClick={() => setPayType(t)}
                    className={`py-2 rounded-lg text-xs font-bold border-2 transition-all ${payType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
            <Input type="text" inputMode="numeric" placeholder="0" value={payAmount}
              onChange={e => setPayAmount(fmtAmt(e.target.value))} className="text-xl font-bold h-12 text-center tabular-nums" autoFocus />
            {nasiyaServiceTypes.length > 0 && (
              <Select value={payServiceTypeId || "__none__"} onValueChange={v => setPayServiceTypeId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Xizmat turi (ixtiyoriy)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Tanlang —</SelectItem>
                  {nasiyaServiceTypes.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input placeholder="Izoh (ixtiyoriy)" value={payNote} onChange={e => setPayNote(e.target.value)} className="h-9 text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayClient(null)} disabled={payLoading}>Bekor</Button>
            <Button disabled={payLoading || !payAmount} onClick={doPayment} className="gap-2">
              {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick "+" tranzaksiya modal */}
      <Dialog open={quickOpen} onOpenChange={v => { if (!v) setQuickOpen(false); }}>
        <DialogContent className="w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Plus className="w-5 h-5" />
              Tez tranzaksiya
            </DialogTitle>
            <DialogDescription>Mijoz balansiga tranzaksiya qo'shing</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Mijoz qidirish */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mijoz</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background"
                  placeholder="Mijoz ismini kiriting..."
                  value={quickClientSearch}
                  onChange={e => { setQuickClientSearch(e.target.value); setQuickClientId(null); setQuickClientBal(null); }}
                />
              </div>
              {/* Mijozlar ro'yxati — faqat input bo'lsa va id tanlanmagan bo'lsa */}
              {quickClientSearch.trim().length >= 1 && !quickClientId && (() => {
                const matches = clients.filter((c: any) =>
                  c.name?.toLowerCase().includes(quickClientSearch.toLowerCase()) ||
                  c.phone?.includes(quickClientSearch)
                ).slice(0, 6);
                if (!matches.length) return <div className="text-xs text-muted-foreground px-2 py-1">Topilmadi</div>;
                return (
                  <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                    {matches.map((c: any) => (
                      <button
                        key={c.id}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center justify-between border-b border-border/40 last:border-0"
                        onClick={() => selectQuickClient(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className={`text-xs tabular-nums ${balNum(c.balance) < 0 ? "text-red-500" : balNum(c.balance) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {balNum(c.balance) < 0 ? `−${Math.abs(balNum(c.balance)).toLocaleString("uz-UZ")} qarz` : balNum(c.balance) > 0 ? `+${balNum(c.balance).toLocaleString("uz-UZ")}` : "0"}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
              {/* Tanlangan mijoz balans */}
              {quickClientId && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">Hozirgi balans:</span>
                  {quickClientBalLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <span className={`font-bold tabular-nums ${(quickClientBal ?? 0) < 0 ? "text-red-500" : (quickClientBal ?? 0) > 0 ? "text-green-600" : ""}`}>
                        {(quickClientBal ?? 0) < 0 ? `−${Math.abs(quickClientBal!).toLocaleString("uz-UZ")}` : (quickClientBal ?? 0) > 0 ? `+${quickClientBal!.toLocaleString("uz-UZ")}` : "0"} so'm
                        {(quickClientBal ?? 0) < 0 && <span className="ml-1 text-amber-600 font-normal">(eski nasiya mavjud)</span>}
                      </span>
                  }
                </div>
              )}
            </div>

            {/* + / - tugmalar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setQuickType("+"); setQuickTxType("tolov"); }}
                className={`h-12 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-1.5 ${quickType === "+" ? "bg-green-500 text-white border-green-500 shadow" : "border-border text-muted-foreground hover:border-green-400"}`}
              >
                <span className="text-lg leading-none">+</span> Kirim / To'lov
              </button>
              <button
                onClick={() => { setQuickType("-"); setQuickTxType("qarz"); }}
                className={`h-12 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-1.5 ${quickType === "-" ? "bg-red-500 text-white border-red-500 shadow" : "border-border text-muted-foreground hover:border-red-400"}`}
              >
                <span className="text-lg leading-none">−</span> Qarz / Chiqim
              </button>
            </div>

            {/* Kirim turi (faqat + bo'lsa) */}
            {quickType === "+" && (
              <div className="grid grid-cols-3 gap-1.5">
                {(["tolov", "naqd", "click"] as TxType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setQuickTxType(t)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${quickTxType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                  >
                    {TX_META[t].icon} {TX_META[t].label}
                  </button>
                ))}
              </div>
            )}

            {/* Summa */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Summa (so'm)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                placeholder="0"
                value={quickAmount}
                onChange={e => setQuickAmount(fmtAmt(e.target.value))}
              />
            </div>

            {/* Xizmat turi */}
            {nasiyaServiceTypes.length > 1 && (
              <Select value={quickServiceTypeId} onValueChange={setQuickServiceTypeId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Xizmat turi (ixtiyoriy)" />
                </SelectTrigger>
                <SelectContent>
                  {nasiyaServiceTypes.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Izoh */}
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={quickClientBal != null && (quickClientBal ?? 0) < 0 && quickType === "+" ? "Eski nasiyadan (ixtiyoriy)" : "Izoh (ixtiyoriy)"}
              value={quickNote}
              onChange={e => setQuickNote(e.target.value)}
            />
            {quickClientBal != null && (quickClientBal ?? 0) < 0 && quickType === "+" && !quickNote && (
              <button
                className="text-xs text-amber-600 underline underline-offset-2 -mt-1"
                onClick={() => setQuickNote("Eski nasiyadan")}
              >
                + "Eski nasiyadan" deb belgilash
              </button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuickOpen(false)} disabled={quickLoading}>Bekor</Button>
            <Button
              disabled={quickLoading || !quickClientId || !quickAmount}
              onClick={doQuickTx}
              className={`gap-2 ${quickType === "-" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
            >
              {quickLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
              {quickType === "-" ? "Qarz yozish" : "To'lov qabul"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
