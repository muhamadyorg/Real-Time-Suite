import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, TrendingUp, ShoppingBag, Wallet, ChevronDown, ChevronUp, Calendar, X, Layers } from "lucide-react";

interface AnalyticsViewProps {
  storeId: number;
  token: string;
  serviceTypes?: { id: number; name: string }[];
}

type Period = "daily" | "weekly" | "monthly";
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

export function AnalyticsView({ storeId, token, serviceTypes = [] }: AnalyticsViewProps) {
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const [period, setPeriod] = useState<Period>("daily");
  const [selTypes, setSelTypes] = useState<number[]>([]);
  const [view, setView] = useState<"batafsil" | "jami">("batafsil");

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

  const fetchAgg = useCallback(async () => {
    setAggLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      let url: string;
      if (useSpecificDate && specificDate) {
        url = `${apiBase}/api/analytics?storeId=${storeId}&period=daily&date=${specificDate}${ids}`;
      } else {
        url = `${apiBase}/api/analytics?storeId=${storeId}&period=${period}&days=${PERIOD_DAYS[period]}${ids}`;
      }
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setAggData(await r.json());
    } catch {}
    setAggLoading(false);
  }, [storeId, period, selTypes, token, apiBase, useSpecificDate, specificDate]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      const r = await fetch(
        `${apiBase}/api/analytics/orders?storeId=${storeId}&days=${PERIOD_DAYS[period]}${ids}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) setOrders(await r.json());
    } catch {}
    setOrdersLoading(false);
  }, [storeId, period, selTypes, token, apiBase]);

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

  const summary = view === "batafsil"
    ? { total_orders: orders.length, total_price: orders.reduce((s, o) => s + parseFloat(o.price ?? "0"), 0) }
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
        <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Yangilash
        </Button>
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
        </div>

        {/* Period */}
        {(["daily", "weekly", "monthly"] as Period[]).map(p => (
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
          <span className="text-xs text-muted-foreground self-center">Filtr:</span>
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

      {/* Summary cards */}
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
      </div>

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

                    {/* Order rows */}
                    {!collapsed && (
                      <div className="divide-y divide-border/40">
                        {group.orders.map((o: any) => {
                          const price = fmtPrice(o.price);
                          const qty = fmtQty(o.quantity, o.unit);
                          return (
                            <div key={o.id} className="px-4 py-2.5">
                              {/* Mobile layout */}
                              <div className="flex items-center justify-between gap-2 sm:hidden">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{o.service_type_name}</div>
                                  {o.client_name && <div className="text-xs text-muted-foreground truncate">{o.client_name}</div>}
                                </div>
                                <div className="text-right shrink-0">
                                  {qty && <div className="text-xs">{qty}</div>}
                                  {price
                                    ? <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">{price}</div>
                                    : <div className="text-xs text-muted-foreground italic">narx yo'q</div>}
                                </div>
                              </div>
                              {/* Desktop layout */}
                              <div className="hidden sm:flex items-center gap-4 text-sm">
                                <div className="text-xs text-muted-foreground w-10 shrink-0">{fmtTime(o.created_at)}</div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{o.service_type_name}</span>
                                  {o.client_name && <span className="ml-2 text-xs text-muted-foreground">{o.client_name}</span>}
                                  {o.client_phone && <span className="ml-1 text-xs text-muted-foreground">· {o.client_phone}</span>}
                                </div>
                                <div className="text-xs w-24 text-right">{qty ?? "—"}</div>
                                <div className="text-xs w-32 text-right">
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
    </div>
  );
}
