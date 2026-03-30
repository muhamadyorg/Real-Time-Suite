import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";
import AdminDashboard from "./AdminDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function AccountsView({ storeId }: { storeId: number }) {
  const { data, isLoading } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<any>("worker");
  const [pin, setPin] = useState("");

  const storeAccounts = data?.filter(a => a.storeId === storeId);

  const handleCreate = () => {
    createAccount.mutate({ 
      data: { 
        name, 
        role, 
        pin: pin || null, 
        storeId 
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
        <h2 className="text-xl font-bold">Do'kon ishchilari</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Yangi ishchi</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yangi ishchi</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Ism" value={name} onChange={e=>setName(e.target.value)} />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="PIN (6 raqam)" value={pin} onChange={e=>setPin(e.target.value)} />
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             storeAccounts?.map(acc => (
              <TableRow key={acc.id}>
                <TableCell className="font-medium">{acc.name}</TableCell>
                <TableCell>{acc.role}</TableCell>
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
        <h2 className="text-xl font-bold">Xizmat turlari</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Yangi xizmat</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yangi xizmat</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Nomi" value={name} onChange={e=>setName(e.target.value)} />
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={2} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow> : 
             storeServices?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right">
                  {s.storeId !== null && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  )}
                  {s.storeId === null && <span className="text-xs text-muted-foreground">Umumiy</span>}
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
        <h2 className="text-xl font-bold">Mijozlar</h2>
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

export default function SuperadminDashboard() {
  const { accountName, storeId } = useAuth();
  
  if (!storeId) return null;

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <Header title={`Superadmin: ${accountName}`} showLogout={true} />
      
      <Tabs defaultValue="orders" className="w-full">
        <div className="p-4 bg-background border-b sticky top-[60px] z-20">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl mx-auto h-12">
            <TabsTrigger value="orders">Zakazlar</TabsTrigger>
            <TabsTrigger value="accounts">Ishchilar</TabsTrigger>
            <TabsTrigger value="services">Xizmatlar</TabsTrigger>
            <TabsTrigger value="clients">Mijozlar</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="orders" className="mt-0 focus-visible:outline-none">
          {/* AdminDashboard essentially gives us the full orders view + create sheet */}
          {/* We strip its Header by wrapping it or modifying it, but since AdminDashboard has its own Header, 
              it might be easier to just use AdminDashboard directly, but we already have a Header here. 
              Let's hide the AdminDashboard header via a prop or just let it render its own. 
              Actually, AdminDashboard is a full page. So let's render AdminDashboard without wrapper or just embed it.
          */}
          <div className="-mt-[60px]">
            <AdminDashboard hideHeader={true} />
          </div>
        </TabsContent>
        
        <TabsContent value="accounts" className="p-6 max-w-5xl mx-auto">
          <AccountsView storeId={storeId} />
        </TabsContent>
        
        <TabsContent value="services" className="p-6 max-w-5xl mx-auto">
          <ServiceTypesView storeId={storeId} />
        </TabsContent>

        <TabsContent value="clients" className="p-6 max-w-5xl mx-auto">
          <ClientsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
