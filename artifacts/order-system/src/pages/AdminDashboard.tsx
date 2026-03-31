import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { useSocket } from "@/hooks/useSocket";
import { 
  useGetOrders, 
  useGetOrdersSummary, 
  getGetOrdersQueryKey,
  useGetServiceTypes,
  useGetClients,
  useCreateOrder
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/OrderCard";
import { Search, Loader2, Plus, Users, X, QrCode, Hash, Clock, Package, CheckCircle, Phone, User, FileText, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Yangi", color: "text-blue-600 bg-blue-50 border border-blue-200" },
  accepted: { label: "Qabul qilindi", color: "text-amber-600 bg-amber-50 border border-amber-200" },
  ready: { label: "Tayyor!", color: "text-green-600 bg-green-50 border border-green-200" },
};

function OrderDetailModal({ order, open, onClose }: { order: any, open: boolean, onClose: () => void }) {
  if (!order) return null;
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  const qrUrl = `${baseUrl}/order/${order.orderId.replace(/^#/, "")}`;
  const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: "text-gray-600 bg-gray-50" };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            <Hash className="w-5 h-5 text-primary" />
            {order.orderId}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusInfo.color}`}>
            {order.status === 'new' && <Clock className="w-4 h-4" />}
            {order.status === 'accepted' && <Package className="w-4 h-4" />}
            {order.status === 'ready' && <CheckCircle className="w-4 h-4" />}
            {statusInfo.label}
          </div>
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Xizmat turi</span>
              <span className="font-bold text-primary">{order.serviceTypeName}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border/50 pt-2">
              <span className="text-sm text-muted-foreground">Miqdor</span>
              <span className="font-black text-xl">{order.quantity}{order.unit ? <span className="text-muted-foreground text-base ml-1">{order.unit}</span> : ""}</span>
            </div>
            {order.shelf && (
              <div className="flex justify-between items-center border-t border-border/50 pt-2">
                <span className="text-sm text-muted-foreground">Qolib</span>
                <span className="font-mono font-semibold">{order.shelf}</span>
              </div>
            )}
          </div>
          {(order.clientName || order.clientPhone) && (
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Mijoz</div>
              {order.clientName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{order.clientName}</span>
                </div>
              )}
              {order.clientPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{order.clientPhone}</span>
                </div>
              )}
            </div>
          )}
          {order.notes && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <FileText className="w-3.5 h-3.5" />
                Izoh
              </div>
              <p className="text-sm italic">{order.notes}</p>
            </div>
          )}
          <div className="bg-muted/40 rounded-xl p-4 space-y-2">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Vaqt</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Yaratildi</span>
              <span className="font-medium">{format(new Date(order.createdAt), "dd.MM.yyyy HH:mm")}</span>
            </div>
            {order.acceptedAt && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Qabul</span>
                <span className="font-medium">{format(new Date(order.acceptedAt), "dd.MM.yyyy HH:mm")}</span>
              </div>
            )}
            {order.readyAt && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Tayyor</span>
                <span className="font-medium">{format(new Date(order.readyAt), "dd.MM.yyyy HH:mm")}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />
              <span>{order.storeName}</span>
            </div>
            <span className="text-muted-foreground">{order.createdByName}</span>
          </div>
          <div className="flex flex-col items-center pt-2 pb-1">
            <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" />
              Zakaz QR kodi
            </div>
            <div className="bg-white p-3 rounded-xl border">
              <QRCodeSVG value={qrUrl} size={140} level="M" />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center break-all">{qrUrl}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Searchable client selector
function ClientSearch({ clients, value, onChange }: { clients: any[], value: string, onChange: (id: string, name: string, phone: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const selectedClient = clients.find(c => c.id.toString() === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(v => !v);
  };

  const filtered = q.trim() === "" ? clients.slice(0, 8) : clients.filter(c => {
    const s = q.toLowerCase();
    const phone = (c.phone ?? "").replace(/\D/g, "");
    const lastFour = phone.slice(-4);
    return (
      (c.firstName + " " + c.lastName).toLowerCase().includes(s) ||
      lastFour.includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s)
    );
  });

  const highlight = (text: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="bg-yellow-300 text-black rounded px-0.5">{p}</mark> : p);
  };

  return (
    <div ref={triggerRef} className="relative">
      <div
        className="h-12 flex items-center gap-2 px-3 border rounded-lg bg-card cursor-pointer hover:border-primary/50 transition-colors"
        onClick={openDropdown}
      >
        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
        {selectedClient ? (
          <span className="flex-1 text-sm font-medium truncate">{selectedClient.firstName} {selectedClient.lastName} ({selectedClient.phone})</span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">Mijoz qidiring...</span>
        )}
        {value && (
          <button type="button" onClick={e => { e.stopPropagation(); onChange("", "", ""); setQ(""); }}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && (
        <div
          className="fixed z-[200] bg-card border rounded-lg shadow-2xl overflow-hidden"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
        >
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Ism yoki oxirgi 4 raqam..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className="h-9 text-sm"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && <div className="p-3 text-sm text-center text-muted-foreground">Topilmadi</div>}
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center gap-3 transition-colors"
                onClick={() => {
                  onChange(c.id.toString(), c.firstName + " " + c.lastName, c.phone);
                  setQ("");
                  setOpen(false);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {c.firstName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{highlight(c.firstName + " " + c.lastName)}</div>
                  <div className="text-xs text-muted-foreground">{highlight(c.phone)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateOrderDialog({ storeId, open, onOpenChange }: { storeId: number, open: boolean, onOpenChange: (v: boolean) => void }) {
  const [serviceTypeId, setServiceTypeId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [shelf, setShelf] = useState("");
  const [notes, setNotes] = useState("");
  
  const [isClientManual, setIsClientManual] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const { data: serviceTypes } = useGetServiceTypes({ query: { queryKey: ["getServiceTypes", storeId] } });
  const { data: clients } = useGetClients({ status: 'approved' }, { query: { queryKey: ["getClients", { status: 'approved' }] } });
  
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setServiceTypeId("");
    setQuantity("1");
    setUnit("");
    setShelf("");
    setNotes("");
    setIsClientManual(false);
    setClientId("");
    setClientName("");
    setClientPhone("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceTypeId) {
      toast({ title: "Xatolik", description: "Xizmat turini tanlang", variant: "destructive" });
      return;
    }

    createOrder.mutate(
      { 
        data: {
          serviceTypeId: Number(serviceTypeId),
          quantity: Number(quantity),
          unit: unit || null,
          shelf: shelf || null,
          notes: notes || null,
          clientId: !isClientManual && clientId ? Number(clientId) : null,
          clientName: isClientManual ? clientName : null,
          clientPhone: isClientManual ? clientPhone : null,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Muvaffaqiyatli", description: "Yangi zakaz qo'shildi" });
          queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
          onOpenChange(false);
          resetForm();
        },
        onError: (err) => {
          toast({ title: "Xatolik", description: (err as any).data?.error || "Xatolik yuz berdi", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="w-full max-w-md mx-4 max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-xl font-bold">Yangi Zakaz</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Mijoz uchun yangi buyurtma yarating</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-5 px-6 py-5">
              
              <div className="space-y-2">
                <Label>Xizmat turi *</Label>
                <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                  <SelectTrigger className="h-12 bg-card">
                    <SelectValue placeholder="Xizmatni tanlang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes?.map(st => (
                      <SelectItem key={st.id} value={st.id.toString()}>{st.name}</SelectItem>
                    ))}
                    {!serviceTypes?.length && <div className="p-2 text-sm text-muted-foreground">Xizmat turlari mavjud emas</div>}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Soni *</Label>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    value={quantity} 
                    onChange={e => setQuantity(e.target.value)} 
                    className="h-12 bg-card font-semibold text-lg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>O'lchov</Label>
                  <Input 
                    placeholder="dona, m2..." 
                    value={unit} 
                    onChange={e => setUnit(e.target.value)} 
                    className="h-12 bg-card"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Qolib (joylashuv)</Label>
                <Input 
                  placeholder="Masalan: A-12" 
                  value={shelf} 
                  onChange={e => setShelf(e.target.value)} 
                  className="h-12 bg-card font-mono"
                />
              </div>

              <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Mijoz
                  </Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground cursor-pointer">Qo'lda</Label>
                    <Switch checked={isClientManual} onCheckedChange={setIsClientManual} />
                  </div>
                </div>

                {!isClientManual ? (
                  <ClientSearch
                    clients={clients ?? []}
                    value={clientId}
                    onChange={(id, name, phone) => { setClientId(id); setClientName(name); setClientPhone(phone); }}
                  />
                ) : (
                  <div className="space-y-3">
                    <Input 
                      placeholder="Ism / Familiya" 
                      value={clientName} 
                      onChange={e => setClientName(e.target.value)} 
                      className="h-12 bg-card"
                    />
                    <Input 
                      placeholder="+998..." 
                      value={clientPhone} 
                      onChange={e => setClientPhone(e.target.value)} 
                      className="h-12 bg-card"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Qo'shimcha izoh</Label>
                <Input 
                  placeholder="Buyurtma haqida izoh..." 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="h-12 bg-card"
                />
              </div>

            </div>
          </div>
          
          <DialogFooter className="px-6 pb-6 pt-4 border-t shrink-0">
            <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" disabled={createOrder.isPending}>
              {createOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              SAQLASH
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard({ hideHeader = false, stickyTop = 60 }: { hideHeader?: boolean, stickyTop?: number }) {
  const { accountName, storeId, role, token } = useAuth();
  const [activeTab, setActiveTab] = useState("new");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const isViewer = role === 'viewer';

  useSocket(token, storeId);

  const { data: summary } = useGetOrdersSummary({ query: { refetchInterval: 30000 } });
  
  const { data: newOrders, isLoading: isNewLoading } = useGetOrders({ status: "new", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "new", storeId: storeId! }), refetchInterval: 30000 } });
  const { data: acceptedOrders, isLoading: isAcceptedLoading } = useGetOrders({ status: "accepted", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "accepted", storeId: storeId! }), refetchInterval: 30000 } });
  const { data: readyOrders, isLoading: isReadyLoading } = useGetOrders({ status: "ready", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "ready", storeId: storeId! }), refetchInterval: 30000 } });
  const { data: historyOrders, isLoading: isHistoryLoading } = useGetOrders({ storeId: storeId!, date }, { query: { queryKey: getGetOrdersQueryKey({ storeId: storeId!, date }), refetchInterval: 30000 } });

  const filterBySearch = (orders: any[] | undefined) => {
    if (!orders) return [];
    if (!search) return orders;
    const s = search.toLowerCase();
    return orders.filter(o => 
      o.orderId.toLowerCase().includes(s) || 
      o.serviceTypeName.toLowerCase().includes(s) || 
      (o.clientName && o.clientName.toLowerCase().includes(s)) ||
      (o.notes && o.notes.toLowerCase().includes(s)) ||
      (o.shelf && o.shelf.toLowerCase().includes(s)) ||
      String(o.quantity).includes(s) ||
      (o.unit && o.unit.toLowerCase().includes(s)) ||
      format(new Date(o.createdAt), "HH:mm").includes(s)
    );
  };

  const renderList = (orders: any[] | undefined, isLoading: boolean) => {
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    const filtered = filterBySearch(orders);
    if (!filtered.length) return <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl mt-4 border border-dashed">Malumot topilmadi</div>;
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {filtered.map(order => (
          <OrderCard key={order.id} order={order} search={search} onOrderClick={() => setSelectedOrder(order)} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      {!hideHeader && <Header title={`${isViewer ? 'Kuzatuvchi' : 'Admin'}: ${accountName}`} showLogout={true} />}
      
      {summary && (
        <div className="grid grid-cols-4 gap-2 p-4 pb-3">
          <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl p-3 text-center border border-blue-500/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.new}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider mt-0.5">Yangi</div>
          </div>
          <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl p-3 text-center border border-amber-500/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.accepted}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider mt-0.5">Qabul</div>
          </div>
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 rounded-xl p-3 text-center border border-green-500/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.ready}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider mt-0.5">Tayyor</div>
          </div>
          <div className="bg-primary/10 text-primary rounded-xl p-3 text-center border border-primary/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.totalToday}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider mt-0.5">Bugun</div>
          </div>
        </div>
      )}

      <div className="p-4 pt-2 sticky z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b" style={{ top: stickyTop }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-12 bg-muted/50 p-1">
            <TabsTrigger value="new" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">YANGI</TabsTrigger>
            <TabsTrigger value="accepted" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">QABUL</TabsTrigger>
            <TabsTrigger value="ready" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TAYYOR</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TARIX</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Qidirish..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 text-sm bg-card shadow-sm border-muted-foreground/20 focus-visible:ring-primary/50 transition-all"
            />
          </div>
          {activeTab === "history" && (
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-[140px] h-11 bg-card shadow-sm border-muted-foreground/20 text-sm"
            />
          )}
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto">
        {activeTab === "new" && renderList(newOrders, isNewLoading)}
        {activeTab === "accepted" && renderList(acceptedOrders, isAcceptedLoading)}
        {activeTab === "ready" && renderList(readyOrders, isReadyLoading)}
        {activeTab === "history" && renderList(historyOrders, isHistoryLoading)}
      </div>

      {!isViewer && (
        <>
          <button
            onClick={() => setCreateOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-50"
          >
            <Plus className="w-7 h-7" />
          </button>
          <CreateOrderDialog storeId={storeId!} open={createOpen} onOpenChange={setCreateOpen} />
        </>
      )}

      <OrderDetailModal
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
