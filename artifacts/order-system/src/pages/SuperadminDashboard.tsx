import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { 
  useGetAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount,
  useGetServiceTypes, useCreateServiceType, useDeleteServiceType,
  useGetClients,
  getGetAccountsQueryKey, getGetServiceTypesQueryKey, getGetClientsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle, Wrench, Bluetooth, Settings, KeyRound, ShieldCheck, X, UserPlus, Pencil, Users, Save, Send, RefreshCw, Bot, CreditCard, Wallet, TrendingDown, TrendingUp, ArrowDownLeft, ArrowUpRight, Phone, User, ChevronDown, ChevronUp, Timer, FileText } from "lucide-react";
import TemplatesView from "@/components/TemplatesView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { Switch } from "@/components/ui/switch";
import AdminDashboard from "./AdminDashboard";
import ProductsView from "@/components/ProductsView";
import BluetoothPrinterPanel from "@/components/BluetoothPrinterPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

function AccountsView({ storeId }: { storeId: number }) {
  const { data, isLoading } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });
  const { data: serviceTypes } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<any>("worker");
  const [pin, setPin] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState<string>("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<any>("worker");
  const [editPin, setEditPin] = useState("");
  const [editServiceTypeId, setEditServiceTypeId] = useState<string>("");

  const storeAccounts = data?.filter(a => a.storeId === storeId);
  const storeServices = serviceTypes?.filter(s => s.storeId === storeId || s.storeId === null) ?? [];

  const resetForm = () => {
    setName(""); setRole("worker"); setPin(""); setServiceTypeId("");
  };

  const openEdit = (acc: any) => {
    setEditingAcc(acc);
    setEditName(acc.name ?? "");
    setEditRole(acc.role ?? "worker");
    setEditPin((acc as any).pin ?? "");
    setEditServiceTypeId((acc as any).serviceTypeId?.toString() ?? "");
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editName) { toast({ title: "Ism kiritilmadi", variant: "destructive" }); return; }
    updateAccount.mutate({
      id: editingAcc.id,
      data: {
        name: editName,
        role: editRole,
        pin: editPin || null,
        serviceTypeId: editRole === "worker" && editServiceTypeId ? Number(editServiceTypeId) : null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Saqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        setEditOpen(false);
      },
      onError: (err) => toast({ title: "Xatolik", description: (err as any).data?.error, variant: "destructive" })
    });
  };

  const handleCreate = () => {
    if (!name) { toast({ title: "Ism kiritilmadi", variant: "destructive" }); return; }
    createAccount.mutate({ 
      data: { 
        name, 
        role, 
        pin: pin || null, 
        storeId,
        serviceTypeId: role === "worker" && serviceTypeId ? Number(serviceTypeId) : null,
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Muvaffaqiyatli saqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        setOpen(false);
        resetForm();
      },
      onError: (err) => toast({ title: "Xatolik", description: (err as any).data?.error, variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      deleteAccount.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "O'chirildi" });
          queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        }
      });
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin", viewer: "Viewer", worker: "Ishchi", superadmin: "Superadmin"
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Do'kon ishchilari</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> Yangi ishchi</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Yangi ishchi qo'shish</DialogTitle>
              <DialogDescription>Do'kon uchun yangi xodim yarating</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Ism</Label>
                <Input placeholder="Xodim ismi" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={role} onValueChange={(v) => { setRole(v); if (v !== 'worker') setServiceTypeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer (faqat ko'rish)</SelectItem>
                    <SelectItem value="worker">Ishchi (Worker)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === "worker" && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-primary" />
                    Qaysi xizmat bo'yicha ishlaydi?
                  </Label>
                  <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Xizmat turini tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {storeServices.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                      {!storeServices.length && <div className="p-2 text-sm text-muted-foreground">Xizmat turlari yo'q</div>}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Ishchi faqat shu xizmat uchun tushgan zakazlarni ko'radi</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>PIN kod (6 raqam)</Label>
                <Input type="tel" placeholder="Masalan: 123456" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createAccount.isPending} className="w-full">
                {createAccount.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-center"><KeyRound className="w-4 h-4 inline text-muted-foreground" /></TableHead>
              <TableHead>Xizmat</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </TableCell></TableRow>
            ) : storeAccounts?.map(acc => {
              const svc = serviceTypes?.find(s => s.id === (acc as any).serviceTypeId);
              return (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{acc.name}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{roleLabels[acc.role] ?? acc.role}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {(acc as any).pin ? (
                      <span className="font-mono text-sm font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md border border-orange-200">{(acc as any).pin}</span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {svc ? <span className="text-primary font-medium">{svc.name}</span> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ishchini tahrirlash</DialogTitle>
            <DialogDescription>Ma'lumotlarni o'zgartiring</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Ism</Label>
              <Input placeholder="Xodim ismi" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={(v) => { setEditRole(v); if (v !== 'worker') setEditServiceTypeId(""); }}>
                <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer (faqat ko'rish)</SelectItem>
                  <SelectItem value="worker">Ishchi (Worker)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRole === "worker" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-primary" />
                  Xizmat turi
                </Label>
                <Select value={editServiceTypeId} onValueChange={setEditServiceTypeId}>
                  <SelectTrigger><SelectValue placeholder="Xizmat turini tanlang..." /></SelectTrigger>
                  <SelectContent>
                    {storeServices.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                    {!storeServices.length && <div className="p-2 text-sm text-muted-foreground">Xizmat turlari yo'q</div>}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>PIN kod (6 raqam)</Label>
              <Input type="tel" placeholder="Masalan: 123456" value={editPin} onChange={e => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} disabled={updateAccount.isPending} className="w-full">
              {updateAccount.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceTypesView({ storeId }: { storeId: number }) {
  const { token } = useAuth();
  const { data, isLoading } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });
  const createService = useCreateServiceType();
  const deleteService = useDeleteServiceType();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nasiyaPending, setNasiyaPending] = useState<number | null>(null);

  const storeServices = data;

  const handleCreate = () => {
    createService.mutate({ data: { name, storeId } }, {
      onSuccess: () => {
        toast({ title: "Muvaffaqiyatli saqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetServiceTypesQueryKey() });
        setOpen(false);
        setName("");
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      deleteService.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "O'chirildi" });
          queryClient.invalidateQueries({ queryKey: getGetServiceTypesQueryKey() });
        }
      });
    }
  };

  const handleNasiyaToggle = async (id: number, current: boolean) => {
    setNasiyaPending(id);
    try {
      const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const r = await fetch(`${apiBase}/api/service-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nasiyaEnabled: !current }),
      });
      if (!r.ok) throw new Error("Server xatosi");
      const updated = await r.json();
      // Cache'ni manual yangilash — sahifani qayta yuklamasdan
      queryClient.setQueryData(getGetServiceTypesQueryKey(), (old: any[]) =>
        old ? old.map(s => s.id === id ? { ...s, nasiyaEnabled: !current, ...updated } : s) : old
      );
      toast({ title: !current ? "Nasiya yoqildi ✅" : "Nasiya o'chirildi" });
    } catch {
      toast({ title: "Xatolik yuz berdi", variant: "destructive" });
    } finally {
      setNasiyaPending(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Xizmat turlari</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> Yangi xizmat</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Yangi xizmat turi</DialogTitle></DialogHeader>
            <div className="py-2">
              <Input placeholder="Xizmat nomi" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createService.isPending} className="w-full">Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead className="text-center w-28">Nasiya</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </TableCell></TableRow>
            ) : storeServices?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={!!s.nasiyaEnabled}
                    onCheckedChange={() => handleNasiyaToggle(s.id, !!s.nasiyaEnabled)}
                    disabled={nasiyaPending === s.id}
                    title="Nasiya rejimi"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {s.storeId === null && (
                      <span className="text-xs text-muted-foreground">Umumiy</span>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ClientAccountsView({ storeId, token }: { storeId: number; token: string }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [txCache, setTxCache] = useState<Record<number, any[]>>({});
  const [txLoading, setTxLoading] = useState<number | null>(null);

  // Payment modal state
  const [payModalClient, setPayModalClient] = useState<any>(null);
  const [payType, setPayType] = useState<"tolov" | "tuzatish">("tolov");
  const [paySign, setPaySign] = useState<"plus" | "minus">("plus");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const fmtPayAmount = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const parsePayAmount = (v: string) => parseFloat(v.replace(/\s/g, "") || "0");

  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

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
      const r = await fetch(`${apiBase}/api/client-accounts/${clientId}/transactions?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setTxCache(prev => ({ ...prev, [clientId]: Array.isArray(data) ? data : [] }));
      setExpanded(clientId);
    } catch { toast({ title: "Tarix yuklanmadi", variant: "destructive" }); } finally { setTxLoading(null); }
  };

  const handlePay = async () => {
    if (!payModalClient || !payAmount || parsePayAmount(payAmount) <= 0) {
      toast({ title: "Summa kiriting", variant: "destructive" }); return;
    }
    setPayLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/client-accounts/${payModalClient.id}/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: payType, sign: paySign, amount: parsePayAmount(payAmount), storeId, note: payNote || undefined }),
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
    qarz:     { label: "Qarz",    icon: <TrendingDown className="w-4 h-4 text-red-500" /> },
    tolov:    { label: "To'lov",  icon: <TrendingUp   className="w-4 h-4 text-green-600" /> },
    tuzatish: { label: "Tuzatish",icon: <Settings     className="w-4 h-4 text-amber-500" /> },
    naqd:     { label: "Naqd",    icon: <Wallet       className="w-4 h-4 text-blue-500" /> },
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
            const isExpanded = expanded === c.id;
            const txs: any[] = txCache[c.id] ?? [];
            return (
              <Card key={c.id} className="overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.firstName} {c.lastName}</div>
                    {c.phone && <div className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>}
                  </div>
                  <div className={`font-bold text-sm tabular-nums whitespace-nowrap ${cls}`}>{text}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setPayModalClient(c); setPayType("tolov"); setPaySign("plus"); setPayAmount(""); setPayNote(""); }}>
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />To'lov
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => loadTx(c.id)} disabled={txLoading === c.id}>
                      {txLoading === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/50 px-4 pb-3 pt-2">
                    {txs.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2 text-center">Tranzaksiyalar yo'q</div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {txs.map((tx: any) => {
                          const txInfo = TX_LABELS[tx.type] ?? { label: tx.type, icon: null };
                          return (
                            <div key={tx.id} className="flex items-center gap-3 text-sm py-1 border-b border-border/30 last:border-0">
                              <div className="shrink-0">{txInfo.icon}</div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{txInfo.label}</span>
                                {tx.orderCode && <span className="text-muted-foreground ml-1 text-xs">#{tx.orderCode}</span>}
                                {tx.note && <div className="text-xs text-muted-foreground truncate">{tx.note}</div>}
                              </div>
                              <div className="shrink-0 text-right">
                                <div className={`font-semibold tabular-nums ${parseFloat(tx.balanceAfter) < parseFloat(tx.balanceBefore) ? "text-red-500" : parseFloat(tx.balanceAfter) > parseFloat(tx.balanceBefore) ? "text-green-600" : "text-muted-foreground"}`}>
                                  {parseFloat(tx.amount).toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} so'm
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(tx.createdAt).toLocaleDateString("uz-UZ")}
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
              <ArrowUpRight className="w-5 h-5 text-green-600" />To'lov / Tuzatish
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
            {/* To'lov turi */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setPayType("tolov"); setPaySign("plus"); }}
                className={`h-12 rounded-xl font-semibold text-sm border-2 transition-all ${payType === "tolov" ? "bg-green-500 text-white border-green-500" : "border-border bg-card text-muted-foreground hover:border-green-400"}`}>
                <ArrowUpRight className="w-4 h-4 inline mr-1" />To'lov
              </button>
              <button onClick={() => setPayType("tuzatish")}
                className={`h-12 rounded-xl font-semibold text-sm border-2 transition-all ${payType === "tuzatish" ? "bg-amber-500 text-white border-amber-500" : "border-border bg-card text-muted-foreground hover:border-amber-400"}`}>
                <Settings className="w-4 h-4 inline mr-1" />Tuzatish
              </button>
            </div>
            {/* Ishorali tuzatish uchun sign */}
            {payType === "tuzatish" && (
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
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(fmtPayAmount(e.target.value))}
                className="text-xl font-bold h-12 text-center tabular-nums"
                autoFocus
              />
            </div>
            {payAmount && payModalClient && parsePayAmount(payAmount) > 0 && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hozir:</span>
                  <span className={fmtBalance(payModalClient.balance ?? 0).cls}>{fmtBalance(payModalClient.balance ?? 0).text}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1">
                  <span className="font-medium">Yangi holat:</span>
                  {(() => {
                    const delta = (payType === "tolov" ? 1 : (paySign === "plus" ? 1 : -1)) * parsePayAmount(payAmount);
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
            <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" disabled={payLoading || !payAmount || parsePayAmount(payAmount) <= 0} onClick={handlePay}>
              {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientsView() {
  const { data, isLoading } = useGetClients({}, { query: { queryKey: getGetClientsQueryKey({}) } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" mijozni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) return;
    try {
      const r = await fetch(`${apiBase}/api/clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      toast({ title: "Mijoz o'chirildi" });
      queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey({}) });
    } catch {
      toast({ title: "Xatolik yuz berdi", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">Mijozlar</h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </TableCell></TableRow>
            ) : !data?.length ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                Hozircha mijozlar yo'q
              </TableCell></TableRow>
            ) : data.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                <TableCell className="text-sm">{c.phone}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10 hover:border-destructive"
                    onClick={() => handleDelete(c.id, `${c.firstName} ${c.lastName}`)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const PERM_ITEMS = [
  { key: "show_pins",         label: "PIN-kodni ko'rish",         desc: "Yangi zakazlardagi PIN-kodni ko'rish huquqi",                 color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "can_analyze",       label: "Statistikani ko'rish",       desc: "Yangi/Qabul/Tayyor/Bugun statistika kartochkalarini ko'rish", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "can_edit_orders",   label: "Zakazni tahrirlash",         desc: "Zakazni o'zgartirish va yangilash huquqi",                   color: "bg-violet-100 text-violet-800 border-violet-200" },
  { key: "can_delete_orders", label: "Zakazni o'chirish",          desc: "Zakazni o'chirish huquqi",                                   color: "bg-red-100 text-red-800 border-red-200" },
  { key: "can_print",         label: "Chop etish",                 desc: "Label chop etish tugmasini ko'rish va ishlatish huquqi",     color: "bg-green-100 text-green-800 border-green-200" },
  { key: "can_mark_delivered",label: "'Topshirildi' belgilash",    desc: "Zakazni 'olib ketildi' deb belgilash huquqi",               color: "bg-purple-100 text-purple-800 border-purple-200" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", worker: "Ishchi", viewer: "Kuzatuvchi", superadmin: "Superadmin", sudo: "SUDO"
};

type PermMode = "none" | "some" | "all";

function PermissionsView({ token, storeId }: { token: string | null; storeId: number }) {
  const { toast } = useToast();
  const [perms, setPerms] = useState<{ accountId: number; permissionKey: string }[]>([]);
  const [modes, setModes] = useState<Record<string, PermMode>>({});
  const [accounts, setAccounts] = useState<{ id: number; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/permissions?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (pRes.ok) {
        const data = await pRes.json();
        setPerms(data.perms ?? []);
        const m: Record<string, PermMode> = {};
        for (const { permissionKey, mode } of (data.modes ?? [])) m[permissionKey] = mode as PermMode;
        setModes(m);
      }
      if (aRes.ok) {
        const all = await aRes.json();
        setAccounts((all as any[]).filter(a => a.storeId === storeId && !["sudo","superadmin"].includes(a.role)));
      }
    } finally {
      setLoading(false);
    }
  }, [token, storeId]);

  useEffect(() => { load(); }, [load]);

  const setMode = async (permissionKey: string, mode: PermMode) => {
    setBusy(`mode-${permissionKey}`);
    try {
      const r = await fetch("/api/permissions/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissionKey, mode, storeId }),
      });
      if (!r.ok) throw new Error();
      setModes(prev => ({ ...prev, [permissionKey]: mode }));
      const modeLabels = { none: "Hech kimga", some: "Ba'zilariga", all: "Xammaga" };
      toast({ title: `✅ Rejim: ${modeLabels[mode]}` });
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const addEntry = async (permissionKey: string, accountId: number) => {
    setBusy(`${permissionKey}-${accountId}`);
    try {
      const r = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountId, permissionKey, storeId }),
      });
      if (!r.ok) throw new Error();
      setPerms(p => [...p, { accountId, permissionKey }]);
      setAddingTo(null);
      const mode = modes[permissionKey] ?? "some";
      toast({ title: mode === "all" ? "✅ Istisno qo'shildi" : "✅ Ruxsat berildi" });
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const removeEntry = async (permissionKey: string, accountId: number) => {
    setBusy(`${permissionKey}-${accountId}`);
    try {
      const r = await fetch(`/api/permissions/${accountId}/${permissionKey}?storeId=${storeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      setPerms(p => p.filter(x => !(x.accountId === accountId && x.permissionKey === permissionKey)));
      const mode = modes[permissionKey] ?? "some";
      toast({ title: mode === "all" ? "Istisno olib tashlandi" : "Ruxsat bekor qilindi" });
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Ruxsatlar boshqaruvi</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Har bir funksiya uchun rejim tanlang: Hech kimga, Ba'zilariga (whitelist), yoki Xammaga (blacklist istisnolar bilan).
      </p>

      <div className="space-y-4">
        {PERM_ITEMS.map(({ key, label, desc, color }) => {
          const mode: PermMode = modes[key] ?? "some";
          const entries = perms.filter(p => p.permissionKey === key);
          const entryIds = new Set(entries.map(p => p.accountId));
          const notInList = accounts.filter(a => !entryIds.has(a.id));
          const isAdding = addingTo === key;
          const isModeBusy = busy === `mode-${key}`;

          const listLabel = mode === "all" ? "Istisnolar (bu foydalanuvchilar bundan mustasno)" : "Ruxsat berilganlar";
          const addLabel  = mode === "all" ? "Istisno qo'shish" : "Foydalanuvchi qo'shish";
          const emptyLabel = mode === "all"
            ? "Istisno yo'q — barcha foydalanuvchilar kirishi mumkin"
            : "Hech kimga ruxsat berilmagan";

          return (
            <Card key={key} className="overflow-hidden">
              <div className={`px-4 py-3 border-b ${color} border-opacity-50`}>
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs opacity-75 mt-0.5">{desc}</div>
              </div>
              <CardContent className="p-4 space-y-3">

                {/* Mode selector */}
                <div className="flex gap-1.5">
                  {(["none", "some", "all"] as PermMode[]).map(m => {
                    const mLabels = { none: "Hech kimga", some: "Ba'zilariga", all: "Xammaga" };
                    const active = mode === m;
                    const mColors = {
                      none: active ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-700 hover:bg-red-50",
                      some: active ? "bg-blue-500 text-white border-blue-500" : "border-blue-200 text-blue-700 hover:bg-blue-50",
                      all:  active ? "bg-green-500 text-white border-green-500" : "border-green-200 text-green-700 hover:bg-green-50",
                    };
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={isModeBusy}
                        onClick={() => { if (!active) setMode(key, m); }}
                        className={`flex-1 text-[11px] font-semibold py-1 rounded-lg border transition-all disabled:opacity-50 ${mColors[m]}`}
                      >
                        {isModeBusy && active ? <Loader2 className="w-3 h-3 animate-spin inline" /> : mLabels[m]}
                      </button>
                    );
                  })}
                </div>

                {/* User list (shown only for "some" and "all") */}
                {mode !== "none" && (
                  <>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{listLabel}</div>
                    <div className="flex flex-wrap gap-2">
                      {entries.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">{emptyLabel}</span>
                      )}
                      {entries.map(({ accountId }) => {
                        const acc = accounts.find(a => a.id === accountId);
                        if (!acc) return null;
                        const isBusy = busy === `${key}-${accountId}`;
                        return (
                          <span key={accountId} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
                            <span>{acc.name}</span>
                            <span className="opacity-60">({ROLE_LABELS[acc.role] ?? acc.role})</span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => removeEntry(key, accountId)}
                              className="ml-0.5 hover:opacity-70 disabled:opacity-40"
                            >
                              {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            </button>
                          </span>
                        );
                      })}
                    </div>

                    {!isAdding && notInList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAddingTo(key)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {addLabel}
                      </button>
                    )}

                    {isAdding && (
                      <div className="flex gap-2 mt-1">
                        <Select onValueChange={(val) => { if (val) addEntry(key, parseInt(val)); }}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Foydalanuvchini tanlang..." />
                          </SelectTrigger>
                          <SelectContent>
                            {notInList.map(acc => (
                              <SelectItem key={acc.id} value={String(acc.id)}>
                                {acc.name} <span className="text-muted-foreground ml-1">({ROLE_LABELS[acc.role] ?? acc.role})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button type="button" onClick={() => setAddingTo(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}

                {mode === "none" && (
                  <p className="text-xs text-muted-foreground italic">Bu funksiya hech kimga ko'rinmaydi (sudo/superadmin bundan mustasno)</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AdminPermissionsView({ token, storeId }: { token: string | null; storeId: number }) {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [localAllowed, setLocalAllowed] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`/api/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/service-types`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (aRes.ok) {
        const all = await aRes.json();
        const filtered = (all as any[]).filter(a => a.storeId === storeId && a.role === "admin");
        setAdmins(filtered);
        const map: Record<number, number[]> = {};
        for (const a of filtered) map[a.id] = a.allowedServiceTypeIds ?? [];
        setLocalAllowed(map);
      }
      if (sRes.ok) {
        const types = await sRes.json();
        setServiceTypes((types as any[]).filter((s: any) => s.storeId === storeId || !s.storeId));
      }
    } finally {
      setLoading(false);
    }
  }, [token, storeId]);

  useEffect(() => { load(); }, [load]);

  const toggleServiceType = (adminId: number, stId: number) => {
    setLocalAllowed(prev => {
      const cur = prev[adminId] ?? [];
      const next = cur.includes(stId) ? cur.filter(x => x !== stId) : [...cur, stId];
      return { ...prev, [adminId]: next };
    });
  };

  const saveAdmin = async (adminId: number) => {
    if (!token) return;
    setSaving(adminId);
    try {
      const r = await fetch(`/api/accounts/${adminId}/service-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serviceTypeIds: localAllowed[adminId] ?? [] }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "✅ Saqlandi" });
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Adminlar ruxsatlari</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Har bir admin faqat ruxsat berilgan xizmat turlarini ko'radi va ularga zakaz bera oladi. Agar hech narsa tanlanmagan bo'lsa — admin hamma xizmatlarni ko'radi.</p>

      {admins.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Adminlar mavjud emas</p>
        </div>
      )}

      {admins.map(admin => {
        const allowed = localAllowed[admin.id] ?? [];
        const allSelected = allowed.length === 0;
        return (
          <Card key={admin.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">{admin.name}</p>
                  <p className="text-xs text-muted-foreground">PIN: {admin.pin || "—"}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => saveAdmin(admin.id)}
                  disabled={saving === admin.id}
                  className="gap-1"
                >
                  {saving === admin.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Saqlash
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ruxsat berilgan xizmatlar:</p>
                {allSelected && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">Hozircha hamma xizmatlar ko'rinadi</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {serviceTypes.map(st => {
                    const isAllowed = allowed.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        onClick={() => toggleServiceType(admin.id, st.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          isAllowed
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {isAllowed ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1 opacity-50" />}
                        {st.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TelegramView({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testChatId, setTestChatId] = useState("");
  const [testToken, setTestToken] = useState("");
  const [testMsg, setTestMsg] = useState("✅ Test xabari muvaffaqiyatli!");
  const [testLoading, setTestLoading] = useState(false);

  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/telegram/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setStatus(data);
    } catch (e: any) {
      toast({ title: "Xato", description: e?.message ?? "Status yuklashda xato", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const sendTest = async () => {
    if (!testChatId) { toast({ title: "Chat ID kiritilmagan", variant: "destructive" }); return; }
    setTestLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/telegram/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId: testChatId, token: testToken || undefined, message: testMsg }),
      });
      const data = await r.json();
      if (data.success) {
        toast({ title: "✅ Yuborildi!", description: `Chat ID ${testChatId} ga xabar ketdi` });
      } else {
        toast({ title: "❌ Xato", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Server xatosi", variant: "destructive" });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Telegram botlar holati</h2>
        </div>
        <Button size="sm" variant="outline" onClick={loadStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Yangilash
        </Button>
      </div>

      {loading && !status && (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      )}

      {status && (
        <div className="space-y-4">
          {/* Global bot */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Bot className="w-4 h-4" />
                Global bot (TELEGRAM_BOT_TOKEN)
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Token bor:</div>
                <div>{status.globalBot.hasToken ? <span className="text-green-600 font-medium">✅ Ha</span> : <span className="text-red-500">❌ Yo'q</span>}</div>
                <div className="text-muted-foreground">Token to'g'ri:</div>
                <div>{status.globalBot.tokenValid ? <span className="text-green-600 font-medium">✅ Ha</span> : <span className="text-red-500">❌ Xato/Yo'q</span>}</div>
                <div className="text-muted-foreground">Polling:</div>
                <div>{status.globalBot.isPolling ? <span className="text-green-600 font-medium">✅ Ishlayapti</span> : <span className="text-yellow-600">⏸ To'xtatilgan</span>}</div>
                {status.globalBot.botUsername && (
                  <>
                    <div className="text-muted-foreground">Bot username:</div>
                    <div className="font-mono text-xs">@{status.globalBot.botUsername}</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Store bots */}
          {status.stores?.map((s: any) => (
            <Card key={s.storeId}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Bot className="w-4 h-4" />
                  {s.storeName} (Do'kon #{s.storeId})
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Bot token:</div>
                  <div>{s.hasToken ? <span className="text-green-600 font-medium">✅ Bor</span> : <span className="text-red-500">❌ Yo'q</span>}</div>
                  <div className="text-muted-foreground">Chat ID:</div>
                  <div>{s.hasChatId ? <span className="text-green-600 font-medium">✅ {s.chatId}</span> : <span className="text-red-500">❌ Yo'q</span>}</div>
                  <div className="text-muted-foreground">Token to'g'ri:</div>
                  <div>{s.hasToken ? (s.tokenValid ? <span className="text-green-600 font-medium">✅ Ha</span> : <span className="text-red-500">❌ Xato/Yaroqsiz</span>) : <span className="text-muted-foreground">—</span>}</div>
                  <div className="text-muted-foreground">Polling:</div>
                  <div>{s.isPolling ? <span className="text-green-600 font-medium">✅ Ishlayapti</span> : <span className="text-yellow-600">⏸ To'xtatilgan</span>}</div>
                  {s.botUsername && (
                    <>
                      <div className="text-muted-foreground">Bot username:</div>
                      <div className="font-mono text-xs">@{s.botUsername}</div>
                    </>
                  )}
                </div>
                {s.hasToken && !s.tokenValid && (
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded p-2 mt-1">
                    ⚠️ Token yaroqsiz — Sudo panelidagi do'kon sozlamalarida yangi token kiriting
                  </div>
                )}
                {!s.hasChatId && (
                  <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded p-2 mt-1">
                    ⚠️ Chat ID yo'q — Zakaz xabarlari yuborilmaydi. Sudo panelidagi do'kon sozlamalarida Chat ID kiriting
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Test xabar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Send className="w-4 h-4" />
            Test xabar yuborish
          </div>
          <p className="text-xs text-muted-foreground">Chat ID va token kiriting, test xabar yuboring</p>
          <div className="space-y-2">
            <Label className="text-xs">Chat ID <span className="text-red-500">*</span></Label>
            <Input placeholder="123456789 yoki -1001234567890" value={testChatId} onChange={e => setTestChatId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Bot Token (bo'sh qolsa global token ishlatiladi)</Label>
            <Input placeholder="1234567890:AAF..." value={testToken} onChange={e => setTestToken(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Xabar matni</Label>
            <Input value={testMsg} onChange={e => setTestMsg(e.target.value)} />
          </div>
          <Button onClick={sendTest} disabled={testLoading} className="w-full">
            {testLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Xabar yuborish
          </Button>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded p-3">
        <p className="font-medium">Qanday sozlash kerak (VPS uchun):</p>
        <p>1. Telegram'da @BotFather dan yangi bot token oling</p>
        <p>2. @userinfobot ga yozing — Chat ID ni bilib oling</p>
        <p>3. Sudo panelidagi do'kon sozlamalarida token va Chat ID saqlang</p>
        <p>4. VPS'da: <code className="bg-muted px-1 rounded">pm2 restart zakaz-api</code> buyrug'ini bajaring</p>
      </div>
    </div>
  );
}

function TimerSettingsPanel({ token, storeId }: { token: string | null; storeId: number }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const { toast } = useToast();
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setAccounts((data as any[]).filter((a: any) => a.storeId === storeId && (a.role === "worker" || a.role === "admin")));
    } catch { toast({ variant: "destructive", title: "Xatolik", description: "Yuklanmadi" }); }
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, [storeId]);

  const toggleTimer = async (id: number, current: boolean) => {
    setToggling(id);
    try {
      const r = await fetch(`${apiBase}/api/accounts/${id}/no-timer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ noTimer: !current }),
      });
      const data = await r.json();
      if (data.success) {
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, noTimer: data.noTimer } : a));
        toast({ title: data.noTimer ? "Timer o'chirildi ✅" : "Timer yoqildi 🔄", description: `Akkount yangilandi` });
      }
    } catch { toast({ variant: "destructive", title: "Xatolik" }); }
    setToggling(null);
  };

  const roleLabel: Record<string, string> = { worker: "Ishchi", admin: "Admin" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Timer className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Timer sozlamalari</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Ishchilar odatda <b>15 soniya</b> faolsizlikda avtomatik chiqib ketadi. Quyidagi ro'yxatda timer'ni o'chirib qo'yishingiz mumkin — u holda ishchi hisobdan chiqmaydi.
      </p>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : accounts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Ishchi/admin topilmadi</p>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <Card key={acc.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${acc.role === "worker" ? "bg-accent" : "bg-primary"}`}>
                    {acc.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{acc.name}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel[acc.role] ?? acc.role} • PIN: {acc.pin ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${acc.noTimer ? "text-green-600" : "text-muted-foreground"}`}>
                      {acc.noTimer ? "∞ Timer o'chiq" : "⏱ 15 soniya"}
                    </div>
                  </div>
                  {toggling === acc.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch checked={!!acc.noTimer} onCheckedChange={() => toggleTimer(acc.id, !!acc.noTimer)} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperadminDashboard() {
  const { accountName, storeId, token } = useAuth();
  const { data: allServiceTypes } = useGetServiceTypes({ query: { enabled: !!storeId } });

  if (!storeId) return null;

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <Header title={`Superadmin: ${accountName}`} showLogout={true} />
      
      <Tabs defaultValue="orders" className="w-full">
        <div className="bg-background border-b sticky top-[56px] z-20 px-2 py-2.5 overflow-x-auto scrollbar-none">
          <TabsList className="flex w-max min-w-full h-10 gap-0.5">
            <TabsTrigger value="orders"   className="text-xs sm:text-sm px-3 shrink-0">Zakazlar</TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs sm:text-sm px-3 shrink-0">Ishchilar</TabsTrigger>
            <TabsTrigger value="timer" className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <Timer className="w-3 h-3 hidden sm:block" />Timer
            </TabsTrigger>
            <TabsTrigger value="admins"   className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <Users className="w-3 h-3 hidden sm:block" />Adminlar
            </TabsTrigger>
            <TabsTrigger value="services" className="text-xs sm:text-sm px-3 shrink-0">Xizmatlar</TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm px-3 shrink-0">Mahsulot</TabsTrigger>
            <TabsTrigger value="clients"  className="text-xs sm:text-sm px-3 shrink-0">Mijozlar</TabsTrigger>
            <TabsTrigger value="hisoblar" className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <CreditCard className="w-3 h-3 hidden sm:block" />Hisoblar
            </TabsTrigger>
            <TabsTrigger value="printer"  className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <Bluetooth className="w-3 h-3 hidden sm:block" />Printer
            </TabsTrigger>
            <TabsTrigger value="telegram" className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <Bot className="w-3 h-3 hidden sm:block" />Telegram
            </TabsTrigger>
            <TabsTrigger value="shablon" className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <FileText className="w-3 h-3 hidden sm:block" />Shablon
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />Hisobot
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />Ruxsatlar
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="orders" className="mt-0 focus-visible:outline-none">
          <AdminDashboard hideHeader={true} stickyTop={113} />
        </TabsContent>
        
        <TabsContent value="accounts" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <AccountsView storeId={storeId} />
        </TabsContent>

        <TabsContent value="timer" className="p-5 max-w-2xl mx-auto focus-visible:outline-none">
          <TimerSettingsPanel token={token} storeId={storeId} />
        </TabsContent>

        <TabsContent value="admins" className="p-5 focus-visible:outline-none">
          <AdminPermissionsView token={token} storeId={storeId} />
        </TabsContent>
        
        <TabsContent value="services" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ServiceTypesView storeId={storeId} />
        </TabsContent>

        <TabsContent value="products" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ProductsView storeId={storeId} />
        </TabsContent>

        <TabsContent value="clients" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ClientsView />
        </TabsContent>

        <TabsContent value="hisoblar" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ClientAccountsView storeId={storeId} token={token ?? ""} />
        </TabsContent>

        <TabsContent value="printer" className="p-5 focus-visible:outline-none">
          <BluetoothPrinterPanel />
        </TabsContent>

        <TabsContent value="telegram" className="p-5 focus-visible:outline-none">
          <TelegramView token={token} />
        </TabsContent>

        <TabsContent value="shablon" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <TemplatesView storeId={storeId} token={token} />
        </TabsContent>

        <TabsContent value="analytics" className="p-5 focus-visible:outline-none">
          <AnalyticsView
            storeId={storeId}
            token={token ?? ""}
            serviceTypes={Array.isArray(allServiceTypes) ? allServiceTypes as any[] : []}
          />
        </TabsContent>

        <TabsContent value="settings" className="p-5 focus-visible:outline-none">
          <PermissionsView token={token} storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
