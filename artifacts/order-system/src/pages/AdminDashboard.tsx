import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { Header } from "@/components/Header";
import { useSocket } from "@/hooks/useSocket";
import { 
  useGetOrders, 
  useGetOrdersSummary, 
  getGetOrdersQueryKey,
  useGetServiceTypes,
  useGetClients,
  useCreateOrder,
  useDeleteOrder,
  useUpdateOrderStatus,
} from "@workspace/api-client-react";
import { ClientAccountsView } from "@/components/ClientAccountsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/OrderCard";
import { PrintLabelButton } from "@/components/PrintLabelButton";
import { Search, Loader2, Plus, Users, X, QrCode, Hash, Clock, Package, CheckCircle, Phone, User, FileText, Building2, Pencil, Trash2, Truck, Lock, LockOpen, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:          { label: "Yangi",          color: "text-blue-600 bg-blue-50 border border-blue-200" },
  accepted:     { label: "Qabul qilindi",  color: "text-amber-600 bg-amber-50 border border-amber-200" },
  ready:        { label: "Tayyor!",        color: "text-green-600 bg-green-50 border border-green-200" },
  topshirildi:  { label: "Topshirildi",   color: "text-purple-600 bg-purple-50 border border-purple-200" },
};

function OrderDetailModal({ order, open, onClose, onEdit, onDelete, canEdit, canDelete, canPrint, showPins, canMarkDelivered, onDeliver }: { order: any, open: boolean, onClose: () => void, onEdit?: () => void, onDelete?: () => void, canEdit?: boolean, canDelete?: boolean, canPrint?: boolean, showPins?: boolean, canMarkDelivered?: boolean, onDeliver?: () => void }) {
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
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusInfo.color}`}>
              {order.status === 'new' && <Clock className="w-4 h-4" />}
              {order.status === 'accepted' && <Package className="w-4 h-4" />}
              {order.status === 'ready' && <CheckCircle className="w-4 h-4" />}
              {statusInfo.label}
            </div>
            {order.lockPin && order.status === 'new' && showPins !== false && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-orange-100 text-orange-700 border border-orange-300">
                🔒 {order.lockPin}
              </div>
            )}
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
            {order.product && (
              <div className="flex justify-between items-center border-t border-border/50 pt-2">
                <span className="text-sm text-muted-foreground">Mahsulot</span>
                <span className="font-semibold text-primary">{order.product}</span>
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
          {(order as any).extraFields && Object.keys((order as any).extraFields).length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Qo'shimcha maydonlar</div>
              {Object.entries((order as any).extraFields as Record<string, string>).map(([k, v]) => v ? (
                <div key={k} className="flex justify-between items-center border-t border-border/30 pt-2">
                  <span className="text-sm text-muted-foreground">{k}</span>
                  <span className="font-semibold text-sm">{v}</span>
                </div>
              ) : null)}
            </div>
          )}
          <div className="bg-muted/40 rounded-xl p-4 space-y-2">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Vaqt & Xodimlar</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Yaratdi</span>
              <span className="font-medium">{order.createdByName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Yaratildi</span>
              <span className="font-medium">{format(new Date(order.createdAt), "dd.MM HH:mm")}</span>
            </div>
            {order.acceptedAt && (
              <>
                <div className="flex justify-between text-sm text-amber-600 border-t border-border/50 pt-2">
                  <span>Qabul qildi</span>
                  <span className="font-medium">{order.acceptedByName}</span>
                </div>
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Qabul vaqti</span>
                  <span className="font-medium">{format(new Date(order.acceptedAt), "dd.MM HH:mm")}</span>
                </div>
              </>
            )}
            {order.readyAt && (
              <div className="flex justify-between text-sm text-green-600 border-t border-border/50 pt-2">
                <span>Tayyor vaqti</span>
                <span className="font-medium">{format(new Date(order.readyAt), "dd.MM HH:mm")}</span>
              </div>
            )}
            {order.deliveredAt && (
              <>
                <div className="flex justify-between text-sm text-purple-600 border-t border-border/50 pt-2">
                  <span>Topshirildi vaqti</span>
                  <span className="font-medium">{format(new Date(order.deliveredAt), "dd.MM HH:mm")}</span>
                </div>
                {order.deliveredByName && (
                  <div className="flex justify-between text-sm text-purple-600">
                    <span>Topshirdi</span>
                    <span className="font-medium">{order.deliveredByName}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />
              <span>{order.storeName}</span>
            </div>
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
          {canMarkDelivered && order.status === "ready" && (
            <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => { onDeliver?.(); }}>
              <Truck className="w-4 h-4" />
              Olib ketildi
            </Button>
          )}
          {canPrint !== false && <PrintLabelButton order={order} />}
          {(canEdit || canDelete) && (
            <div className="flex gap-2 pt-2 border-t">
              {canEdit && (
                <Button variant="outline" className="flex-1 gap-2 border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => { onClose(); onEdit?.(); }}>
                  <Pencil className="w-4 h-4" />
                  Tahrirlash
                </Button>
              )}
              {canDelete && (
                <Button variant="outline" className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50" onClick={() => { onClose(); onDelete?.(); }}>
                  <Trash2 className="w-4 h-4" />
                  O'chirish
                </Button>
              )}
            </div>
          )}
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
  const selectedClient = clients.find(c => c.id.toString() === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-[200] bg-card border rounded-lg shadow-2xl overflow-hidden">
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
      <div
        className="h-12 flex items-center gap-2 px-3 border rounded-lg bg-card cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setOpen(v => !v)}
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
    </div>
  );
}

function EditOrderModal({ order, open, onClose, storeId }: { order: any, open: boolean, onClose: () => void, storeId: number }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: serviceTypes } = useGetServiceTypes({ query: { queryKey: ["getServiceTypes", storeId] } });
  const { data: clients } = useGetClients({ status: 'approved' }, { query: { queryKey: ["getClients", { status: 'approved' }] } });

  const { role } = useAuth();
  const [serviceTypeId, setServiceTypeId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [shelf, setShelf] = useState("");
  const [product, setProduct] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("new");
  const [outputQty, setOutputQty] = useState("");
  const [outputQtyUnit, setOutputQtyUnit] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    if (order && open) {
      setServiceTypeId(order.serviceTypeId ? String(order.serviceTypeId) : "");
      setQuantity(String(order.quantity ?? 1));
      setUnit(order.unit ?? "");
      setShelf(order.shelf ?? "");
      setProduct(order.product ?? "");
      setNotes(order.notes ?? "");
      setStatus(order.status ?? "new");
      setOutputQty(order.outputQuantity != null ? String(order.outputQuantity) : "");
      setOutputQtyUnit(order.outputUnit ?? "");
      if (order.clientId) {
        setClientId(String(order.clientId));
        setClientName(order.clientName ?? "");
        setClientPhone(order.clientPhone ?? "");
      } else {
        setClientId("");
        setClientName(order.clientName ?? "");
        setClientPhone(order.clientPhone ?? "");
      }
    }
  }, [order, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Xatolik"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getOrders"] });
      toast({ title: "✅ Zakaz yangilandi" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const body: any = {
      quantity: Number(quantity),
      unit: unit || null,
      shelf: shelf || null,
      product: product || null,
      notes: notes || null,
      status,
    };
    if (serviceTypeId) body.serviceTypeId = Number(serviceTypeId);
    if (clientId) { body.clientId = Number(clientId); }
    else { body.clientName = clientName || null; body.clientPhone = clientPhone || null; body.clientId = null; }
    if (role === "superadmin" || role === "sudo") {
      body.outputQuantity = outputQty !== "" ? Number(outputQty) : null;
      body.outputUnit = outputQtyUnit || null;
    }
    updateMutation.mutate(body);
  };

  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm mx-4 max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Zakazni tahrirlash — {order.orderId}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label>Xizmat turi</Label>
              <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                <SelectTrigger className="h-12 bg-card">
                  <SelectValue placeholder="Xizmat turini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {(serviceTypes ?? []).filter((s: any) => s.storeId === storeId || !s.storeId).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Miqdor</Label>
                <Input type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-12 bg-card" required />
              </div>
              <div className="space-y-2">
                <Label>O'lchov</Label>
                <Input placeholder="kg, ta, m..." value={unit} onChange={e => setUnit(e.target.value)} className="h-12 bg-card" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qolib (Shelf)</Label>
              <Input placeholder="Qolib raqami..." value={shelf} onChange={e => setShelf(e.target.value)} className="h-12 bg-card" />
            </div>
            <div className="space-y-2">
              <Label>Mahsulot</Label>
              <Input placeholder="Mahsulot nomi..." value={product} onChange={e => setProduct(e.target.value)} className="h-12 bg-card" />
            </div>
            <div className="space-y-2">
              <Label>Holat</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-12 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Yangi</SelectItem>
                  <SelectItem value="accepted">Qabul qilindi</SelectItem>
                  <SelectItem value="ready">Tayyor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Mijoz</Label>
              <ClientSearch clients={clients ?? []} value={clientId} onChange={(id, name, phone) => { setClientId(id); setClientName(name); setClientPhone(phone); }} />
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input placeholder="Buyurtma haqida izoh..." value={notes} onChange={e => setNotes(e.target.value)} className="h-12 bg-card" />
            </div>
            {(role === "superadmin" || role === "sudo") && (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 space-y-3">
                <Label className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                  Chiqish miqdori (ishchilar tomonidan)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Miqdor</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={outputQty} onChange={e => setOutputQty(e.target.value)} className="h-12 bg-card" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">O'lchov</Label>
                    <Input placeholder="kg, ta, m..." value={outputQtyUnit} onChange={e => setOutputQtyUnit(e.target.value)} className="h-12 bg-card" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-4 border-t shrink-0">
            <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              SAQLASH
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ADMIN_DEFAULT_ORDER_FIELDS = [
  { key: "serviceType",      label: "Xizmat turi",            required: true,  visible: true,  options: [] as string[] },
  { key: "client",           label: "Mijoz",                  required: false, visible: true,  options: [] as string[] },
  { key: "product",          label: "Mahsulot",               required: false, visible: true,  options: [] as string[] },
  { key: "quantity",         label: "Soni",                   required: true,  visible: true,  options: [] as string[] },
  { key: "unit",             label: "O'lchov birligi",        required: false, visible: true,  options: [] as string[] },
  { key: "shelf",            label: "Joylashuv (qolib)",      required: false, visible: true,  options: [] as string[] },
  { key: "notes",            label: "Izoh",                   required: false, visible: true,  options: [] as string[] },
  { key: "requireOutputQty", label: "Chiqish miqdori belgisi",required: false, visible: true,  options: [] as string[] },
];

function CreateOrderDialog({ storeId, open, onOpenChange }: { storeId: number, open: boolean, onOpenChange: (v: boolean) => void }) {
  const { token, allowedServiceTypeIds } = useAuth();
  const [serviceTypeId, setServiceTypeId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [shelf, setShelf] = useState("");
  const [product, setProduct] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [requireOutputQty, setRequireOutputQty] = useState(false);
  const [templateFields, setTemplateFields] = useState<typeof ADMIN_DEFAULT_ORDER_FIELDS>(ADMIN_DEFAULT_ORDER_FIELDS);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const { data: allServiceTypes } = useGetServiceTypes({ query: { queryKey: ["getServiceTypes", storeId] } });
  const serviceTypes = allServiceTypes
    ? (allowedServiceTypeIds && allowedServiceTypeIds.length > 0
        ? allServiceTypes.filter((s: any) => allowedServiceTypeIds.includes(s.id))
        : allServiceTypes)
    : [];
  const { data: clients } = useGetClients({ status: 'approved' }, { query: { queryKey: ["getClients", { status: 'approved' }] } });
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (serviceTypes && serviceTypes.length === 1 && !serviceTypeId) {
      setServiceTypeId(String(serviceTypes[0].id));
    }
  }, [serviceTypes]);

  useEffect(() => {
    setProduct("");
    if (!serviceTypeId || !token) { setProducts([]); return; }
    fetch(`${apiBase}/api/products?serviceTypeId=${serviceTypeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data.filter((p: any) => p.active) : [])).catch(() => setProducts([]));
  }, [serviceTypeId, token]);

  useEffect(() => {
    if (!serviceTypeId || !token) { setTemplateFields(ADMIN_DEFAULT_ORDER_FIELDS); return; }
    fetch(`${apiBase}/api/order-templates/by-service/${serviceTypeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (data?.fields && Array.isArray(data.fields) && data.fields.length > 0) {
        const existingKeys = new Set(data.fields.map((f: any) => f.key));
        const merged = [
          ...data.fields,
          ...ADMIN_DEFAULT_ORDER_FIELDS.filter(d => !existingKeys.has(d.key)).map(d => ({ ...d, visible: false })),
        ];
        setTemplateFields(merged);
      } else {
        setTemplateFields(ADMIN_DEFAULT_ORDER_FIELDS);
      }
    }).catch(() => setTemplateFields(ADMIN_DEFAULT_ORDER_FIELDS));
  }, [serviceTypeId, token]);

  const getField = (key: string) => templateFields.find(f => f.key === key);
  const isVisible = (key: string) => getField(key)?.visible !== false;
  const isRequired = (key: string) => !!getField(key)?.required;
  const getLabel = (key: string) => getField(key)?.label ?? key;

  const resetForm = () => {
    setServiceTypeId(""); setQuantity("1"); setUnit(""); setShelf(""); setProduct(""); setNotes("");
    setClientId(""); setClientName(""); setClientPhone("");
    setProducts([]); setRequireOutputQty(false); setExtraFields({});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceTypeId) {
      toast({ title: "Xatolik", description: "Xizmat turini tanlang", variant: "destructive" }); return;
    }
    createOrder.mutate(
      { data: {
        serviceTypeId: Number(serviceTypeId),
        quantity: Number(quantity),
        unit: unit || null, shelf: shelf || null, product: product || null, notes: notes || null,
        clientId: clientId ? Number(clientId) : null,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        requireOutputQty,
        ...(Object.keys(extraFields).length > 0 ? { extraFields } : {}),
      } as any},
      {
        onSuccess: () => {
          toast({ title: "Muvaffaqiyatli", description: "Yangi zakaz qo'shildi" });
          queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
          onOpenChange(false); resetForm();
        },
        onError: (err) => {
          toast({ title: "Xatolik", description: (err as any).data?.error || "Xatolik yuz berdi", variant: "destructive" });
        }
      }
    );
  };

  const renderField = (key: string) => {
    if (!isVisible(key)) return null;
    const label = getLabel(key);
    const req = isRequired(key);

    switch (key) {
      case "serviceType":
        return (
          <div key={key} className="space-y-2">
            <Label>{label}{req ? " *" : ""}</Label>
            <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
              <SelectTrigger className="h-12 bg-card">
                <SelectValue placeholder="Xizmatni tanlang..." />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes?.map((st: any) => (
                  <SelectItem key={st.id} value={st.id.toString()}>{st.name}</SelectItem>
                ))}
                {!serviceTypes?.length && <div className="p-2 text-sm text-muted-foreground">Xizmat turlari mavjud emas</div>}
              </SelectContent>
            </Select>
          </div>
        );

      case "quantity": {
        const unitField = getField("unit");
        const reqQtyField = getField("requireOutputQty");
        const unitHasOptions = (unitField?.options?.length ?? 0) > 0;
        const showUnitInline = unitField?.visible && !unitHasOptions;
        return (
          <div key={key} className="space-y-2">
            <div className={`grid gap-4 ${showUnitInline ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-2">
                <Label>{label}{req ? " *" : ""}</Label>
                <div className="flex gap-2">
                  <Input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-12 bg-card font-semibold text-lg" required={req} />
                  {reqQtyField?.visible && (
                    <button type="button" onClick={() => setRequireOutputQty(v => !v)} title={reqQtyField.label}
                      className={`h-12 px-3 rounded-lg border text-sm font-bold transition-all shrink-0 ${requireOutputQty ? "bg-green-500 text-white border-green-500 shadow-sm" : "bg-card border-border text-muted-foreground hover:border-green-400 hover:text-green-600"}`}
                    >⚖</button>
                  )}
                </div>
              </div>
              {showUnitInline && (
                <div className="space-y-2">
                  <Label>{unitField!.label}{unitField!.required ? " *" : ""}</Label>
                  <Input placeholder="dona, m2..." value={unit} onChange={e => setUnit(e.target.value)} className="h-12 bg-card" required={unitField!.required} />
                </div>
              )}
            </div>
            {requireOutputQty && reqQtyField?.visible && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <span className="text-base">⚖</span>
                <span>Ishchi <b>TAYYOR</b> bosishdan oldin chiqish miqdorini kiritishi shart bo'ladi</span>
              </div>
            )}
          </div>
        );
      }

      case "unit": {
        const uField = getField("unit");
        const uOpts = uField?.options ?? [];
        if (!uField?.visible) return null;
        if (uOpts.length > 0) {
          return (
            <div key={key} className="space-y-2">
              <Label>{label}{req ? " *" : ""}</Label>
              <div className="flex flex-wrap gap-2">
                {uOpts.map((opt: string) => (
                  <button key={opt} type="button" onClick={() => setUnit(unit === opt ? "" : opt)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${unit === opt ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" : "bg-card border-border hover:border-primary/60 hover:bg-muted/50"}`}
                  >{opt}</button>
                ))}
              </div>
              {unit && <div className="text-xs text-muted-foreground">Tanlangan: <span className="font-semibold text-primary">{unit}</span></div>}
            </div>
          );
        }
        return null;
      }

      case "requireOutputQty":
        return null;

      case "shelf": {
        const sOpts = getField("shelf")?.options ?? [];
        if (sOpts.length > 0) {
          return (
            <div key={key} className="space-y-2">
              <Label>{label}{req ? " *" : ""}</Label>
              <div className="flex flex-wrap gap-2">
                {sOpts.map((opt: string) => (
                  <button key={opt} type="button" onClick={() => setShelf(shelf === opt ? "" : opt)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${shelf === opt ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" : "bg-card border-border hover:border-primary/60 hover:bg-muted/50"}`}
                  >{opt}</button>
                ))}
              </div>
              {shelf && <div className="text-xs text-muted-foreground">Tanlangan: <span className="font-semibold text-primary">{shelf}</span></div>}
            </div>
          );
        }
        return (
          <div key={key} className="space-y-2">
            <Label>{label}{req ? " *" : ""}</Label>
            <Input placeholder="Masalan: A-12" value={shelf} onChange={e => setShelf(e.target.value)} className="h-12 bg-card font-mono" required={req} />
          </div>
        );
      }

      case "product":
        if (products.length === 0) return null;
        return (
          <div key={key} className="space-y-2">
            <Label className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" />{label}{req ? " *" : ""}</Label>
            <div className="flex flex-wrap gap-2">
              {products.map((p: any) => (
                <button key={p.id} type="button" onClick={() => setProduct(product === p.name ? "" : p.name)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${product === p.name ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" : "bg-card border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"}`}
                >{p.name}</button>
              ))}
            </div>
            {product && <div className="text-xs text-muted-foreground">Tanlangan: <span className="font-semibold text-primary">{product}</span></div>}
          </div>
        );

      case "client":
        return (
          <div key={key} className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <Label className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" />{label}{req ? " *" : ""}</Label>
            <ClientSearch clients={clients ?? []} value={clientId} onChange={(id, name, phone) => { setClientId(id); setClientName(name); setClientPhone(phone); }} />
          </div>
        );

      case "notes": {
        const nOpts = getField("notes")?.options ?? [];
        if (nOpts.length > 0) {
          return (
            <div key={key} className="space-y-2">
              <Label>{label}{req ? " *" : ""}</Label>
              <div className="flex flex-wrap gap-2">
                {nOpts.map((opt: string) => (
                  <button key={opt} type="button" onClick={() => setNotes(notes === opt ? "" : opt)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${notes === opt ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" : "bg-card border-border hover:border-primary/60 hover:bg-muted/50"}`}
                  >{opt}</button>
                ))}
              </div>
              {notes && <div className="text-xs text-muted-foreground">Tanlangan: <span className="font-semibold text-primary">{notes}</span></div>}
            </div>
          );
        }
        return (
          <div key={key} className="space-y-2">
            <Label>{label}{req ? " *" : ""}</Label>
            <Input placeholder="Buyurtma haqida izoh..." value={notes} onChange={e => setNotes(e.target.value)} className="h-12 bg-card" required={req} />
          </div>
        );
      }

      default: {
        if (!key.startsWith("custom_")) return null;
        const field = getField(key);
        if (!field || !field.visible) return null;
        const val = extraFields[field.label] ?? "";
        const cOpts = field.options ?? [];
        if (cOpts.length > 0) {
          return (
            <div key={key} className="space-y-2">
              <Label>{field.label}{field.required ? " *" : ""}</Label>
              <div className="flex flex-wrap gap-2">
                {cOpts.map((opt: string) => (
                  <button key={opt} type="button" onClick={() => setExtraFields(prev => ({ ...prev, [field.label]: prev[field.label] === opt ? "" : opt }))}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${val === opt ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" : "bg-card border-border hover:border-primary/60 hover:bg-muted/50"}`}
                  >{opt}</button>
                ))}
              </div>
              {val && <div className="text-xs text-muted-foreground">Tanlangan: <span className="font-semibold text-primary">{val}</span></div>}
            </div>
          );
        }
        return (
          <div key={key} className="space-y-2">
            <Label>{field.label}{field.required ? " *" : ""}</Label>
            <Input value={val} onChange={e => setExtraFields(prev => ({ ...prev, [field.label]: e.target.value }))} className="h-12 bg-card" required={field.required} />
          </div>
        );
      }
    }
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
              {templateFields.map(f => renderField(f.key))}
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
  const { accountName, storeId, role, token, allowedServiceTypeIds } = useAuth();
  const [activeTab, setActiveTab] = useState("new");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [queueLocked, setQueueLocked] = useState(() => {
    try { return localStorage.getItem(`queue_lock_${storeId}`) === "1"; } catch { return false; }
  });
  const toggleQueueLock = () => {
    setQueueLocked(v => {
      const next = !v;
      try { localStorage.setItem(`queue_lock_${storeId}`, next ? "1" : "0"); } catch {}
      return next;
    });
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [deletingOrder, setDeletingOrder] = useState<any>(null);
  const [deliveringOrder, setDeliveringOrder] = useState<any>(null);
  const [historySubTab, setHistorySubTab] = useState<"pending" | "delivered">("pending");

  const { has } = useMyPermissions(token, role);
  const isViewer = role === 'viewer';
  const isSuperUser = role === 'sudo' || role === 'superadmin';
  const canEdit   = has('can_edit_orders');
  const canDelete = has('can_delete_orders');
  const canPrint  = has('can_print');
  const showPins  = has('show_pins');
  const showAnalytics = has('can_analyze');
  const canMarkDelivered = has('can_mark_delivered');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deliverOrderMutation = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getOrders"] });
        toast({ title: "✅ Zakaz topshirildi deb belgilandi" });
        setDeliveringOrder(null);
        setSelectedOrder(null);
      },
      onError: () => toast({ title: "Xatolik", description: "Topshirib bo'lmadi", variant: "destructive" }),
    }
  });

  const deleteOrderMutation = useDeleteOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getOrders"] });
        toast({ title: "✅ Zakaz o'chirildi" });
        setDeletingOrder(null);
      },
      onError: () => toast({ title: "Xatolik", description: "O'chirib bo'lmadi", variant: "destructive" }),
    }
  });

  useSocket(token, storeId);

  const { data: summary } = useGetOrdersSummary({ query: { refetchInterval: 60000, enabled: !!storeId } });
  
  const { data: serviceTypes } = useGetServiceTypes({ query: { enabled: !!storeId } });
  const hasNasiya = (() => {
    const st = serviceTypes as any[];
    if (!st?.length) return false;
    if (allowedServiceTypeIds && allowedServiceTypeIds.length > 0)
      return st.some((s) => allowedServiceTypeIds.includes(s.id) && s.nasiyaEnabled);
    return st.some((s) => s.nasiyaEnabled);
  })();

  const { data: newOrders, isLoading: isNewLoading } = useGetOrders({ status: "new", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "new", storeId: storeId! }), refetchInterval: 60000, enabled: !!storeId } });
  const { data: acceptedOrders, isLoading: isAcceptedLoading } = useGetOrders({ status: "accepted", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "accepted", storeId: storeId! }), refetchInterval: 60000, enabled: !!storeId } });
  const { data: readyOrders, isLoading: isReadyLoading } = useGetOrders({ status: "ready", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "ready", storeId: storeId! }), refetchInterval: 60000, enabled: !!storeId } });
  const { data: historyOrders, isLoading: isHistoryLoading } = useGetOrders({ storeId: storeId!, date }, { query: { queryKey: getGetOrdersQueryKey({ storeId: storeId!, date }), refetchInterval: 60000, enabled: !!storeId } });
  const { data: deliveredOrders, isLoading: isDeliveredLoading } = useGetOrders({ storeId: storeId!, deliveredDate: date } as any, { query: { queryKey: [...getGetOrdersQueryKey({ storeId: storeId! }), "delivered", date], refetchInterval: 60000, enabled: !!storeId } });

  const filterBySearch = (orders: any[] | undefined) => {
    if (!orders) return [];
    if (!search) return orders;
    const s = search.toLowerCase().trim();
    if (!s) return orders;

    const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

    const fmtDate = (d: any) => {
      try {
        const dt = new Date(d);
        return [
          format(dt, "dd.MM.yyyy"),
          format(dt, "dd/MM/yyyy"),
          format(dt, "yyyy-MM-dd"),
          format(dt, "HH:mm"),
          format(dt, "HH:mm:ss"),
          format(dt, "dd.MM.yyyy HH:mm"),
        ];
      } catch { return []; }
    };

    return orders.filter(o => {
      const rawId = (o.orderId ?? "").replace(/^#/, "");
      const qrUrl = `${baseUrl}/order/${rawId}`.toLowerCase();

      const fields: (string | null | undefined)[] = [
        o.orderId,
        rawId,
        qrUrl,
        o.serviceTypeName,
        o.serviceTypeId != null ? String(o.serviceTypeId) : null,
        o.clientName,
        o.clientPhone,
        o.notes,
        o.shelf,
        o.product,
        o.unit,
        o.createdByName,
        o.acceptedByName,
        o.deliveredByName,
        o.storeName,
        o.status,
        o.splitGroup,
        o.splitPart != null ? String(o.splitPart) : null,
        o.lockPin,
        String(o.quantity),
        String(parseFloat(o.quantity ?? "0")),
        ...fmtDate(o.createdAt),
        ...(o.acceptedAt ? fmtDate(o.acceptedAt) : []),
        ...(o.readyAt ? fmtDate(o.readyAt) : []),
        ...(o.deliveredAt ? fmtDate(o.deliveredAt) : []),
      ];

      return fields.some(f => f && f.toLowerCase().includes(s));
    });
  };

  const renderList = (orders: any[] | undefined, isLoading: boolean) => {
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    const filtered = filterBySearch(orders);
    if (!filtered.length) return <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl mt-4 border border-dashed">Malumot topilmadi</div>;

    // Queue lock: per service type — oldest order of each service type stays open
    const oldestIdSet = new Set<number>();
    if (queueLocked && filtered.length > 0) {
      const byType: Record<string, any[]> = {};
      for (const o of filtered) {
        const key = String(o.serviceTypeId ?? o.serviceTypeName ?? "");
        if (!byType[key]) byType[key] = [];
        byType[key].push(o);
      }
      for (const group of Object.values(byType)) {
        const oldest = group.reduce((a: any, b: any) => new Date(a.createdAt) <= new Date(b.createdAt) ? a : b);
        oldestIdSet.add(oldest.id);
      }
    }
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {filtered.map(order => {
          const isLocked = queueLocked && !oldestIdSet.has(order.id);
          return (
            <OrderCard key={order.id} order={order} search={search} onOrderClick={isLocked ? undefined : () => setSelectedOrder(order)} canPrint={isLocked ? false : canPrint} canMarkDelivered={isLocked ? false : canMarkDelivered} onDeliver={isLocked ? undefined : () => setDeliveringOrder(order)} locked={isLocked} />
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      {!hideHeader && <Header title={`${isViewer ? 'Kuzatuvchi' : 'Admin'}: ${accountName}`} showLogout={true} />}
      
      {summary && showAnalytics && (
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
          <TabsList className={`grid w-full h-12 bg-muted/50 p-1 ${hasNasiya ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="new" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">YANGI</TabsTrigger>
            <TabsTrigger value="accepted" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">QABUL</TabsTrigger>
            <TabsTrigger value="ready" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TAYYOR</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TARIX</TabsTrigger>
            {hasNasiya && (
              <TabsTrigger value="hisoblar" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary flex items-center gap-1">
                <CreditCard className="w-3 h-3 hidden sm:block" />HISOB
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        
        {activeTab !== "hisoblar" && <div className="mt-3 flex gap-2">
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
          {!isViewer && (
            <button
              onClick={toggleQueueLock}
              title={queueLocked ? "Navbat rejimi yoqilgan — o'chirish" : "Navbat rejimi — yoqish"}
              className={`h-11 w-11 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                queueLocked
                  ? "bg-amber-500 border-amber-600 text-white shadow-md"
                  : "bg-card border-muted-foreground/20 text-muted-foreground hover:border-amber-400 hover:text-amber-500"
              }`}
            >
              {queueLocked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
            </button>
          )}
        </div>}
      </div>

      {activeTab === "history" && (
        <div className="w-full max-w-[1600px] mx-auto px-3 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setHistorySubTab("pending")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${historySubTab === "pending" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-card border-border text-muted-foreground"}`}
            >
              Olib ketilmaganlar
            </button>
            <button
              onClick={() => setHistorySubTab("delivered")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${historySubTab === "delivered" ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-card border-border text-muted-foreground"}`}
            >
              Olib ketilganlar
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto">
        {activeTab === "new" && renderList(newOrders, isNewLoading)}
        {activeTab === "accepted" && renderList(acceptedOrders, isAcceptedLoading)}
        {activeTab === "ready" && renderList(readyOrders, isReadyLoading)}
        {activeTab === "history" && renderList(
          historySubTab === "delivered"
            ? (deliveredOrders ?? [])
            : (readyOrders ?? []).slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
          historySubTab === "delivered" ? isDeliveredLoading : isReadyLoading
        )}
        {activeTab === "hisoblar" && hasNasiya && storeId && token && (
          <div className="p-4">
            <ClientAccountsView storeId={storeId} token={token} role={role as any} />
          </div>
        )}
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
        canEdit={canEdit}
        canDelete={canDelete}
        canPrint={canPrint}
        showPins={showPins}
        canMarkDelivered={canMarkDelivered}
        onEdit={() => setEditingOrder(selectedOrder)}
        onDelete={() => setDeletingOrder(selectedOrder)}
        onDeliver={() => setDeliveringOrder(selectedOrder)}
      />

      <EditOrderModal
        order={editingOrder}
        open={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        storeId={storeId!}
      />

      <Dialog open={!!deletingOrder} onOpenChange={() => setDeletingOrder(null)}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Zakazni o'chirish
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-bold">{deletingOrder?.orderId}</span> zakazini o'chirmoqchisiz. Bu amalni qaytarib bo'lmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingOrder(null)}>Bekor qilish</Button>
            <Button
              variant="destructive"
              disabled={deleteOrderMutation.isPending}
              onClick={() => deletingOrder && deleteOrderMutation.mutate({ id: deletingOrder.id })}
            >
              {deleteOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              O'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Olib ketildi — tasdiqlash */}
      <Dialog open={!!deliveringOrder} onOpenChange={(v) => { if (!v) setDeliveringOrder(null); }}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <Truck className="w-5 h-5" />
              Olib ketildi
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-bold">{deliveringOrder?.orderId}</span> zakazini olib ketildi deb belgilaysizmi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeliveringOrder(null)}>Bekor</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={deliverOrderMutation.isPending}
              onClick={() => {
                if (deliveringOrder) {
                  deliverOrderMutation.mutate({ id: deliveringOrder.id, data: { status: "topshirildi" } as any });
                }
              }}
            >
              {deliverOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Tasdiqlayman
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
