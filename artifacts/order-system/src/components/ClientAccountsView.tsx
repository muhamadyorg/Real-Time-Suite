import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  CreditCard, Phone, ArrowUpRight, ChevronUp, ChevronDown,
  RefreshCw, Loader2, CheckCircle, TrendingDown, TrendingUp,
  Settings, Wallet,
} from "lucide-react";

interface ClientAccountsViewProps {
  storeId: number;
  token: string;
  role?: "superadmin" | "admin" | "worker";
}

export function ClientAccountsView({ storeId, token, role = "admin" }: ClientAccountsViewProps) {
  const { serviceTypeId: authServiceTypeId } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [txCache, setTxCache] = useState<Record<number, any[]>>({});
  const [txLoading, setTxLoading] = useState<number | null>(null);

  const [payModalClient, setPayModalClient] = useState<any>(null);
  const [payType, setPayType] = useState<"tolov" | "tuzatish">("tolov");
  const [paySign, setPaySign] = useState<"plus" | "minus">("plus");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const canPay = role === "superadmin" || role === "admin" || role === "worker";
  const canAdjust = role === "superadmin";

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const r = await fetch(`${apiBase}/api/client-accounts${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch { setAccounts([]); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchAccounts(); }, [storeId]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchAccounts(); };

  const loadTx = async (clientId: number) => {
    if (txCache[clientId]) { setExpanded(expanded === clientId ? null : clientId); return; }
    setTxLoading(clientId);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${clientId}/transactions?limit=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      setTxCache(prev => ({ ...prev, [clientId]: Array.isArray(data) ? data : [] }));
      setExpanded(clientId);
    } catch {
      toast({ title: "Tarix yuklanmadi", variant: "destructive" });
    } finally { setTxLoading(null); }
  };

  const handlePay = async () => {
    if (!payModalClient || !payAmount || parseFloat(payAmount) <= 0) {
      toast({ title: "Summa kiriting", variant: "destructive" }); return;
    }
    setPayLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${payModalClient.id}/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: payType,
          sign: payType === "tolov" ? (paySign === "plus" ? "minus" : "plus") : paySign,
          amount: parseFloat(payAmount),
          storeId,
          serviceTypeId: authServiceTypeId ?? undefined,
          note: payNote || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error ?? "Xatolik", variant: "destructive" }); return; }
      toast({ title: "✅ Tranzaksiya amalga oshirildi" });
      setPayModalClient(null); setPayAmount(""); setPayNote("");
      setTxCache(prev => { const n = { ...prev }; delete n[payModalClient.id]; return n; });
      fetchAccounts();
    } catch { toast({ title: "Tarmoq xatosi", variant: "destructive" }); } finally { setPayLoading(false); }
  };

  const fmtBalance = (bal: number) => {
    const abs = Math.abs(bal).toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (bal < 0) return { text: `−${abs} so'm qarz`, cls: "text-red-500" };
    if (bal > 0) return { text: `+${abs} so'm haq`, cls: "text-green-600" };
    return { text: "0", cls: "text-muted-foreground" };
  };

  const TX_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    qarz:     { label: "Qarz",     icon: <TrendingDown className="w-4 h-4 text-red-500" /> },
    tolov:    { label: "To'lov",   icon: <TrendingUp   className="w-4 h-4 text-green-600" /> },
    tuzatish: { label: "Tuzatish", icon: <Settings     className="w-4 h-4 text-amber-500" /> },
    naqd:     { label: "Naqd",     icon: <Wallet       className="w-4 h-4 text-blue-500" /> },
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Hisoblar (Nasiya)
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="Mijoz qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="w-48 h-9" />
          <Button size="sm" type="submit">Qidirish</Button>
          <Button size="sm" variant="outline" type="button" onClick={() => { setSearch(""); setTimeout(fetchAccounts, 50); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Hech narsa topilmadi</div>
      ) : (
        <div className="space-y-2">
          {accounts.map(c => {
            const { text, cls } = fmtBalance(c.balance ?? 0);
            const isExp = expanded === c.id;
            const txs: any[] = txCache[c.id] ?? [];
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.firstName} {c.lastName}</div>
                    {c.phone && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{c.phone}
                      </div>
                    )}
                  </div>
                  <div className={`font-bold text-sm tabular-nums whitespace-nowrap ${cls}`}>{text}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canPay && (
                      <Button size="sm" variant="outline" className="h-8 text-xs"
                        onClick={() => { setPayModalClient(c); setPayType("tolov"); setPaySign("plus"); setPayAmount(""); setPayNote(""); }}>
                        <ArrowUpRight className="w-3.5 h-3.5 mr-1" />To'lov
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 px-2"
                      onClick={() => loadTx(c.id)} disabled={txLoading === c.id}>
                      {txLoading === c.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-border/50 px-4 pb-3 pt-2">
                    {txs.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2 text-center">Tranzaksiyalar yo'q</div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {txs.map((tx: any) => {
                          const txi = TX_LABELS[tx.type] ?? { label: tx.type, icon: null };
                          const balDiff = parseFloat(tx.balanceAfter) - parseFloat(tx.balanceBefore);
                          return (
                            <div key={tx.id} className="flex items-center gap-3 text-sm py-1 border-b border-border/30 last:border-0">
                              <div className="shrink-0">{txi.icon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{txi.label}</span>
                                  {tx.orderCode && <span className="text-muted-foreground text-xs">#{tx.orderCode}</span>}
                                </div>
                                {tx.note && <div className="text-xs text-muted-foreground truncate">{tx.note}</div>}
                                <div className="text-xs text-muted-foreground">
                                  {tx.performedByName && <span>{tx.performedByName} · </span>}
                                  {new Date(tx.createdAt).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                {parseFloat(tx.amount) > 0 && (
                                  <div className={`font-semibold tabular-nums ${balDiff < 0 ? "text-red-500" : balDiff > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                    {balDiff !== 0 ? (balDiff > 0 ? "+" : "−") : ""}
                                    {parseFloat(tx.amount).toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} so'm
                                  </div>
                                )}
                                <div className={`text-xs font-medium ${parseFloat(tx.balanceAfter) < 0 ? "text-red-400" : "text-green-500"}`}>
                                  Jami: {parseFloat(tx.balanceAfter) >= 0 ? "+" : ""}
                                  {parseFloat(tx.balanceAfter).toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      <Dialog open={!!payModalClient} onOpenChange={(v) => { if (!v) setPayModalClient(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-green-600" />To'lov {canAdjust ? "/ Tuzatish" : ""}
            </DialogTitle>
            <DialogDescription>
              {payModalClient?.firstName} {payModalClient?.lastName}
              {payModalClient && (
                <span className={`ml-2 font-semibold ${(payModalClient.balance ?? 0) < 0 ? "text-red-500" : "text-green-600"}`}>
                  ({fmtBalance(payModalClient.balance ?? 0).text})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid gap-2" style={{ gridTemplateColumns: canAdjust ? "1fr 1fr" : "1fr" }}>
              <button onClick={() => { setPayType("tolov"); setPaySign("plus"); }}
                className={`h-12 rounded-xl font-semibold text-sm border-2 transition-all ${payType === "tolov" ? "bg-green-500 text-white border-green-500" : "border-border bg-card text-muted-foreground hover:border-green-400"}`}>
                <ArrowUpRight className="w-4 h-4 inline mr-1" />To'lov
              </button>
              {canAdjust && (
                <button onClick={() => setPayType("tuzatish")}
                  className={`h-12 rounded-xl font-semibold text-sm border-2 transition-all ${payType === "tuzatish" ? "bg-amber-500 text-white border-amber-500" : "border-border bg-card text-muted-foreground hover:border-amber-400"}`}>
                  <Settings className="w-4 h-4 inline mr-1" />Tuzatish
                </button>
              )}
            </div>
            {(payType === "tuzatish" || payType === "tolov") && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaySign("plus")}
                  className={`h-10 rounded-lg font-bold border-2 ${paySign === "plus" ? "bg-green-500 text-white border-green-500" : "border-border"}`}>
                  + Ko'paytirish
                </button>
                <button onClick={() => setPaySign("minus")}
                  className={`h-10 rounded-lg font-bold border-2 ${paySign === "minus" ? "bg-red-500 text-white border-red-500" : "border-border"}`}>
                  − Kamaytirish
                </button>
              </div>
            )}
            <div className="space-y-1">
              <Label>Summa (so'm)</Label>
              <Input type="number" inputMode="decimal" placeholder="0" min="0" step="0.1"
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="text-xl font-bold h-12 text-center" autoFocus />
            </div>
            {payAmount && payModalClient && !isNaN(parseFloat(payAmount)) && parseFloat(payAmount) > 0 && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hozir:</span>
                  <span className={fmtBalance(payModalClient.balance ?? 0).cls}>{fmtBalance(payModalClient.balance ?? 0).text}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1">
                  <span className="font-medium">Yangi holat:</span>
                  {(() => {
                    const delta = payType === "tolov"
                      ? (paySign === "plus" ? -1 : 1) * parseFloat(payAmount)
                      : (paySign === "plus" ? 1 : -1) * parseFloat(payAmount);
                    const nb = (payModalClient.balance ?? 0) + delta;
                    return <span className={`font-bold tabular-nums ${nb < 0 ? "text-red-500" : "text-green-600"}`}>{fmtBalance(nb).text}</span>;
                  })()}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Izoh (ixtiyoriy)</Label>
              <Input placeholder="Izoh..." value={payNote} onChange={e => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayModalClient(null)} disabled={payLoading}>Bekor</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={payLoading || !payAmount || parseFloat(payAmount) <= 0} onClick={handlePay}>
              {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
