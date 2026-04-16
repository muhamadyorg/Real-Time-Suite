import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, ShoppingBag, Layers, Wallet } from "lucide-react";

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

const fmtPeriod = (isoStr: string, period: Period) => {
  const d = new Date(isoStr);
  if (period === "daily")   return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (period === "weekly")  return `${d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} hafta`;
  if (period === "monthly") return d.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
  return isoStr.slice(0, 10);
};

export function AnalyticsView({ storeId, token, serviceTypes = [] }: AnalyticsViewProps) {
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const [period, setPeriod] = useState<Period>("daily");
  const [selTypes, setSelTypes] = useState<number[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      const r = await fetch(
        `${apiBase}/api/analytics?storeId=${storeId}&period=${period}&days=${PERIOD_DAYS[period]}${ids}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        setData(await r.json());
        setLastFetch(new Date());
      }
    } catch {}
    setLoading(false);
  }, [storeId, period, selTypes, token, apiBase]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const toggleType = (id: number) =>
    setSelTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const summary = data?.summary;
  const rows: any[] = data?.rows ?? [];

  // Group rows by period for table display
  const periodGroups = rows.reduce((acc: any, row: any) => {
    const key = row.period;
    if (!acc[key]) acc[key] = { period: key, orderCount: 0, totalQuantity: 0, totalPrice: 0, types: [] };
    acc[key].orderCount += row.order_count;
    acc[key].totalQuantity += row.total_quantity;
    acc[key].totalPrice += row.total_price;
    acc[key].types.push(row);
    return acc;
  }, {});
  const periodList = Object.values(periodGroups) as any[];

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {(["daily", "weekly", "monthly"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
              period === p
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Service type filter */}
      {serviceTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Filtr:</span>
          {serviceTypes.map(st => {
            const sel = selTypes.includes(st.id);
            return (
              <button
                key={st.id}
                onClick={() => toggleType(st.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  sel
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
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
      <div className="grid grid-cols-3 gap-3">
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

        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Jami miqdor</span>
            </div>
            <div className="text-2xl font-black tabular-nums">
              {loading && !data ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_quantity)}
            </div>
            <div className="text-xs text-muted-foreground">dona/m/kg</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Jami summa</span>
            </div>
            <div className="text-xl font-black tabular-nums leading-tight">
              {loading && !data ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_price)}
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
          {periodList.map((group: any) => (
            <Card key={group.period} className="overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50 flex items-center justify-between">
                <span className="font-semibold text-sm">{fmtPeriod(group.period, period)}</span>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span><b className="text-foreground">{fmtNum(group.orderCount)}</b> ta zakaz</span>
                  <span><b className="text-foreground">{fmtNum(group.totalQuantity)}</b> dona</span>
                  {group.totalPrice > 0 && (
                    <span><b className="text-amber-600 dark:text-amber-400">{fmtNum(group.totalPrice)}</b> so'm</span>
                  )}
                </div>
              </div>
              {group.types.length > 1 && (
                <div className="divide-y divide-border/50">
                  {group.types.map((r: any) => (
                    <div key={`${r.period}-${r.service_type_id}`} className="px-4 py-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">{r.service_type_name}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-foreground">{fmtNum(r.order_count)} ta</span>
                        <span className="text-foreground">{fmtNum(r.total_quantity)} dona</span>
                        {r.total_price > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">{fmtNum(r.total_price)} so'm</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
