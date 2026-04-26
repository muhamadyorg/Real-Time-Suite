import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, ShoppingBag, Layers, Wallet, X, ChevronDown, ChevronUp } from "lucide-react";

interface AnalyticsViewProps {
  storeId: number;
  token: string;
  serviceTypes?: { id: number; name: string }[];
}

type Period = "daily" | "weekly" | "monthly";
const PERIOD_LABELS: Record<Period, string> = {
  daily: "30 kun",
  weekly: "12 hafta",
  monthly: "12 oy",
};
const PERIOD_DAYS: Record<Period, number> = { daily: 30, weekly: 84, monthly: 365 };

const fmtNum = (n: number | null | undefined) =>
  n == null ? "0" : Math.round(n).toLocaleString("uz-UZ");

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

const fmtPeriod = (isoStr: string, period: Period) => {
  const d = new Date(isoStr);
  if (period === "daily")   return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (period === "weekly")  return `${d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })} hafta`;
  if (period === "monthly") return d.toLocaleDateString("uz-UZ", { month: "long", year: "numeric" });
  return isoStr.slice(0, 10);
};

const fmtDay = (isoStr: string) => {
  const d = new Date(isoStr);
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const fmtTime = (isoStr: string) => {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
};

// Order detail modal
function OrderDetailModal({ order, onClose, apiBase, token }: { order: any; onClose: () => void; apiBase: string; token: string }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) setDetail(await r.json());
      } catch {}
      setLoading(false);
    })();
  }, [order.id, apiBase, token]);

  const o = detail ?? order;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-base">Zakaz #{o.order_code ?? o.orderCode ?? o.id}</span>
            <span className="ml-2 text-xs text-muted-foreground">{fmtTime(o.created_at ?? o.createdAt)}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Service type */}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Xizmat turi</span>
              <span className="font-semibold text-sm">{o.service_type_name ?? o.serviceTypeName}</span>
            </div>

            {/* Client */}
            {(o.client_name ?? o.clientName) && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Mijoz</span>
                <span className="font-semibold text-sm">{o.client_name ?? o.clientName}</span>
              </div>
            )}
            {(o.client_phone ?? o.clientPhone) && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Telefon</span>
                <span className="font-semibold text-sm">{o.client_phone ?? o.clientPhone}</span>
              </div>
            )}

            {/* Quantity */}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Miqdor</span>
              <span className="font-semibold text-sm">
                {fmtQty(o.quantity, o.unit) ?? "—"}
              </span>
            </div>

            {/* Output quantity */}
            {(o.output_quantity ?? o.outputQuantity) && parseFloat(o.output_quantity ?? o.outputQuantity) > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Chiqish</span>
                <span className="font-semibold text-sm">
                  {fmtQty(o.output_quantity ?? o.outputQuantity, o.output_unit ?? o.outputUnit)}
                </span>
              </div>
            )}

            {/* Price */}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Narx</span>
              <span className={`font-semibold text-sm ${fmtPrice(o.price) ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground italic"}`}>
                {fmtPrice(o.price) ?? "kiritilmagan"}
              </span>
            </div>

            {/* Extra fields */}
            {(() => {
              const ef = o.extra_fields ?? o.extraFields;
              if (!ef || typeof ef !== "object") return null;
              const entries = Object.entries(ef).filter(([, v]) => v);
              if (!entries.length) return null;
              return (
                <div className="border-t pt-3 space-y-2">
                  {entries.map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{k}</span>
                      <span className="font-medium text-sm">{String(v)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Note */}
            {(o.note ?? o.notes) && (
              <div className="border-t pt-3">
                <span className="text-xs text-muted-foreground">Izoh</span>
                <p className="text-sm mt-1">{o.note ?? o.notes}</p>
              </div>
            )}

            {/* Status + time */}
            <div className="border-t pt-3 flex justify-between text-xs text-muted-foreground">
              <span>{new Date(o.created_at ?? o.createdAt).toLocaleString("uz-UZ")}</span>
              <span className="capitalize">{o.status}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyticsView({ storeId, token, serviceTypes = [] }: AnalyticsViewProps) {
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const [period, setPeriod] = useState<Period>("daily");
  const [selTypes, setSelTypes] = useState<number[]>([]);
  const [view, setView] = useState<"jami" | "batafsil">("batafsil");

  // Aggregated data
  const [aggData, setAggData] = useState<any>(null);
  const [aggLoading, setAggLoading] = useState(false);

  // Individual orders
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const fetchAgg = useCallback(async () => {
    setAggLoading(true);
    try {
      const ids = selTypes.length ? `&serviceTypeIds=${selTypes.join(",")}` : "";
      const r = await fetch(
        `${apiBase}/api/analytics?storeId=${storeId}&period=${period}&days=${PERIOD_DAYS[period]}${ids}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) setAggData(await r.json());
    } catch {}
    setAggLoading(false);
  }, [storeId, period, selTypes, token, apiBase]);

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
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const toggleType = (id: number) =>
    setSelTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const summary = aggData?.summary;
  const loading = aggLoading || ordersLoading;

  // Group aggregated by period
  const periodGroups = (aggData?.rows ?? []).reduce((acc: any, row: any) => {
    const key = row.period;
    if (!acc[key]) acc[key] = { period: key, orderCount: 0, totalQuantity: 0, totalPrice: 0, types: [] };
    acc[key].orderCount += row.order_count;
    acc[key].totalQuantity += row.total_quantity;
    acc[key].totalPrice += row.total_price;
    acc[key].types.push(row);
    return acc;
  }, {});
  const periodList = Object.values(periodGroups) as any[];

  // Group individual orders by day
  const dayGroups = orders.reduce((acc: any, o: any) => {
    const raw = o.day ?? o.created_at;
    const key = raw ? new Date(raw).toISOString().slice(0, 10) : "unknown";
    if (!acc[key]) acc[key] = { day: key, orders: [], totalPrice: 0, totalQty: 0 };
    acc[key].orders.push(o);
    acc[key].totalPrice += parseFloat(o.price ?? "0");
    acc[key].totalQty += parseFloat(o.quantity ?? "0");
    return acc;
  }, {});
  const dayList = Object.values(dayGroups) as any[];

  const toggleDay = (day: string) => {
    setCollapsedDays(prev => {
      const n = new Set(prev);
      n.has(day) ? n.delete(day) : n.add(day);
      return n;
    });
  };

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
                  sel ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
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
              {loading && !aggData ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_orders)}
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
              {loading && !aggData ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_quantity)}
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
              {loading && !aggData ? <Loader2 className="w-5 h-5 animate-spin" /> : fmtNum(summary?.total_price)}
            </div>
            <div className="text-xs text-muted-foreground">so'm</div>
          </CardContent>
        </Card>
      </div>

      {/* BATAFSIL — individual orders */}
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
                const dayPrice = fmtPrice(group.totalPrice);
                return (
                  <Card key={group.day} className="overflow-hidden">
                    {/* Day header */}
                    <button
                      className="w-full px-4 py-2.5 bg-muted/50 flex items-center justify-between hover:bg-muted/80 transition-colors"
                      onClick={() => toggleDay(group.day)}
                    >
                      <div className="flex items-center gap-2">
                        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-bold text-sm">{fmtDay(group.day + "T00:00:00")}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span><b className="text-foreground">{group.orders.length}</b> ta zakaz</span>
                        {dayPrice && <span className="hidden sm:inline"><b className="text-amber-600 dark:text-amber-400">{dayPrice}</b></span>}
                      </div>
                    </button>

                    {/* Order rows */}
                    {!collapsed && (
                      <div className="divide-y divide-border/40">
                        {group.orders.map((o: any) => {
                          const price = fmtPrice(o.price);
                          const qty = fmtQty(o.quantity, o.unit);
                          return (
                            <button
                              key={o.id}
                              className="w-full text-left px-4 py-2.5 hover:bg-muted/40 transition-colors active:bg-muted"
                              onClick={() => setSelectedOrder(o)}
                            >
                              {/* Mobile layout */}
                              <div className="flex items-center justify-between gap-2 sm:hidden">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{o.service_type_name}</div>
                                  {o.client_name && (
                                    <div className="text-xs text-muted-foreground truncate">{o.client_name}</div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {qty && <div className="text-xs text-foreground">{qty}</div>}
                                  {price
                                    ? <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">{price}</div>
                                    : <div className="text-xs text-muted-foreground italic">kiritilmagan</div>
                                  }
                                </div>
                              </div>

                              {/* Desktop layout */}
                              <div className="hidden sm:flex items-center gap-4">
                                <div className="w-5 text-xs text-muted-foreground">{fmtTime(o.created_at)}</div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-sm">{o.service_type_name}</span>
                                  {o.client_name && (
                                    <span className="ml-2 text-xs text-muted-foreground">{o.client_name}</span>
                                  )}
                                  {o.client_phone && (
                                    <span className="ml-1 text-xs text-muted-foreground">· {o.client_phone}</span>
                                  )}
                                </div>
                                <div className="text-xs text-foreground w-24 text-right">
                                  {qty ?? "—"}
                                </div>
                                <div className="text-xs w-32 text-right">
                                  {price
                                    ? <span className="font-semibold text-amber-600 dark:text-amber-400">{price}</span>
                                    : <span className="text-muted-foreground italic">kiritilmagan</span>
                                  }
                                </div>
                                <div className="text-xs text-muted-foreground w-20 text-right">
                                  #{o.order_code ?? o.id}
                                </div>
                              </div>
                            </button>
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

      {/* JAMI — aggregated view */}
      {view === "jami" && (
        <>
          {aggLoading && !aggData ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : periodList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Ma'lumot topilmadi</div>
          ) : (
            <div className="space-y-2">
              {periodList.map((group: any) => (
                <Card key={group.period} className="overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/50 flex items-center justify-between">
                    <span className="font-semibold text-sm">{fmtPeriod(group.period, period)}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span><b className="text-foreground">{fmtNum(group.orderCount)}</b> ta zakaz</span>
                      <span className="hidden sm:inline"><b className="text-foreground">{fmtNum(group.totalQuantity)}</b> dona</span>
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
                          <div className="flex gap-3 text-xs">
                            <span>{fmtNum(r.order_count)} ta</span>
                            <span>{fmtNum(r.total_quantity)} dona</span>
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
        </>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          apiBase={apiBase}
          token={token}
        />
      )}
    </div>
  );
}
