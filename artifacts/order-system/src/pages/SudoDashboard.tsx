import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import {
  useGetStores, useCreateStore, useDeleteStore, useUpdateStore,
  useGetAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount,
  useGetServiceTypes, useCreateServiceType, useDeleteServiceType,
  useGetClients, useApproveClient, useRejectClient, useCreateClient, useUpdateClient, useDeleteClient,
  useGetOrders, useCreateOrder, useDeleteOrder,
  getGetStoresQueryKey, getGetAccountsQueryKey, getGetServiceTypesQueryKey, getGetClientsQueryKey, getGetOrdersQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Plus, Trash2, CheckCircle, XCircle, Pencil,
  Store, Users, Layers, UserCheck, ShoppingBag, LayoutDashboard
} from "lucide-react";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  viewer: "Viewer",
  worker: "Ishchi",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  worker: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function StoresView() {
  const { data, isLoading } = useGetStores({ query: { queryKey: getGetStoresQueryKey() } });
  const createStore = useCreateStore();
  const deleteStore = useDeleteStore();
  const updateStore = useUpdateStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tgToken, setTgToken] = useState("");

  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTgToken, setEditTgToken] = useState("");

  const handleCreate = () => {
    if (!name || !username || !password) return toast({ title: "Xatolik", description: "Barcha maydonlarni to'ldiring", variant: "destructive" });
    createStore.mutate({ data: { name, username, password, telegramBotToken: tgToken || null } as any }, {
      onSuccess: () => {
        toast({ title: "Do'kon yaratildi" });
        queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() });
        setOpen(false); setName(""); setUsername(""); setPassword(""); setTgToken("");
      },
      onError: (err) => toast({ title: "Xatolik", description: err.data?.error, variant: "destructive" })
    });
  };

  const openEdit = (store: any) => {
    setEditTarget(store);
    setEditName(store.name);
    setEditUsername(store.username);
    setEditPassword("");
    setEditTgToken(store.telegramBotToken || "");
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editTarget) return;
    const data: any = { name: editName, username: editUsername };
    if (editPassword) data.password = editPassword;
    data.telegramBotToken = editTgToken || null;
    updateStore.mutate({ id: editTarget.id, data }, {
      onSuccess: () => {
        toast({ title: "Do'kon yangilandi" });
        queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() });
        setEditOpen(false);
      },
      onError: (err) => toast({ title: "Xatolik", description: err.data?.error, variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      deleteStore.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "O'chirildi" });
          queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Do'konlar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.length ?? 0} ta do'kon</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Yangi do'kon</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi do'kon qo'shish</DialogTitle>
              <DialogDescription>Do'kon ma'lumotlarini kiriting</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>Nomi</Label><Input placeholder="Do'kon nomi" value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Login</Label><Input placeholder="do'kon_login" value={username} onChange={e => setUsername(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Parol</Label><Input placeholder="••••••••" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Telegram Bot Token (ixtiyoriy)</Label><Input placeholder="1234567890:AAF..." value={tgToken} onChange={e => setTgToken(e.target.value)} className="font-mono text-xs" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
              <Button onClick={handleCreate} disabled={createStore.isPending}>
                {createStore.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Do'konni tahrirlash</DialogTitle>
            <DialogDescription>O'zgartirmoqchi bo'lgan maydonlarni yangilang</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Nomi</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Login</Label><Input value={editUsername} onChange={e => setEditUsername(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Yangi parol (ixtiyoriy)</Label><Input placeholder="O'zgartirmasangiz bo'sh qoldiring" type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Telegram Bot Token</Label><Input placeholder="1234567890:AAF... (bo'sh qoldirsa o'chadi)" value={editTgToken} onChange={e => setEditTgToken(e.target.value)} className="font-mono text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Bekor</Button>
            <Button onClick={handleEdit} disabled={updateStore.isPending}>
              {updateStore.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>TG Bot</TableHead>
              <TableHead>Yaratilgan</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              : data?.map((store: any) => (
                <TableRow key={store.id}>
                  <TableCell className="text-muted-foreground text-sm">{store.id}</TableCell>
                  <TableCell className="font-semibold">{store.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{store.username}</TableCell>
                  <TableCell>{store.telegramBotToken ? <span className="text-green-600 text-xs font-medium">✅ Ulangan</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(store.createdAt), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(store)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)}>
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

function AccountsView() {
  const { data, isLoading } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });
  const { data: stores } = useGetStores({ query: { queryKey: getGetStoresQueryKey() } });
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState<any>("worker");
  const [pin, setPin] = useState("");
  const [storeId, setStoreId] = useState<string>("none");

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<any>("worker");
  const [editPin, setEditPin] = useState("");
  const [editStoreId, setEditStoreId] = useState<string>("none");

  const handleCreate = () => {
    createAccount.mutate({
      data: {
        name,
        role,
        pin: pin || null,
        storeId: storeId !== "none" ? Number(storeId) : null
      }
    }, {
      onSuccess: () => {
        toast({ title: "Hisob yaratildi" });
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        setOpen(false); setName(""); setPin(""); setStoreId("none"); setRole("worker");
      },
      onError: (err) => toast({ title: "Xatolik", description: err.data?.error, variant: "destructive" })
    });
  };

  const openEdit = (acc: any) => {
    setEditTarget(acc);
    setEditName(acc.name);
    setEditRole(acc.role);
    setEditPin(acc.pin || "");
    setEditStoreId(acc.storeId ? String(acc.storeId) : "none");
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editTarget) return;
    updateAccount.mutate({
      id: editTarget.id,
      data: {
        name: editName,
        role: editRole,
        pin: editPin || null,
        storeId: editStoreId !== "none" ? Number(editStoreId) : null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Hisob yangilandi" });
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        setEditOpen(false);
      },
      onError: (err) => toast({ title: "Xatolik", description: err.data?.error, variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      deleteAccount.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "O'chirildi" });
          queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Hisoblar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.length ?? 0} ta foydalanuvchi</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Yangi hisob</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi hisob qo'shish</DialogTitle>
              <DialogDescription>Foydalanuvchi ma'lumotlarini kiriting</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>Ism</Label><Input placeholder="To'liq ism" value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="worker">Ishchi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>PIN kod (4 ta raqam)</Label><Input type="tel" placeholder="1234" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} /></div>
              <div className="space-y-1.5">
                <Label>Do'kon</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Biriktirilmagan</SelectItem>
                    {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
              <Button onClick={handleCreate} disabled={createAccount.isPending}>
                {createAccount.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hisobni tahrirlash</DialogTitle>
            <DialogDescription>"{editTarget?.name}" hisobi ma'lumotlarini o'zgartiring</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Ism</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="worker">Ishchi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>PIN kod (4 ta raqam)</Label>
              <Input type="tel" placeholder="1234" value={editPin} onChange={e => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Do'kon</Label>
              <Select value={editStoreId} onValueChange={setEditStoreId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Biriktirilmagan</SelectItem>
                  {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Bekor</Button>
            <Button onClick={handleEdit} disabled={updateAccount.isPending}>
              {updateAccount.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Do'kon</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              : data?.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="font-semibold">{acc.name}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[acc.role] ?? ''}`}>
                      {ROLE_LABELS[acc.role] ?? acc.role}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{acc.pin || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{acc.storeName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)}>
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

function ServiceTypesView() {
  const { data, isLoading } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });
  const { data: stores } = useGetStores({ query: { queryKey: getGetStoresQueryKey() } });
  const createService = useCreateServiceType();
  const deleteService = useDeleteServiceType();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState<string>("none");

  const handleCreate = () => {
    createService.mutate({ data: { name, storeId: storeId !== "none" ? Number(storeId) : null } }, {
      onSuccess: () => {
        toast({ title: "Xizmat turi qo'shildi" });
        queryClient.invalidateQueries({ queryKey: getGetServiceTypesQueryKey() });
        setOpen(false); setName(""); setStoreId("none");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      deleteService.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "O'chirildi" });
          queryClient.invalidateQueries({ queryKey: getGetServiceTypesQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Xizmat turlari</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.length ?? 0} ta xizmat</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Yangi xizmat</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi xizmat turi</DialogTitle>
              <DialogDescription>Xizmat nomi va do'konini kiriting</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>Nomi</Label><Input placeholder="Xizmat nomi" value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Do'kon (ixtiyoriy)</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Barcha do'konlar uchun</SelectItem>
                    {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
              <Button onClick={handleCreate} disabled={createService.isPending}>
                {createService.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead>Do'kon</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              : data?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.storeId ? stores?.find(x => x.id === s.storeId)?.name : "Barchasi"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
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

function ClientsView() {
  const [status, setStatus] = useState<any>("all");
  const { data, isLoading } = useGetClients(status !== "all" ? { status } : {}, { query: { queryKey: getGetClientsQueryKey({ status }) } });
  const approve = useApproveClient();
  const reject = useRejectClient();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [tgUserId, setTgUserId] = useState("");

  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTgUserId, setEditTgUserId] = useState("");

  const inv = () => queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey({ status }) });

  const handleCreate = () => {
    if (!firstName || !phone) return toast({ title: "Xatolik", description: "Ism va telefon kerak", variant: "destructive" });
    createClient.mutate({ data: { firstName, lastName: lastName || null, phone, telegramUserId: tgUserId || null } as any }, {
      onSuccess: () => {
        toast({ title: "Mijoz qo'shildi" }); inv();
        setCreateOpen(false); setFirstName(""); setLastName(""); setPhone(""); setTgUserId("");
      },
      onError: (e: any) => toast({ title: "Xatolik", description: e.data?.error, variant: "destructive" })
    });
  };

  const openEdit = (c: any) => {
    setEditTarget(c); setEditFirst(c.firstName); setEditLast(c.lastName || "");
    setEditPhone(c.phone || ""); setEditTgUserId(c.telegramUserId ? String(c.telegramUserId) : "");
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editTarget) return;
    updateClient.mutate({ id: editTarget.id, data: { firstName: editFirst, lastName: editLast || null, phone: editPhone, telegramUserId: editTgUserId || null } as any }, {
      onSuccess: () => { toast({ title: "Yangilandi" }); inv(); setEditOpen(false); },
      onError: (e: any) => toast({ title: "Xatolik", description: e.data?.error, variant: "destructive" })
    });
  };

  const handleDelete = (c: any) => {
    if (!confirm(`${c.firstName} ${c.lastName} o'chirilsinmi?`)) return;
    deleteClient.mutate({ id: c.id }, {
      onSuccess: () => { toast({ title: "O'chirildi" }); inv(); },
      onError: (e: any) => toast({ title: "Xatolik", description: e.data?.error, variant: "destructive" })
    });
  };

  const statusColor = (s: string) =>
    s === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
    s === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';

  const statusLabel = (s: string) =>
    s === 'approved' ? 'Tasdiqlangan' : s === 'rejected' ? 'Rad etilgan' : 'Kutilmoqda';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Mijozlar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.length ?? 0} ta mijoz</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="pending">⏳ Kutilmoqda</SelectItem>
              <SelectItem value="approved">✅ Tasdiqlangan</SelectItem>
              <SelectItem value="rejected">❌ Rad etilgan</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Yangi mijoz</Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi mijoz qo'shish</DialogTitle>
                <DialogDescription>Mijoz ma'lumotlarini kiriting</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5"><Label>Ism *</Label><Input placeholder="Ism" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Familiya</Label><Input placeholder="Familiya" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telefon *</Label><Input placeholder="+998901234567" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Telegram User ID</Label><Input type="tel" placeholder="123456789" value={tgUserId} onChange={e => setTgUserId(e.target.value.replace(/\D/g, ""))} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Bekor</Button>
                <Button onClick={handleCreate} disabled={createClient.isPending}>
                  {createClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mijozni tahrirlash</DialogTitle>
            <DialogDescription>Ma'lumotlarni yangilang</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Ism</Label><Input value={editFirst} onChange={e => setEditFirst(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Familiya</Label><Input value={editLast} onChange={e => setEditLast(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Telefon</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Telegram User ID</Label><Input type="tel" value={editTgUserId} onChange={e => setEditTgUserId(e.target.value.replace(/\D/g, ""))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Bekor</Button>
            <Button onClick={handleEdit} disabled={updateClient.isPending}>
              {updateClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>TG ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              : data?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{c.firstName} {c.lastName}</TableCell>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{c.telegramUserId ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {c.status === "pending" && (
                        <>
                          <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 gap-1"
                            onClick={() => approve.mutate({ id: c.id }, { onSuccess: () => { toast({ title: "Tasdiqlandi" }); inv(); } })}>
                            <CheckCircle className="w-3.5 h-3.5" /> Tasdiqla
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                            onClick={() => reject.mutate({ id: c.id }, { onSuccess: () => { toast({ title: "Rad etildi" }); inv(); } })}>
                            <XCircle className="w-3.5 h-3.5" /> Rad et
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
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

function OrdersView() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterStoreId, setFilterStoreId] = useState<string>("all");
  const { data, isLoading } = useGetOrders({ date }, { query: { queryKey: getGetOrdersQueryKey({ date }) } });
  const { data: stores } = useGetStores({ query: { queryKey: getGetStoresQueryKey() } });
  const { data: serviceTypes } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });
  const createOrder = useCreateOrder();
  const deleteOrder = useDeleteOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newStoreId, setNewStoreId] = useState<string>("none");
  const [newServiceTypeId, setNewServiceTypeId] = useState<string>("none");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("");
  const [newShelf, setNewShelf] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const inv = () => queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });

  const filteredServiceTypes = serviceTypes?.filter(st =>
    newStoreId === "none" ? true : st.storeId === null || st.storeId === Number(newStoreId)
  );

  const handleCreate = () => {
    if (newServiceTypeId === "none" || !newQty) return toast({ title: "Xatolik", description: "Xizmat turi va miqdor kerak", variant: "destructive" });
    createOrder.mutate({ data: {
      serviceTypeId: Number(newServiceTypeId),
      quantity: Number(newQty),
      unit: newUnit || null,
      shelf: newShelf || null,
      notes: newNotes || null,
    }}, {
      onSuccess: () => {
        toast({ title: "Zakaz qo'shildi" }); inv();
        setCreateOpen(false); setNewStoreId("none"); setNewServiceTypeId("none");
        setNewQty("1"); setNewUnit(""); setNewShelf(""); setNewNotes("");
      },
      onError: (e: any) => toast({ title: "Xatolik", description: e.data?.error, variant: "destructive" })
    });
  };

  const handleDelete = (o: any) => {
    if (!confirm(`${o.orderId} zakazni o'chirmoqchimisiz?`)) return;
    deleteOrder.mutate({ id: o.id }, {
      onSuccess: () => { toast({ title: "Zakaz o'chirildi" }); inv(); },
      onError: (e: any) => toast({ title: "Xatolik", description: e.data?.error, variant: "destructive" })
    });
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    accepted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };

  const displayed = data?.filter(o => filterStoreId === "all" ? true : o.storeId === Number(filterStoreId));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Barcha Zakazlar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{displayed?.length ?? 0} ta zakaz</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={filterStoreId} onValueChange={setFilterStoreId}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha do'konlar</SelectItem>
              {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[140px]" />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Yangi zakaz</Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi zakaz qo'shish</DialogTitle>
                <DialogDescription>Zakaz ma'lumotlarini kiriting</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Do'kon</Label>
                  <Select value={newStoreId} onValueChange={v => { setNewStoreId(v); setNewServiceTypeId("none"); }}>
                    <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanlang...</SelectItem>
                      {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Xizmat turi *</Label>
                  <Select value={newServiceTypeId} onValueChange={setNewServiceTypeId}>
                    <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanlang...</SelectItem>
                      {filteredServiceTypes?.map(st => <SelectItem key={st.id} value={st.id.toString()}>{st.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Miqdor *</Label><Input type="number" min="1" value={newQty} onChange={e => setNewQty(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Birlik</Label><Input placeholder="kg, m, dona..." value={newUnit} onChange={e => setNewUnit(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Qolib (shelf)</Label><Input placeholder="A-12..." value={newShelf} onChange={e => setNewShelf(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Izoh</Label><Input placeholder="Qo'shimcha ma'lumot" value={newNotes} onChange={e => setNewNotes(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Bekor</Button>
                <Button onClick={handleCreate} disabled={createOrder.isPending}>
                  {createOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Qo'shish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Do'kon</TableHead>
              <TableHead>Xizmat</TableHead>
              <TableHead>Miqdor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead className="text-right">Amal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              : displayed?.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono font-bold text-primary">{o.orderId}</TableCell>
                  <TableCell className="text-sm">{o.storeName}</TableCell>
                  <TableCell className="text-sm">{o.serviceTypeName}</TableCell>
                  <TableCell className="font-semibold">{o.quantity}{o.unit ? <span className="text-muted-foreground text-xs ml-1">{o.unit}</span> : ""}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[o.status] ?? ''}`}>
                      {o.status === 'new' ? 'Yangi' : o.status === 'accepted' ? 'Qabul' : 'Tayyor'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(o.createdAt), "dd.MM.yy HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(o)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
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

const NAV_ITEMS = [
  { key: "stores", label: "Do'konlar", icon: Store },
  { key: "accounts", label: "Hisoblar", icon: Users },
  { key: "services", label: "Xizmatlar", icon: Layers },
  { key: "clients", label: "Mijozlar", icon: UserCheck },
  { key: "orders", label: "Zakazlar", icon: ShoppingBag },
];

export default function SudoDashboard() {
  const { accountName, clearStoreAuth } = useAuth();
  const [view, setView] = useState("stores");

  const views: any = {
    stores: <StoresView />,
    accounts: <AccountsView />,
    services: <ServiceTypesView />,
    clients: <ClientsView />,
    orders: <OrdersView />
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 bg-card border-b shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-primary tracking-tight">SUDO Panel</span>
            <span className="text-xs text-muted-foreground ml-2">· {accountName}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={clearStoreAuth} className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2">
          Chiqish
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-card border-r flex flex-col p-3 gap-1 shrink-0">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                view === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            {views[view]}
          </div>
        </main>
      </div>
    </div>
  );
}
