import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { 
  useGetAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount,
  useGetServiceTypes, useCreateServiceType, useDeleteServiceType,
  useGetClients, useApproveClient, useRejectClient,
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
import { Loader2, Plus, Trash2, CheckCircle, XCircle, Wrench, Bluetooth, Settings, KeyRound, ShieldCheck, X, UserPlus, Pencil } from "lucide-react";
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
  const { data, isLoading } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });
  const createService = useCreateServiceType();
  const deleteService = useDeleteServiceType();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const storeServices = data?.filter(s => s.storeId === storeId || s.storeId === null);

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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={2} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </TableCell></TableRow>
            ) : storeServices?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right">
                  {s.storeId !== null ? (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Umumiy</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ClientsView() {
  const [status, setStatus] = useState<any>("pending");
  const { data, isLoading } = useGetClients({ status }, { query: { queryKey: getGetClientsQueryKey({ status }) } });
  const approve = useApproveClient();
  const reject = useRejectClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleApprove = (id: number) => {
    approve.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Mijoz tasdiqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey({ status }) });
      }
    });
  };

  const handleReject = (id: number) => {
    reject.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Mijoz rad etildi" });
        queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey({ status }) });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Mijozlar</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Kutilmoqda</SelectItem>
            <SelectItem value="approved">Tasdiqlangan</SelectItem>
            <SelectItem value="rejected">Rad etilgan</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
            ) : data?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                <TableCell className="text-sm">{c.phone}</TableCell>
                <TableCell className="text-right">
                  {c.status === "pending" && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" className="text-green-600 hover:bg-green-50" onClick={() => handleApprove(c.id)}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleReject(c.id)}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
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

export default function SuperadminDashboard() {
  const { accountName, storeId, token } = useAuth();
  
  if (!storeId) return null;

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <Header title={`Superadmin: ${accountName}`} showLogout={true} />
      
      <Tabs defaultValue="orders" className="w-full">
        <div className="bg-background border-b sticky top-[56px] z-20 px-2 py-2.5 overflow-x-auto scrollbar-none">
          <TabsList className="flex w-max min-w-full h-10 gap-0.5">
            <TabsTrigger value="orders"   className="text-xs sm:text-sm px-3 shrink-0">Zakazlar</TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs sm:text-sm px-3 shrink-0">Ishchilar</TabsTrigger>
            <TabsTrigger value="services" className="text-xs sm:text-sm px-3 shrink-0">Xizmatlar</TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm px-3 shrink-0">Mahsulot</TabsTrigger>
            <TabsTrigger value="clients"  className="text-xs sm:text-sm px-3 shrink-0">Mijozlar</TabsTrigger>
            <TabsTrigger value="printer"  className="text-xs sm:text-sm px-3 shrink-0 flex items-center gap-1">
              <Bluetooth className="w-3 h-3 hidden sm:block" />Printer
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
        
        <TabsContent value="services" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ServiceTypesView storeId={storeId} />
        </TabsContent>

        <TabsContent value="products" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ProductsView storeId={storeId} />
        </TabsContent>

        <TabsContent value="clients" className="p-5 max-w-4xl mx-auto focus-visible:outline-none">
          <ClientsView />
        </TabsContent>

        <TabsContent value="printer" className="p-5 focus-visible:outline-none">
          <BluetoothPrinterPanel />
        </TabsContent>

        <TabsContent value="settings" className="p-5 focus-visible:outline-none">
          <PermissionsView token={token} storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
