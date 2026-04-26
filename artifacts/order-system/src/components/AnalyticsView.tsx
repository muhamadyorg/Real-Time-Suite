import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, TrendingUp, ShoppingBag, Wallet, ChevronDown, ChevronUp, Calendar, X } from "lucide-react";

interface AnalyticsViewProps {
  storeId: number;
  token: string;
  serviceTypes?: { id: number; name: string }[];
}

type Period = "daily" | "weekly" | "monthly";
const PERIOD_LABELS: Record<Period, string> = {
  daily: "Kunlik (30 kun)",
  weekly: "Haftalik (12 hafta)",
  monthly: "Oylik (12 oy)",
};
const PERIOD_DAYS: Record<Period, number> = { daily: 30, weekly: 84, monthly: 365 };

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

const STATUS_LABELS: Record<string, string> = {
  new: "Yangi", accepted: "Qabul", ready: "Tayyor", delivered: "Yetkazildi", cancelled: "Bekor",
};

export function AnalyticsView({ storeId, token, serviceTypes = [] }: AnalyticsViewProps) {
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const [period, setPeriod] = useState<Period>("daily");
  const [selTypes, setSelTypes] = useState<number[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const [specificDate, setSpecificDate] = useState<string>("");
  const [useSpecificDate, setUseSpecificDate] = useState(false);

  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [drillOrders, setDrillOrders] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      let url: string;
      if (useSpecificDate && specificDate) {
        url = `${apiBase}/api/analytics?storeId=${storeId}&period=daily&date=${specificDate}${ids}`;
      } else {
        url = `${apiBase}/api/analytics?storeId=${storeId}&period=${period}&days=${PERIOD_DAYS[period]}${ids}`;
      }
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        setData(await r.json());
        setLastFetch(new Date());
      }
    } catch {}
    setLoading(false);
  }, [storeId, period, selTypes, token, apiBase, useSpecificDate, specificDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (useSpecificDate) return;
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData, useSpecificDate]);

  const toggleType = (id: number) =>
    setSelTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const fetchDrillOrders = async (periodStart: string, periodEnd: string, serviceTypeId?: number) => {
    setDrillLoading(true);
    try {
      const stId = serviceTypeId ? `&serviceTypeId=${serviceTypeId}` : "";
      const ids = selTypes.length && !serviceTypeId ? `&serviceTypeId=${selTypes[0]}` : stId;
      const r = await fetch(
        `${apiBase}/api/analytics/orders?storeId=${storeId}&periodStart=${periodStart}&periodEnd=${periodEnd}${ids}`,
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

  const summary = data?.summary;
  const rows: any[] = data?.rows ?? [];

  const periodGroups = rows.reduce((acc: any, row: any) => {
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

  const activePeriod = useSpecificDate ? "daily" : period;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Hisobotlar</h2>
          {lastFetch && (
            <span className="text-xs text-muted-foreground">
              · {lastFetch.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Yangilash
        </Button>
      </div>

      {/* Period selector + Calendar */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          {!useSpecificDate && (["daily", "weekly", "monthly"] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                period === p
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50"
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button
            onClick={() => { setUseSpecificDate(v => !v); if (!specificDate) setSpecificDate(new Date().toISOString().slice(0, 10)); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
              useSpecificDate
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card border-border text-muted-foreground hover:border-primary/50"
            }`}>
            <Calendar className="w-3.5 h-3.5" />
            Kun tanlash
          </button>
        </div>
        {useSpecificDate && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={specificDate}
              onChange={e => setSpecificDate(e.target.value)}
              className="h-9 w-44"
            />
            <span className="text-sm font-medium text-primary">{specificDate ? fmtDateLabel(specificDate) : ""}</span>
            <button onClick={() => setUseSpecificDate(false)} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Service type filter */}
      {serviceTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Filtr:</span>
          {serviceTypes.map(st => {
            const sel = selTypes.includes(st.id);
            return (
              <button key={st.id} onClick={() => toggleType(st.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  sel
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40"
                }`}>
                {st.name}
              </button>
            );
          })}
          {selTypes.length > 0 && (
            <button onClick={() => setSelTypes([])} className="text-xs text-muted-foreground hover:text-foreground underline">
              Barchasi
            </button>
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
              {loading && !data ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_orders)}
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
              {loading && !data ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtMoney(summary?.total_price)}
            </div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown table */}
      {loading && !data ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : periodList.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Ma'lumot topilmadi</div>
      ) : (
        <div className="space-y-2">
          {periodList.map((group: any) => {
            const pKey = group.period;
            const { start, end } = getPeriodRange(pKey, activePeriod);
            const isExpanded = expandedPeriod === pKey;
            const unitStr = Object.entries(group.unitTotals as Record<string, number>)
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
                  <div className="flex gap-3 items-center text-xs text-muted-foreground">
                    <span><b className="text-foreground">{fmtNum(group.orderCount)}</b> ta</span>
                    {unitStr && <span className="text-foreground font-medium">{unitStr}</span>}
                    {group.totalPrice > 0 && (
                      <span><b className="text-amber-600 dark:text-amber-400">{fmtMoney(group.totalPrice)}</b> so'm</span>
                    )}
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {/* Service type breakdown */}
                {group.types.length > 1 && (
                  <div className="divide-y divide-border/50 border-t">
                    {group.types.map((r: any) => (
                      <div key={`${r.period}-${r.service_type_id}-${r.unit}`}
                        className="px-4 py-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">{r.service_type_name}</span>
                        <div className="flex gap-3 text-xs">
                          <span className="text-foreground">{fmtNum(r.order_count)} ta</span>
                          <span className="text-foreground">{fmtNum(r.total_quantity)} {r.unit || "dona"}</span>
                          {r.total_price > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">{fmtMoney(r.total_price)} so'm</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drill-down individual orders */}
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
                                {o.client_name && (
                                  <span className="text-xs text-muted-foreground">— {o.client_name}</span>
                                )}
                              </div>
                              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                <span>{fmtNum(parseFloat(o.quantity))} {o.unit || ""}</span>
                                {o.price && parseFloat(o.price) > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    {fmtMoney(parseFloat(o.price))} so'm
                                  </span>
                                )}
                                {o.product && <span>{o.product}</span>}
                                <span>{STATUS_LABELS[o.status] ?? o.status}</span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground shrink-0">
                              {new Date(o.created_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
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
    </div>
  );
}
