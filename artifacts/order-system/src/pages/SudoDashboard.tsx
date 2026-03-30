import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { 
  useGetStores, useCreateStore, useDeleteStore,
  useGetAccounts, useCreateAccount, useDeleteAccount,
  useGetServiceTypes, useCreateServiceType, useDeleteServiceType,
  useGetClients, useApproveClient, useRejectClient,
  useGetOrders,
  getGetStoresQueryKey, getGetAccountsQueryKey, getGetServiceTypesQueryKey, getGetClientsQueryKey, getGetOrdersQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

function StoresView() {
  const { data, isLoading } = useGetStores({ query: { queryKey: getGetStoresQueryKey() } });
  const createStore = useCreateStore();
  const deleteStore = useDeleteStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleCreate = () => {
    createStore.mutate({ data: { name, username, password } }, {
      onSuccess: () => {
        toast({ title: "Muvaffaqiyatli saqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() });
        setOpen(false);
      },
      onError: (err) => toast({ title: "Xatolik", description: err.data?.error, variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Haqiqatan ham o'chirmoqchimisiz?")) {
      deleteStore.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "O'chirildi" });
          queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() });
        }
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Do'konlar</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Yangi</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yangi do'kon</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Nomi" value={name} onChange={e=>setName(e.target.value)} />
              <Input placeholder="Login" value={username} onChange={e=>setUsername(e.target.value)} />
              <Input placeholder="Parol" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createStore.isPending}>Saqlash</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Yaratilgan</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             data?.map(store => (
              <TableRow key={store.id}>
                <TableCell>{store.id}</TableCell>
                <TableCell className="font-medium">{store.name}</TableCell>
                <TableCell>{store.username}</TableCell>
                <TableCell>{format(new Date(store.createdAt), "dd.MM.yyyy HH:mm")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<any>("worker");
  const [pin, setPin] = useState("");
  const [storeId, setStoreId] = useState<string>("none");

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
        toast({ title: "Muvaffaqiyatli saqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        setOpen(false);
      },
      onError: (err) => toast({ title: "Xatolik", description: err.data?.error, variant: "destructive" })
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
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Hisoblar</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Yangi</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yangi hisob</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Ism" value={name} onChange={e=>setName(e.target.value)} />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="PIN (6 raqam, ixtiyoriy)" value={pin} onChange={e=>setPin(e.target.value)} />
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Do'kon (ixtiyoriy)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Biriktirilmagan</SelectItem>
                  {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createAccount.isPending}>Saqlash</Button>
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
              <TableHead>Do'kon</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             data?.map(acc => (
              <TableRow key={acc.id}>
                <TableCell className="font-medium">{acc.name}</TableCell>
                <TableCell>{acc.role}</TableCell>
                <TableCell>{acc.storeName || "-"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
        toast({ title: "Muvaffaqiyatli saqlandi" });
        queryClient.invalidateQueries({ queryKey: getGetServiceTypesQueryKey() });
        setOpen(false);
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
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Xizmat turlari</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Yangi</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yangi xizmat</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Nomi" value={name} onChange={e=>setName(e.target.value)} />
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Do'kon (ixtiyoriy, agar faqat bitta do'konga tegishli bo'lsa)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Barchasi uchun</SelectItem>
                  {stores?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createService.isPending}>Saqlash</Button>
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             data?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.storeId ? stores?.find(x=>x.id===s.storeId)?.name : "Barchasi"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
  }

  const handleReject = (id: number) => {
    reject.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Mijoz rad etildi" });
        queryClient.invalidateQueries({ queryKey: getGetClientsQueryKey({ status }) });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mijozlar</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
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
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             data?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell className="text-right">
                  {c.status === "pending" && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" className="text-green-600" onClick={() => handleApprove(c.id)}><CheckCircle className="w-4 h-4" /></Button>
                      <Button variant="outline" size="icon" className="text-red-600" onClick={() => handleReject(c.id)}><XCircle className="w-4 h-4" /></Button>
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

function OrdersView() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data, isLoading } = useGetOrders({ date }, { query: { queryKey: getGetOrdersQueryKey({ date }) } });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Barcha Zakazlar</h2>
        <Input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-[200px]" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Do'kon</TableHead>
              <TableHead>Xizmat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sana</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             data?.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.orderId}</TableCell>
                <TableCell>{o.storeName}</TableCell>
                <TableCell>{o.serviceTypeName} x {o.quantity}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell>{format(new Date(o.createdAt), "dd.MM.yyyy HH:mm")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default function SudoDashboard() {
  const { accountName } = useAuth();
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
      <Header title={`SUDO: ${accountName}`} showLogout={true} />
      
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-card border-r flex flex-col p-4 gap-2">
          <Button variant={view === "stores" ? "secondary" : "ghost"} className="justify-start" onClick={() => setView("stores")}>Do'konlar</Button>
          <Button variant={view === "accounts" ? "secondary" : "ghost"} className="justify-start" onClick={() => setView("accounts")}>Hisoblar</Button>
          <Button variant={view === "services" ? "secondary" : "ghost"} className="justify-start" onClick={() => setView("services")}>Xizmat turlari</Button>
          <Button variant={view === "clients" ? "secondary" : "ghost"} className="justify-start" onClick={() => setView("clients")}>Mijozlar</Button>
          <Button variant={view === "orders" ? "secondary" : "ghost"} className="justify-start" onClick={() => setView("orders")}>Zakazlar</Button>
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
