import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { 
  useGetAccounts, useCreateAccount, useDeleteAccount,
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
import { Loader2, Plus, Trash2, CheckCircle, XCircle, Wrench, Bluetooth, Settings, KeyRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import AdminDashboard from "./AdminDashboard";
import type { StoreSettings } from "@/hooks/useStoreSettings";
import ProductsView from "@/components/ProductsView";
import BluetoothPrinterPanel from "@/components/BluetoothPrinterPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

function AccountsView({ storeId }: { storeId: number }) {
  const { data, isLoading } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });
  const { data: serviceTypes } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<any>("worker");
  const [pin, setPin] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState<string>("");

  const storeAccounts = data?.filter(a => a.storeId === storeId);
  const storeServices = serviceTypes?.filter(s => s.storeId === storeId || s.storeId === null) ?? [];

  const resetForm = () => {
    setName(""); setRole("worker"); setPin(""); setServiceTypeId("");
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

function SettingsView({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<StoreSettings>({
    showPinsToAdmins: true,
    canAdminAnalyze: true,
    canAdminDeleteOrders: true,
    canAdminPrint: true,
    canAdminEditOrders: true,
    canAdminMarkDelivered: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(s => ({ ...s, ...data })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = async (key: keyof StoreSettings) => {
    const newVal = !settings[key];
    setSettings(s => ({ ...s, [key]: newVal }));
    setSaving(key);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: newVal }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setSettings(s => ({ ...s, ...data }));
      toast({ title: "Sozlama saqlandi" });
    } catch {
      setSettings(s => ({ ...s, [key]: !newVal }));
      toast({ title: "Xatolik yuz berdi", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const settingItems: { key: keyof StoreSettings; label: string; desc: string }[] = [
    { key: "showPinsToAdmins",       label: "PIN-kodni adminlarga ko'rsatish",     desc: "Yangi zakazlardagi PIN-kod adminlarga ko'rinadi" },
    { key: "canAdminAnalyze",        label: "Adminlar statistikani ko'ra oladi",   desc: "Yangi/Qabul/Tayyor/Bugun kartochkalarini ko'rish" },
    { key: "canAdminEditOrders",     label: "Adminlar zakazni tahrirlaydi",         desc: "Admin rolidagi foydalanuvchilar zakazni o'zgartira oladi" },
    { key: "canAdminDeleteOrders",   label: "Adminlar zakazni o'chiradi",           desc: "Admin rolidagi foydalanuvchilar zakazni o'chira oladi" },
    { key: "canAdminPrint",          label: "Adminlar chop etadi",                 desc: "Admin va kuzatuvchilar chop etish tugmasini ko'radi" },
    { key: "canAdminMarkDelivered",  label: "Adminlar 'Topshirildi' belgilaydi",   desc: "Admin rolidagi foydalanuvchilar zakazni 'topshirildi' deb belgilay oladi" },
  ];

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Do'kon sozlamalari</h2>
      </div>

      <div className="space-y-3">
        {settingItems.map(({ key, label, desc }) => (
          <Card key={key}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
              </div>
              <Switch
                checked={settings[key]}
                onCheckedChange={() => toggle(key)}
                disabled={saving === key}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        O'zgarishlar real vaqtda barcha qurilmalarga qo'llaniladi
      </p>
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
              <Settings className="w-3 h-3" />Sozlamalar
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
          <SettingsView token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
