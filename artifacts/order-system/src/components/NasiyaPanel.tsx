import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ChevronDown, ChevronUp, RefreshCw, Phone, CreditCard, TrendingDown, TrendingUp, Wallet, ArrowDownLeft, BadgeCheck, Filter } from "lucide-react";

const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString("uz-UZ") + " so'm";

type TxType = "naqd" | "qarz" | "tolov" | "tuzatish" | "click" | "dokonga";

const TX_META: Record<TxType, { label: string; icon: string; color: string }> = {
  naqd:     { label: "Naqd",    icon: "💵", color: "text-green-600 bg-green-50 dark:bg-green-950/30" },
  click:    { label: "Click",   icon: "📲", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  dokonga:  { label: "Dokonga", icon: "🏪", color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  qarz:     { label: "Nasiya",  icon: "📋", color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
  tolov:    { label: "To'lov",  icon: "💰", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
  tuzatish: { label: "Tuzatish",icon: "✏️", color: "text-gray-600 bg-gray-50 dark:bg-gray-950/30" },
};

const STORE_PAY_TYPES: TxType[] = ["naqd", "click", "dokonga"];

function fmtDate(d: string | Date) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

interface NasiyaPanelProps {
  storeId: number;
  token: string;
}

export default function NasiyaPanel({ storeId, token }: NasiyaPanelProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [allTx, setAllTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [clientTx, setClientTx] = useState<Record<number, any[]>>({});
  const [clientTxLoading, setClientTxLoading] = useState<number | null>(null);

  // Filters
  const [filterServiceType, setFilterServiceType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showOnlyDebt, setShowOnlyDebt] = useState(false);

  // Payment modal
  const [payClient, setPayClient] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState<TxType>("tolov");
  const [payNote, setPayNote] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payServiceTypeId, setPayServiceTypeId] = useState<string>("");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, stRes, txRes] = await Promise.all([
        fetch(`${apiBase}/api/client-accounts?storeId=${storeId}`, { headers }),
        fetch(`${apiBase}/api/service-types`, { headers }),
        fetch(`${apiBase}/api/client-accounts/all/transactions?limit=500`, { headers }),
      ]);
      if (cRes.ok) setClients(await cRes.json());
      if (stRes.ok) {
        const all = await stRes.json();
        setServiceTypes((all as any[]).filter((s: any) => s.nasiyaEnabled));
      }
      if (txRes.ok) setAllTx(await txRes.json());
    } catch {}
    setLoading(false);
  }, [storeId, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadClientTx = async (clientId: number) => {
    if (clientTx[clientId]) return;
    setClientTxLoading(clientId);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${clientId}/transactions?limit=200`, { headers });
      if (r.ok) {
        const data = await r.json();
        setClientTx(prev => ({ ...prev, [clientId]: data }));
      }
    } catch {}
    setClientTxLoading(null);
  };

  const toggleExpand = async (clientId: number) => {
    if (expandedClient === clientId) { setExpandedClient(null); return; }
    setExpandedClient(clientId);
    await loadClientTx(clientId);
  };

  const fmtAmt = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const doPayment = async () => {
    if (!payClient) return;
    const amount = parseFloat(payAmount.replace(/\s/g, "") || "0");
    if (amount <= 0) { toast({ title: "Summa kiriting", variant: "destructive" }); return; }
    setPayLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${payClient.id}/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: payType,
          amount,
          note: payNote || undefined,
          storeId,
          serviceTypeId: payServiceTypeId ? Number(payServiceTypeId) : undefined,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast({ title: `✅ ${TX_META[payType].label} yozildi` });
      setPayClient(null);
      setPayAmount("");
      setPayNote("");
      // Refresh
      await fetchAll();
      setClientTx(prev => { const n = { ...prev }; delete n[payClient.id]; return n; });
    } catch (e: any) {
      toast({ title: e.message ?? "Xatolik", variant: "destructive" });
    } finally {
      setPayLoading(false);
    }
  };

  // Service type stats (from allTx)
  const stStats = serviceTypes.map(st => {
    const txs = allTx.filter((t: any) => t.service_type_id === st.id);
    const qarz = txs.filter((t: any) => t.type === "qarz").reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount)), 0);
    const tolov = txs.filter((t: any) => t.type === "tolov").reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount)), 0);
    const naqd = txs.filter((t: any) => STORE_PAY_TYPES.includes(t.type as TxType)).reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount)), 0);
    const uniqueClients = new Set(txs.map((t: any) => t.client_id)).size;
    return { ...st, qarz, tolov, naqd, uniqueClients };
  });

  const filteredClients = clients.filter(c => {
    if (showOnlyDebt && c.balance >= 0) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(`${c.firstName} ${c.lastName}`.toLowerCase().includes(s) || (c.phone ?? "").includes(s))) return false;
    }
    return true;
  });

  // Per-client breakdown from allTx
  const clientBreakdown = (clientId: number) => {
    const txs = allTx.filter((t: any) => t.client_id === clientId);
    const breakdown: Record<TxType, number> = { naqd: 0, qarz: 0, tolov: 0, tuzatish: 0, click: 0, dokonga: 0 };
    for (const t of txs) {
      const k = t.type as TxType;
      if (breakdown[k] !== undefined) breakdown[k] += Math.abs(parseFloat(t.amount ?? "0"));
    }
    const dokonBerishi = breakdown.naqd + breakdown.click + breakdown.dokonga;
    return { ...breakdown, dokonBerishi };
  };

  const totalDebt = clients.reduce((s, c) => s + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
  const totalHaq = clients.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
  const totalDokonBerishi = allTx
    .filter((t: any) => STORE_PAY_TYPES.includes(t.type as TxType))
    .reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount ?? "0")), 0);

  if (loading) return (
    <div className="flex justify-center items-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Top summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-200 dark:border-red-800 text-center">
          <div className="text-lg font-bold text-red-600">{fmt(totalDebt)}</div>
          <div className="text-xs text-red-500 mt-0.5">Jami qarz</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3 border border-orange-200 dark:border-orange-800 text-center">
          <div className="text-lg font-bold text-orange-600">{fmt(totalDokonBerishi)}</div>
          <div className="text-xs text-orange-500 mt-0.5">Dokonga berishi</div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 border border-green-200 dark:border-green-800 text-center">
          <div className="text-lg font-bold text-green-600">{fmt(totalHaq)}</div>
          <div className="text-xs text-green-500 mt-0.5">Ortiqcha to'lov</div>
        </div>
      </div>

      {/* Nasiya xizmat turlari */}
      {stStats.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Nasiya xizmat turlari</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stStats.map(st => (
              <Card key={st.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{st.name}</span>
                    <span className="text-xs text-muted-foreground">{st.uniqueClients} mijoz</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-center bg-red-50 dark:bg-red-950/30 rounded p-1">
                      <div className="font-bold text-red-600">{fmt(st.qarz)}</div>
                      <div className="text-red-400">Nasiya</div>
                    </div>
                    <div className="text-center bg-purple-50 dark:bg-purple-950/30 rounded p-1">
                      <div className="font-bold text-purple-600">{fmt(st.tolov)}</div>
                      <div className="text-purple-400">To'lov</div>
                    </div>
                    <div className="text-center bg-orange-50 dark:bg-orange-950/30 rounded p-1">
                      <div className="font-bold text-orange-600">{fmt(st.naqd)}</div>
                      <div className="text-orange-400">Dokonga</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Mijoz qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <button
          onClick={() => setShowOnlyDebt(!showOnlyDebt)}
          className={`h-9 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${showOnlyDebt ? "bg-red-500 text-white border-red-500" : "bg-card border-border text-muted-foreground"}`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Faqat qarzdorlar
        </button>
        <Button variant="ghost" size="sm" onClick={fetchAll} className="h-9 px-2.5">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {filteredClients.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">Mijoz topilmadi</div>
        )}
        {filteredClients.map(client => {
          const isExp = expandedClient === client.id;
          const bd = clientBreakdown(client.id);
          return (
            <div key={client.id} className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <button
                className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(client.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{[client.firstName, client.lastName].filter(Boolean).join(" ") || "Noma'lum"}</span>
                    {client.phone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{client.phone}
                      </span>
                    )}
                  </div>
                  {/* Balance summary */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {client.balance < 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 font-semibold">
                        −{fmt(client.balance)} qarz
                      </span>
                    )}
                    {client.balance > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 font-semibold">
                        +{fmt(client.balance)} haq
                      </span>
                    )}
                    {client.balance === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Balansi 0</span>
                    )}
                    {bd.dokonBerishi > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 font-medium">
                        🏪 {fmt(bd.dokonBerishi)} dokonga
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={e => { e.stopPropagation(); setPayClient(client); setPayAmount(""); setPayNote(""); setPayType("tolov"); setPayServiceTypeId(""); }}
                  >
                    <Wallet className="w-3 h-3 mr-1" />To'lov
                  </Button>
                  {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExp && (
                <div className="border-t">
                  {/* Breakdown summary */}
                  <div className="p-3 bg-muted/20 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {bd.qarz > 0 && (
                      <div className="flex justify-between bg-red-50 dark:bg-red-950/30 rounded-lg px-2 py-1.5">
                        <span className="text-red-500">📋 Nasiya yozilgan</span>
                        <span className="font-bold text-red-600">{fmt(bd.qarz)}</span>
                      </div>
                    )}
                    {bd.tolov > 0 && (
                      <div className="flex justify-between bg-purple-50 dark:bg-purple-950/30 rounded-lg px-2 py-1.5">
                        <span className="text-purple-500">💰 Qarz to'langan</span>
                        <span className="font-bold text-purple-600">{fmt(bd.tolov)}</span>
                      </div>
                    )}
                    {bd.naqd > 0 && (
                      <div className="flex justify-between bg-green-50 dark:bg-green-950/30 rounded-lg px-2 py-1.5">
                        <span className="text-green-500">💵 Naqd</span>
                        <span className="font-bold text-green-600">{fmt(bd.naqd)}</span>
                      </div>
                    )}
                    {bd.click > 0 && (
                      <div className="flex justify-between bg-blue-50 dark:bg-blue-950/30 rounded-lg px-2 py-1.5">
                        <span className="text-blue-500">📲 Click</span>
                        <span className="font-bold text-blue-600">{fmt(bd.click)}</span>
                      </div>
                    )}
                    {bd.dokonga > 0 && (
                      <div className="flex justify-between bg-orange-50 dark:bg-orange-950/30 rounded-lg px-2 py-1.5">
                        <span className="text-orange-500">🏪 Dokonga</span>
                        <span className="font-bold text-orange-600">{fmt(bd.dokonga)}</span>
                      </div>
                    )}
                    {bd.dokonBerishi > 0 && (
                      <div className="col-span-full flex justify-between bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1.5 border border-amber-200 dark:border-amber-800">
                        <span className="text-amber-700 font-semibold">🏪 Dokonga berishi kerak (jami)</span>
                        <span className="font-bold text-amber-700">{fmt(bd.dokonBerishi)}</span>
                      </div>
                    )}
                  </div>

                  {/* Transaction list */}
                  {clientTxLoading === client.id ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : (
                    <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                      {(clientTx[client.id] ?? []).length === 0 && (
                        <div className="text-center py-4 text-xs text-muted-foreground">Tranzaksiya yo'q</div>
                      )}
                      {(clientTx[client.id] ?? []).map((tx: any) => {
                        const meta = TX_META[tx.type as TxType] ?? TX_META.tuzatish;
                        return (
                          <div key={tx.id} className="flex items-start justify-between px-3 py-2 text-xs">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.color}`}>
                                {meta.icon} {meta.label}
                              </span>
                              <div className="min-w-0">
                                <div className="text-muted-foreground truncate">{tx.service_type_name || tx.note || "—"}</div>
                                {tx.order_code && <div className="text-muted-foreground/70">#{tx.order_code}</div>}
                                <div className="text-muted-foreground/60">{fmtDate(tx.created_at)}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div className={`font-bold ${tx.type === "qarz" ? "text-red-500" : tx.type === "tolov" ? "text-purple-600" : tx.type === "naqd" ? "text-green-600" : tx.type === "click" ? "text-blue-600" : tx.type === "dokonga" ? "text-orange-600" : "text-foreground"}`}>
                                {tx.type === "qarz" ? "−" : "+"}{fmt(parseFloat(tx.amount ?? "0"))}
                              </div>
                              <div className="text-muted-foreground/60 text-[10px]">
                                Balans: {parseFloat(tx.balance_after ?? "0") < 0 ? `−${fmt(parseFloat(tx.balance_after))}` : `+${fmt(parseFloat(tx.balance_after ?? "0"))}`}
                              </div>
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

      {/* Payment Modal */}
      <Dialog open={!!payClient} onOpenChange={v => { if (!v) setPayClient(null); }}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              To'lov yozish
            </DialogTitle>
            <DialogDescription>
              {payClient && [payClient.firstName, payClient.lastName].filter(Boolean).join(" ")}
              {payClient && (
                <span className={`ml-2 font-bold ${payClient.balance < 0 ? "text-red-500" : "text-green-600"}`}>
                  ({payClient.balance < 0 ? `−${fmt(payClient.balance)} qarz` : `+${fmt(payClient.balance)}`})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Type selector */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["tolov", "naqd", "click", "dokonga", "qarz", "tuzatish"] as TxType[]).map(t => {
                const m = TX_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setPayType(t)}
                    className={`py-2 rounded-lg text-xs font-bold border-2 transition-all ${payType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                  >
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Summa (so'm)</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(fmtAmt(e.target.value))}
                className="text-xl font-bold h-12 text-center tabular-nums"
                autoFocus
              />
            </div>
            {serviceTypes.length > 0 && (
              <Select value={payServiceTypeId} onValueChange={setPayServiceTypeId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Xizmat turi (ixtiyoriy)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Tanlang —</SelectItem>
                  {serviceTypes.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder="Izoh (ixtiyoriy)"
              value={payNote}
              onChange={e => setPayNote(e.target.value)}
              className="h-9 text-sm"
            />
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
    </div>
  );
}
