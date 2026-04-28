import React, { useState, useRef, useEffect } from "react";
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
import { AnalyticsView } from "@/components/AnalyticsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/OrderCard";
import { PrintLabelButton } from "@/components/PrintLabelButton";
import { Search, Loader2, Plus, Users, X, QrCode, Hash, Clock, Package, CheckCircle, Phone, User, FileText, Building2, Pencil, Trash2, Truck, Lock, LockOpen, CreditCard, TrendingUp, TrendingDown, Split } from "lucide-react";
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
function ClientSearch({ clients, value, name: manualName, onChange }: { clients: any[], value: string, name?: string, onChange: (id: string, name: string, phone: string) => void }) {
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

  const handleQuickAdd = () => {
    onChange("", q.trim(), "");
    setQ("");
    setOpen(false);
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
            {q.trim() !== "" && filtered.length === 0 && (
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-green-50 dark:hover:bg-green-950/30 flex items-center gap-3 transition-colors border-t"
                onClick={handleQuickAdd}
              >
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 flex items-center justify-center text-sm font-bold shrink-0">+</div>
                <div>
                  <div className="text-sm font-medium text-green-700 dark:text-green-400">«{q.trim()}»</div>
                  <div className="text-xs text-muted-foreground">Shu nomda qo'shish</div>
                </div>
              </button>
            )}
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
        ) : manualName ? (
          <span className="flex-1 text-sm font-medium truncate text-green-700 dark:text-green-400">{manualName}</span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">Mijoz qidiring...</span>
        )}
        {(value || manualName) && (
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
              <ClientSearch clients={clients ?? []} value={clientId} name={clientName} onChange={(id, name, phone) => { setClientId(id); setClientName(name); setClientPhone(phone); }} />
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
  { key: "price",            label: "Narx (so'm)",            required: false, visible: true,  options: [] as string[] },
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
  const [priceRaw, setPriceRaw] = useState("");
  const priceEdited = useRef(false);
  const fmtPrice = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const handlePriceBlur = () => {
    if (priceEdited.current) {
      const d = priceRaw.replace(/\s/g, "");
      if (d) setPriceRaw(fmtPrice(d + "000"));
      priceEdited.current = false;
    }
  };
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
    setServiceTypeId(""); setQuantity("1"); setUnit(""); setShelf(""); setProduct(""); setNotes(""); setPriceRaw("");
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
        ...(priceRaw.trim() ? { price: Number(priceRaw.replace(/\s/g, "")) } : {}),
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
            <ClientSearch clients={clients ?? []} value={clientId} name={clientName} onChange={(id, name, phone) => { setClientId(id); setClientName(name); setClientPhone(phone); }} />
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

      case "price":
        return (
          <div key={key} className="space-y-2">
            <Label className="flex items-center gap-1.5">
              {label}{req ? " *" : ""}
              <span className="text-xs text-muted-foreground font-normal">— raqam kiriting, 000 avtomatik qo'shiladi</span>
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="masalan: 150 → 150 000"
              value={priceRaw}
              onChange={e => { setPriceRaw(fmtPrice(e.target.value)); priceEdited.current = true; }}
              onBlur={handlePriceBlur}
              className="h-12 bg-card font-semibold text-lg tabular-nums"
              required={req}
            />
            {priceRaw && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{priceRaw} so'm</p>
            )}
          </div>
        );

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

  // TAYYOR bosqichi: faqat summa modal
  const [summaryOrder, setSummaryOrder] = useState<any>(null);
  const [summaryAmount, setSummaryAmount] = useState("");
  // OLIB KETILDI bosqichi: naqd/qarz payment modal
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<"naqd" | "qarz" | "click" | "dokonga">("naqd");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [clientBalance, setClientBalance] = useState(0);
  const [clientBalanceLoading, setClientBalanceLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);
  // Bo'lib to'lash
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  // Bo'lib to'lash 2-qadam: qolgan qism uchun to'lov turi so'raladi
  const [splitStep2, setSplitStep2] = useState(false);
  const [splitStep2Mode, setSplitStep2Mode] = useState<"naqd" | "qarz" | "click" | "dokonga">("qarz");
  const adFmtAmt = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const adParseAmt = (v: string) => parseFloat(v.replace(/\s/g, "") || "0");
  // TAYYOR: chiqish miqdori
  const [readyQtyOrder, setReadyQtyOrder] = useState<any>(null);
  const [readyQtyInput, setReadyQtyInput] = useState("");
  const [readyQtyUnit, setReadyQtyUnit] = useState("");
  // Summa formatlash (3 raqamda bo'shliq)
  const fmtAmt = (v: string) => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const parseAmt = (v: string) => parseFloat(v.replace(/\s/g, "") || "0");

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

  const updateStatus = useUpdateOrderStatus();

  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const handleReady = async (order: any) => {
    const st = (serviceTypes as any[])?.find((s: any) => s.id === order.serviceTypeId);
    const needsSumma = st?.nasiyaEnabled && order.clientId;
    if (needsSumma) {
      const existing = order.price ? fmtAmt(String(Math.round(Number(order.price)))) : "";
      setSummaryAmount(existing);
      setSummaryOrder(order);
      return;
    }
    if (order.requireOutputQty) {
      setReadyQtyInput("");
      setReadyQtyUnit(order.unit ?? "");
      setReadyQtyOrder(order);
      return;
    }
    updateStatus.mutate(
      { id: order.id, data: { status: "ready" } as any },
      {
        onSuccess: () => {
          toast({ title: "✅ Tayyor deb belgilandi!" });
          queryClient.invalidateQueries({ queryKey: ["getOrders"] });
        },
        onError: () => toast({ title: "Xatolik", variant: "destructive" }),
      }
    );
  };

  const doReadyWithSumma = () => {
    if (!summaryOrder) return;
    const amount = parseAmt(summaryAmount);
    updateStatus.mutate(
      { id: summaryOrder.id, data: { status: "ready", ...(amount > 0 ? { price: amount } : {}) } as any },
      {
        onSuccess: () => {
          toast({ title: "✅ Tayyor deb belgilandi!" });
          queryClient.invalidateQueries({ queryKey: ["getOrders"] });
          setSummaryOrder(null);
        },
        onError: () => toast({ title: "Xatolik", variant: "destructive" }),
      }
    );
  };

  const resetPaymentModal = () => {
    setPaymentOrder(null);
    setSplitPayment(false); setSplitAmount("");
    setSplitStep2(false); setSplitStep2Mode("qarz");
  };

  const doDeliverWithPayment = async () => {
    if (!paymentOrder || !storeId) return;
    const orderPrice = paymentOrder.price ? Number(paymentOrder.price) : 0;
    if (orderPrice <= 0) {
      toast({ title: "Zakaz summasi kiritilmagan", variant: "destructive" }); return;
    }
    const splitAmt = splitPayment ? adParseAmt(splitAmount) : 0;

    // Bo'lib to'lash 1-qadam: faqat validatsiya qilib 2-qadamga o'tkazamiz
    if (splitPayment && !splitStep2) {
      if (splitAmt <= 0 || splitAmt >= orderPrice) {
        toast({ title: "To'g'ri qisman summa kiriting", variant: "destructive" }); return;
      }
      setSplitStep2(true);
      setSplitStep2Mode("qarz");
      return;
    }

    setPaymentLoading(true);
    try {
      if (paymentOrder.clientId) {
        const txNote = (type: string, suffix?: string) => {
          const base = `Zakaz ${paymentOrder.orderId}`;
          if (type === "naqd")    return `${base} — naqd to'lov${suffix ?? ""}`;
          if (type === "click")   return `${base} — Click to'lov${suffix ?? ""}`;
          if (type === "dokonga") return `${base} — Dokonga berildi${suffix ?? ""}`;
          return `${base} uchun nasiya${suffix ?? ""}`;
        };

        if (splitPayment && splitStep2) {
          // 1-qism: tanlangan to'lov turi bilan
          const tx1 = await fetch(`${apiBase}/api/client-accounts/${paymentOrder.clientId}/transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type: paymentMode, amount: splitAmt, serviceTypeId: paymentOrder.serviceTypeId, orderId: paymentOrder.id, orderCode: paymentOrder.orderId, note: txNote(paymentMode, " (1-qism)"), storeId }),
          });
          if (!tx1.ok) {
            const err = await tx1.json();
            toast({ title: "1-qism tranzaksiya xatosi", description: err.error, variant: "destructive" });
            setPaymentLoading(false); return;
          }
          // 2-qism: foydalanuvchi tanlagan to'lov turi bilan
          const remainder = orderPrice - splitAmt;
          const tx2 = await fetch(`${apiBase}/api/client-accounts/${paymentOrder.clientId}/transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type: splitStep2Mode, amount: remainder, serviceTypeId: paymentOrder.serviceTypeId, orderId: paymentOrder.id, orderCode: paymentOrder.orderId, note: txNote(splitStep2Mode, " (2-qism)"), storeId }),
          });
          if (!tx2.ok) {
            const err = await tx2.json();
            toast({ title: "2-qism tranzaksiya xatosi", description: err.error, variant: "destructive" });
            setPaymentLoading(false); return;
          }
        } else {
          const txRes = await fetch(`${apiBase}/api/client-accounts/${paymentOrder.clientId}/transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type: paymentMode, amount: orderPrice, serviceTypeId: paymentOrder.serviceTypeId, orderId: paymentOrder.id, orderCode: paymentOrder.orderId, note: txNote(paymentMode), storeId }),
          });
          if (!txRes.ok) {
            const err = await txRes.json();
            toast({ title: "Tranzaksiya xatosi", description: err.error, variant: "destructive" });
            setPaymentLoading(false); return;
          }
        }
      }
      const MODE_LABELS: Record<string, string> = { naqd: "Naqd", click: "Click", dokonga: "Dokonga", qarz: "Qarz" };
      updateStatus.mutate(
        { id: paymentOrder.id, data: { status: "topshirildi" } as any },
        {
          onSuccess: () => {
            const label = splitPayment
              ? `✅ Bo'lib to'landi! ${MODE_LABELS[paymentMode] ?? paymentMode} + ${MODE_LABELS[splitStep2Mode] ?? splitStep2Mode}`
              : ({ qarz: "✅ Olib ketildi! Qarz yozildi", click: "✅ Olib ketildi! Click", dokonga: "✅ Olib ketildi! Dokonga", naqd: "✅ Olib ketildi!" }[paymentMode] ?? "✅ Olib ketildi!");
            toast({ title: label });
            queryClient.invalidateQueries({ queryKey: ["getOrders"] });
            resetPaymentModal();
          },
          onError: () => toast({ title: "Xatolik", variant: "destructive" }),
        }
      );
    } catch {
      toast({ title: "Tarmoq xatosi", variant: "destructive" });
    } finally {
      setPaymentLoading(false);
    }
  };

  const doReady = () => {
    if (!readyQtyOrder) return;
    if (!readyQtyInput || readyQtyInput.trim() === "") {
      toast({ title: "Chiqish miqdorini kiriting", variant: "destructive" }); return;
    }
    const qty = parseFloat(readyQtyInput);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "To'g'ri miqdor kiriting", variant: "destructive" }); return;
    }
    updateStatus.mutate(
      { id: readyQtyOrder.id, data: { status: "ready", outputQuantity: String(qty), outputUnit: readyQtyUnit || undefined } as any },
      {
        onSuccess: () => {
          toast({ title: "✅ Tayyor deb belgilandi!" });
          queryClient.invalidateQueries({ queryKey: ["getOrders"] });
          setReadyQtyOrder(null);
        },
        onError: () => toast({ title: "Xatolik", variant: "destructive" }),
      }
    );
  };

  const handleDeliverAdmin = async (order: any) => {
    if (!order) return;
    const st = (serviceTypes as any[])?.find((s: any) => s.id === order.serviceTypeId);
    const needsPayment = st?.nasiyaEnabled && order.clientId;
    if (needsPayment) {
      setClientBalanceLoading(true);
      try {
        const r = await fetch(`${apiBase}/api/client-accounts/${order.clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        setClientBalance(data.balance ?? 0);
        setClientInfo(data.client ?? null);
      } catch {
        setClientBalance(0);
        setClientInfo(null);
      } finally {
        setClientBalanceLoading(false);
      }
      setPaymentMode("naqd");
      setPaymentAmount("");
      setPaymentOrder(order);
      return;
    }
    setDeliveringOrder(order);
  };

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

  const renderList = (orders: any[] | undefined, isLoading: boolean, getActionBtn?: (order: any) => React.ReactNode) => {
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
            <OrderCard
              key={order.id}
              order={order}
              search={search}
              onOrderClick={isLocked ? undefined : () => setSelectedOrder(order)}
              canPrint={isLocked ? false : canPrint}
              canMarkDelivered={isLocked ? false : canMarkDelivered}
              onDeliver={isLocked ? undefined : () => handleDeliverAdmin(order)}
              locked={isLocked}
              actionButton={isLocked ? undefined : getActionBtn?.(order)}
            />
          );
        })}
      </div>
    );
  };

  const tayyorBtn = (order: any) => !isViewer ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleReady(order); }}
      disabled={updateStatus.isPending}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-sm transition-all shadow-md disabled:opacity-60"
    >
      {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
      TAYYOR
    </button>
  ) : null;

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
          <TabsList className={`grid w-full h-12 bg-muted/50 p-1`} style={{ gridTemplateColumns: `repeat(${4 + (hasNasiya ? 1 : 0) + (showAnalytics ? 1 : 0)}, 1fr)` }}>
            <TabsTrigger value="new" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">YANGI</TabsTrigger>
            <TabsTrigger value="accepted" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">QABUL</TabsTrigger>
            <TabsTrigger value="ready" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TAYYOR</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TARIX</TabsTrigger>
            {hasNasiya && (
              <TabsTrigger value="hisoblar" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary flex items-center gap-1">
                <CreditCard className="w-3 h-3 hidden sm:block" />HISOB
              </TabsTrigger>
            )}
            {showAnalytics && (
              <TabsTrigger value="analytics" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary flex items-center gap-1">
                <TrendingUp className="w-3 h-3 hidden sm:block" />HISOBOT
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        
        {activeTab !== "hisoblar" && activeTab !== "analytics" && <div className="mt-3 flex gap-2">
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
        {activeTab === "accepted" && renderList(acceptedOrders, isAcceptedLoading, tayyorBtn)}
        {activeTab === "ready" && renderList(readyOrders, isReadyLoading)}
        {activeTab === "history" && renderList(
          historySubTab === "delivered"
            ? (deliveredOrders ?? []).slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            : (readyOrders ?? []).slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
          historySubTab === "delivered" ? isDeliveredLoading : isReadyLoading
        )}
        {activeTab === "hisoblar" && hasNasiya && storeId && token && (
          <div className="p-4">
            <ClientAccountsView storeId={storeId} token={token} role={role as any} />
          </div>
        )}
        {activeTab === "analytics" && showAnalytics && storeId && token && (
          <div className="p-4">
            <AnalyticsView
              storeId={storeId}
              token={token}
              serviceTypes={Array.isArray(serviceTypes) ? (serviceTypes as any[]).filter((s: any) => !allowedServiceTypeIds?.length || allowedServiceTypeIds.includes(s.id)) : []}
            />
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
        onDeliver={() => { handleDeliverAdmin(selectedOrder); setSelectedOrder(null); }}
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

      {/* Chiqish miqdori — TAYYOR bosilganda */}
      <Dialog open={!!readyQtyOrder} onOpenChange={(v) => { if (!v) setReadyQtyOrder(null); }}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Chiqish miqdori
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-bold">{readyQtyOrder?.orderId}</span> zakazidan nechta mahsulot chiqdi?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">Kirish: <span className="font-bold text-foreground">{readyQtyOrder?.quantity}{readyQtyOrder?.unit ? ` ${readyQtyOrder.unit}` : ""}</span></div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Miqdor..."
                value={readyQtyInput}
                onChange={e => setReadyQtyInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && readyQtyInput) doReady(); }}
                className="h-12 text-xl font-bold text-center"
                autoFocus
              />
              <Input
                placeholder="Birlik"
                value={readyQtyUnit}
                onChange={e => setReadyQtyUnit(e.target.value)}
                className="h-12 w-24 text-center font-semibold"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReadyQtyOrder(null)}>Bekor</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={!readyQtyInput || updateStatus.isPending}
              onClick={doReady}
            >
              {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Tayyor!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tayyor summa modal — TAYYOR bosilganda faqat summa so'raladi */}
      <Dialog open={!!summaryOrder} onOpenChange={(v) => { if (!v) setSummaryOrder(null); }}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Tayyor — summa
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-bold">{summaryOrder?.orderId}</span> zakazi uchun summani kiriting
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {summaryOrder?.price && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Joriy narx</span>
                <span className="font-bold">{Math.round(Number(summaryOrder.price)).toLocaleString("uz-UZ")} so'm</span>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Summa (so'm)</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={summaryAmount}
                onChange={(e) => setSummaryAmount(fmtAmt(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") doReadyWithSumma(); }}
                autoFocus
                className="text-xl font-bold h-14 text-center tabular-nums"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSummaryOrder(null)}>Bekor</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={updateStatus.isPending}
              onClick={doReadyWithSumma}
            >
              {updateStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Tayyor!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nasiya Payment Modal — OLIB KETILDI bosilganda naqd/qarz so'raladi */}
      <Dialog open={!!paymentOrder} onOpenChange={(v) => { if (!v) resetPaymentModal(); }}>
        <DialogContent className="w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <Truck className="w-5 h-5" />
              {splitStep2 ? "Qolgan qism — to'lov turi" : "Olib ketildi — to'lov"}
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-bold">{paymentOrder?.orderId}</span>
              {splitStep2
                ? ` — 1-qism: ${splitAmount} so'm (${paymentMode === "naqd" ? "💵 Naqd" : paymentMode === "click" ? "📲 Click" : "🏪 Dokonga"}) to'landi`
                : " — to'lov turini tanlang"}
            </DialogDescription>
          </DialogHeader>

          {splitStep2 ? (
            /* ─── 2-QADAM: Qolgan qism uchun to'lov turi ─── */
            <div className="space-y-4">
              {/* Qolgan summa */}
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl px-4 py-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-amber-700 dark:text-amber-400 font-medium">Jami summa:</span>
                  <span className="font-bold text-amber-700">{Math.round(Number(paymentOrder?.price)).toLocaleString("uz-UZ")} so'm</span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-amber-200 dark:border-amber-800">
                  <span className="text-green-700 dark:text-green-400 font-medium">✅ To'landi:</span>
                  <span className="font-bold text-green-700">{splitAmount} so'm</span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-amber-200 dark:border-amber-800">
                  <span className="text-red-600 dark:text-red-400 font-semibold">💬 Qolgan qism:</span>
                  <span className="font-black text-red-600 text-base">{(Number(paymentOrder?.price) - adParseAmt(splitAmount)).toLocaleString("uz-UZ")} so'm</span>
                </div>
              </div>

              {/* Qolgan qism uchun to'lov turi */}
              <div>
                <p className="text-sm text-muted-foreground mb-2 font-medium">Qolgan qism bilan nima qilamiz?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSplitStep2Mode("naqd")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${splitStep2Mode === "naqd" ? "bg-green-500 text-white border-green-500 shadow" : "border-border bg-card text-muted-foreground hover:border-green-400"}`}>
                    💵 Naqd
                  </button>
                  <button onClick={() => setSplitStep2Mode("click")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${splitStep2Mode === "click" ? "bg-blue-500 text-white border-blue-500 shadow" : "border-border bg-card text-muted-foreground hover:border-blue-400"}`}>
                    📲 Click
                  </button>
                  <button onClick={() => setSplitStep2Mode("dokonga")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${splitStep2Mode === "dokonga" ? "bg-orange-500 text-white border-orange-500 shadow" : "border-border bg-card text-muted-foreground hover:border-orange-400"}`}>
                    🏪 Dokonga
                  </button>
                  <button onClick={() => setSplitStep2Mode("qarz")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${splitStep2Mode === "qarz" ? "bg-red-500 text-white border-red-500 shadow" : "border-border bg-card text-muted-foreground hover:border-red-400"}`}>
                    📋 Qarz
                  </button>
                </div>
              </div>

              {/* Qarz bo'lsa ogohlantirish */}
              {splitStep2Mode === "qarz" && (
                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-xs text-red-600 dark:text-red-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Hozirgi qarz:</span>
                    <span className="font-semibold">{clientBalance < 0 ? `−${Math.abs(clientBalance).toLocaleString("uz-UZ")}` : clientBalance.toLocaleString("uz-UZ")} so'm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Qo'shiladi:</span>
                    <span className="font-semibold">−{(Number(paymentOrder?.price) - adParseAmt(splitAmount)).toLocaleString("uz-UZ")} so'm</span>
                  </div>
                  <div className="flex justify-between border-t border-red-200 dark:border-red-800 pt-1">
                    <span className="font-medium">Yangi qarz:</span>
                    <span className="font-bold">{(clientBalance - (Number(paymentOrder?.price) - adParseAmt(splitAmount))).toLocaleString("uz-UZ")} so'm</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ─── 1-QADAM: Asosiy to'lov turi ─── */
            <div className="space-y-4">
              {paymentOrder?.price && (
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 text-sm flex justify-between">
                  <span className="text-amber-700 dark:text-amber-400">Zakaz summasi:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{Math.round(Number(paymentOrder.price)).toLocaleString("uz-UZ")} so'm</span>
                </div>
              )}
              {clientBalanceLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mijoz:</span>
                    <span className="font-semibold">{clientInfo?.name ?? paymentOrder?.clientName ?? "—"}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1">
                    <span className="text-muted-foreground">Joriy holat:</span>
                    <span className={`font-bold tabular-nums ${clientBalance < 0 ? "text-red-500" : clientBalance > 0 ? "text-green-600" : ""}`}>
                      {clientBalance < 0
                        ? `−${Math.abs(clientBalance).toLocaleString("uz-UZ")} so'm qarz`
                        : clientBalance > 0
                          ? `+${clientBalance.toLocaleString("uz-UZ")} so'm`
                          : "0"}
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMode("naqd")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${paymentMode === "naqd" ? "bg-green-500 text-white border-green-500 shadow" : "border-border bg-card text-muted-foreground hover:border-green-400"}`}>
                  💵 Naqd
                </button>
                <button onClick={() => setPaymentMode("click")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${paymentMode === "click" ? "bg-blue-500 text-white border-blue-500 shadow" : "border-border bg-card text-muted-foreground hover:border-blue-400"}`}>
                  📲 Click
                </button>
                <button onClick={() => setPaymentMode("dokonga")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${paymentMode === "dokonga" ? "bg-orange-500 text-white border-orange-500 shadow" : "border-border bg-card text-muted-foreground hover:border-orange-400"}`}>
                  🏪 Dokonga
                </button>
                <button onClick={() => setPaymentMode("qarz")} className={`h-14 rounded-xl font-bold text-sm border-2 transition-all ${paymentMode === "qarz" ? "bg-red-500 text-white border-red-500 shadow" : "border-border bg-card text-muted-foreground hover:border-red-400"}`}>
                  📋 Qarz
                </button>
              </div>
              {paymentMode === "qarz" && paymentOrder?.price && (
                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hozir:</span>
                    <span className={`font-semibold ${clientBalance < 0 ? "text-red-500" : "text-green-600"}`}>{clientBalance >= 0 ? "+" : ""}{clientBalance.toLocaleString("uz-UZ")} so'm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Qarz qo'shiladi:</span>
                    <span className="text-red-500 font-semibold">−{Number(paymentOrder.price).toLocaleString("uz-UZ")} so'm</span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1">
                    <span className="font-medium">Yangi holat:</span>
                    <span className={`font-bold tabular-nums ${(clientBalance - Number(paymentOrder.price)) < 0 ? "text-red-500" : "text-green-600"}`}>
                      {(clientBalance - Number(paymentOrder.price)) >= 0 ? "+" : ""}{(clientBalance - Number(paymentOrder.price)).toLocaleString("uz-UZ")} so'm
                    </span>
                  </div>
                </div>
              )}
              {(paymentMode === "naqd" || paymentMode === "click" || paymentMode === "dokonga") && !splitPayment && (
                <div className={`rounded-lg p-2 text-xs text-center ${paymentMode === "naqd" ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : paymentMode === "click" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400"}`}>
                  {paymentMode === "naqd" ? "💵 Naqd to'lov — qarz hisobiga ta'sir etmaydi" : paymentMode === "click" ? "📲 Click orqali to'lov — qarz hisobiga ta'sir etmaydi" : "🏪 Dokonga beriladi — qarz hisobiga ta'sir etmaydi"}
                </div>
              )}
              {/* Bo'lib to'lash */}
              {paymentMode !== "qarz" && paymentOrder?.price && (
                <div className="border border-border/60 rounded-xl p-3 space-y-2">
                  <button
                    className="w-full flex items-center justify-between text-sm font-medium"
                    onClick={() => { setSplitPayment(v => !v); setSplitAmount(""); }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Split className="w-4 h-4 text-purple-500" />
                      Bo'lib to'lash
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${splitPayment ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"}`}>
                      {splitPayment ? "Yoqilgan" : "O'chirilgan"}
                    </span>
                  </button>
                  {splitPayment && (
                    <div className="space-y-2 pt-1 border-t border-border/40">
                      <div className="text-xs text-muted-foreground">
                        {paymentMode === "naqd" ? "💵 Naqd" : paymentMode === "click" ? "📲 Click" : "🏪 Dokonga"} bilan qancha to'laydi?
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                        placeholder="Summa kiriting"
                        value={splitAmount}
                        onChange={e => setSplitAmount(adFmtAmt(e.target.value))}
                      />
                      {adParseAmt(splitAmount) > 0 && adParseAmt(splitAmount) < Number(paymentOrder.price) && (
                        <div className="text-xs space-y-1 bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Hozir to'lanadi:</span>
                            <span className="font-semibold text-green-600">{splitAmount} so'm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Qolgan qism:</span>
                            <span className="font-semibold text-purple-600">{(Number(paymentOrder.price) - adParseAmt(splitAmount)).toLocaleString("uz-UZ")} so'm</span>
                          </div>
                          <div className="text-purple-500 text-center pt-0.5">→ Keyingi qadamda qolgan qism uchun to'lov turi tanlaysiz</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              if (splitStep2) { setSplitStep2(false); }
              else { resetPaymentModal(); }
            }} disabled={paymentLoading}>
              {splitStep2 ? "← Orqaga" : "Bekor"}
            </Button>
            <Button
              className={`gap-2 ${
                splitStep2
                  ? splitStep2Mode === "qarz" ? "bg-red-500 hover:bg-red-600" : splitStep2Mode === "click" ? "bg-blue-600 hover:bg-blue-700" : splitStep2Mode === "dokonga" ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"
                  : splitPayment ? "bg-purple-600 hover:bg-purple-700" : paymentMode === "qarz" ? "bg-red-500 hover:bg-red-600" : paymentMode === "click" ? "bg-blue-600 hover:bg-blue-700" : paymentMode === "dokonga" ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"
              } text-white`}
              disabled={paymentLoading || clientBalanceLoading}
              onClick={doDeliverWithPayment}
            >
              {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              {splitStep2
                ? "✅ Tasdiqlash"
                : splitPayment
                  ? "Keyingi qadam →"
                  : paymentMode === "qarz" ? "Qarz yozib olib ketildi!" : paymentMode === "click" ? "Click — Olib ketildi!" : paymentMode === "dokonga" ? "Dokonga — Olib ketildi!" : "Olib ketildi!"}
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
