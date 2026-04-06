import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { useSocket } from "@/hooks/useSocket";
import {
  useGetOrders, useUpdateOrderStatus, getGetOrdersQueryKey,
  useCreateOrder, useGetServiceTypes, useGetClients
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/OrderCard";
import { PrintLabelButton } from "@/components/PrintLabelButton";
import { Search, Loader2, X, QrCode, Clock, CheckCircle, Package, Hash, User, Phone, FileText, Building2, Plus, Users, Lock, Split } from "lucide-react";
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
          <PrintLabelButton order={order} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    return (c.firstName + " " + c.lastName).toLowerCase().includes(s) || (c.phone ?? "").toLowerCase().includes(s);
  });

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
              placeholder="Ism yoki telefon..."
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
                onClick={() => { onChange(c.id.toString(), c.firstName + " " + c.lastName, c.phone); setQ(""); setOpen(false); }}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {c.firstName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{c.firstName} {c.lastName}</div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateOrderDialog({ storeId, workerServiceTypeId, open, onOpenChange }: {
  storeId: number;
  workerServiceTypeId?: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { token } = useAuth();
  const [serviceTypeId, setServiceTypeId] = useState<string>(workerServiceTypeId ? String(workerServiceTypeId) : "");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [shelf, setShelf] = useState("");
  const [product, setProduct] = useState("");
  const [notes, setNotes] = useState("");
  const [isClientManual, setIsClientManual] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [products, setProducts] = useState<any[]>([]);

  const { data: serviceTypes } = useGetServiceTypes({ query: { queryKey: ["getServiceTypes", storeId] } });
  const { data: clients } = useGetClients({ status: 'approved' }, { query: { queryKey: ["getClients", { status: 'approved' }] } });
  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const workerServiceType = serviceTypes?.find(st => st.id === workerServiceTypeId);

  const activeServiceTypeId = workerServiceTypeId ? String(workerServiceTypeId) : serviceTypeId;

  useEffect(() => {
    setProduct("");
    if (!activeServiceTypeId || !token) { setProducts([]); return; }
    fetch(`/api/products?serviceTypeId=${activeServiceTypeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data.filter((p: any) => p.active) : [])).catch(() => setProducts([]));
  }, [activeServiceTypeId, token]);

  const resetForm = () => {
    setServiceTypeId(workerServiceTypeId ? String(workerServiceTypeId) : "");
    setQuantity("1"); setUnit(""); setShelf(""); setProduct(""); setNotes("");
    setIsClientManual(false); setClientId(""); setClientName(""); setClientPhone("");
    setProducts([]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalServiceTypeId = workerServiceTypeId ? workerServiceTypeId : Number(serviceTypeId);
    if (!finalServiceTypeId) {
      toast({ title: "Xatolik", description: "Xizmat turi aniqlanmadi", variant: "destructive" });
      return;
    }
    createOrder.mutate(
      {
        data: {
          serviceTypeId: finalServiceTypeId,
          quantity: Number(quantity),
          unit: unit || null,
          shelf: shelf || null,
          product: product || null,
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
          <DialogDescription className="text-sm text-muted-foreground">
            {workerServiceType ? `Bo'lim: ${workerServiceType.name}` : "Mijoz uchun yangi buyurtma"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-5 px-6 py-5">
              {workerServiceType ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <div className="text-sm text-muted-foreground">Xizmat turi</div>
                  <div className="font-bold text-primary text-lg">{workerServiceType.name}</div>
                </div>
              ) : (
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
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Soni *</Label>
                  <Input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-12 bg-card font-semibold text-lg" required />
                </div>
                <div className="space-y-2">
                  <Label>O'lchov</Label>
                  <Input placeholder="dona, m2..." value={unit} onChange={e => setUnit(e.target.value)} className="h-12 bg-card" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Qolib (joylashuv)</Label>
                <Input placeholder="Masalan: A-12" value={shelf} onChange={e => setShelf(e.target.value)} className="h-12 bg-card font-mono" />
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Mahsulot
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {products.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProduct(product === p.name ? "" : p.name)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          product === p.name
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {product && (
                    <div className="text-xs text-muted-foreground">Tanlangan: <span className="font-semibold text-primary">{product}</span></div>
                  )}
                </div>
              )}

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
                    <Input placeholder="Ism / Familiya" value={clientName} onChange={e => setClientName(e.target.value)} className="h-12 bg-card" />
                    <Input placeholder="+998..." value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="h-12 bg-card" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Qo'shimcha izoh</Label>
                <Input placeholder="Buyurtma haqida izoh..." value={notes} onChange={e => setNotes(e.target.value)} className="h-12 bg-card" />
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

function LockPinModal({ order, open, onClose, onConfirm, isPending }: {
  order: any;
  open: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  isPending: boolean;
}) {
  const [pin, setPin] = useState("");
  const { toast } = useToast();
  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-xs mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" />
            Qulfli zakaz
          </DialogTitle>
          <DialogDescription>
            Bu zakaz qullflangan. Qabul qilish uchun 4 ta raqamli qulf PIN kodini kiriting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
            Zakaz #{order.orderId} qabul qilish uchun admindan PIN kodni so'rang
          </div>
          <Input
            type="tel"
            placeholder="4 ta raqam"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            className="h-12 text-center text-2xl font-mono tracking-widest"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor</Button>
          <Button
            onClick={() => {
              if (pin.length !== 4) {
                toast({ title: "4 ta raqam kiriting", variant: "destructive" });
                return;
              }
              onConfirm(pin);
            }}
            disabled={isPending || pin.length !== 4}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Qabul qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkerDashboard() {
  const { accountName, storeId, accountId, serviceTypeId: workerServiceTypeId, clearPinAuth, token } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("new");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lockPinOrder, setLockPinOrder] = useState<any>(null);
  const [splitOrder, setSplitOrder] = useState<any>(null);
  const [splitQty, setSplitQty] = useState("");
  const [splitLockPin, setSplitLockPin] = useState("");
  const [splitPending, setSplitPending] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useSocket(token, storeId);

  const handleTimeout = useCallback(() => {
    clearPinAuth();
    setLocation("/pin");
  }, [clearPinAuth, setLocation]);

  const { secondsLeft } = useInactivityTimer(15, handleTimeout);

  const { data: newOrders, isLoading: isNewLoading } = useGetOrders({ status: "new", storeId: storeId! }, { query: { queryKey: [...getGetOrdersQueryKey({ status: "new", storeId: storeId! }), accountId], refetchInterval: 60000, enabled: !!storeId && !!accountId } });
  const { data: acceptedOrders, isLoading: isAcceptedLoading } = useGetOrders({ status: "accepted", storeId: storeId! }, { query: { queryKey: [...getGetOrdersQueryKey({ status: "accepted", storeId: storeId! }), accountId], refetchInterval: 60000, enabled: !!storeId && !!accountId } });
  const { data: readyOrders, isLoading: isReadyLoading } = useGetOrders({ status: "ready", storeId: storeId! }, { query: { queryKey: [...getGetOrdersQueryKey({ status: "ready", storeId: storeId! }), accountId], refetchInterval: 60000, enabled: !!storeId && !!accountId } });
  const { data: historyOrders, isLoading: isHistoryLoading } = useGetOrders({ storeId: storeId!, date }, { query: { queryKey: [...getGetOrdersQueryKey({ storeId: storeId!, date }), accountId], refetchInterval: 60000, enabled: !!storeId && !!accountId } });

  const updateStatus = useUpdateOrderStatus();

  const handleAccept = (order: any) => {
    const isCreator = order.createdById === accountId;
    if (order.isLocked && !isCreator) {
      setLockPinOrder(order);
      return;
    }
    doAccept(order.id, undefined);
  };

  const doAccept = (orderId: number, lockPin?: string) => {
    updateStatus.mutate(
      { id: orderId, data: { status: "accepted", lockPin } as any },
      {
        onSuccess: () => {
          toast({ title: "Qabul qilindi!" });
          queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
          setLockPinOrder(null);
        },
        onError: (err: any) => {
          toast({ title: "Xatolik", description: err.data?.error || "Xatolik", variant: "destructive" });
          setLockPinOrder(null);
        }
      }
    );
  };

  const handleReady = (orderId: number) => {
    updateStatus.mutate(
      { id: orderId, data: { status: "ready" } },
      {
        onSuccess: () => {
          toast({ title: "Tayyor deb belgilandi!" });
          queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
        },
        onError: () => toast({ title: "Xatolik", variant: "destructive" })
      }
    );
  };

  const openSplit = (order: any) => {
    setSplitOrder(order);
    setSplitQty("");
    setSplitLockPin("");
  };

  const doSplit = async () => {
    if (!splitOrder) return;
    const qty = parseFloat(splitQty);
    if (!qty || qty <= 0) {
      toast({ title: "Miqdor noto'g'ri", variant: "destructive" });
      return;
    }
    if (qty >= parseFloat(splitOrder.quantity)) {
      toast({ title: "Miqdor umumiy miqdordan kam bo'lishi kerak", variant: "destructive" });
      return;
    }
    setSplitPending(true);
    try {
      const body: any = { quantity: qty };
      const isCreator = splitOrder.createdById === accountId;
      if (splitOrder.isLocked && !isCreator) {
        if (!splitLockPin || splitLockPin.length !== 4) {
          toast({ title: "4 ta raqamli qulf PIN kiriting", variant: "destructive" });
          setSplitPending(false);
          return;
        }
        body.lockPin = splitLockPin;
      }
      const res = await fetch(`/api/orders/${splitOrder.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Xatolik", description: data.error || "Xatolik", variant: "destructive" });
        return;
      }
      toast({ title: "Bo'lib qabul qilindi!", description: `Siz: ${qty}, Qoldi: ${parseFloat(splitOrder.quantity) - qty} ${splitOrder.unit || ""}` });
      queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
      setSplitOrder(null);
    } catch {
      toast({ title: "Tarmoq xatosi", variant: "destructive" });
    } finally {
      setSplitPending(false);
    }
  };

  const myAcceptedOrders = acceptedOrders?.filter(o => o.acceptedById === accountId) || [];

  const filterBySearch = (orders: any[] | undefined) => {
    if (!orders) return [];
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

  const renderNewOrders = (orders: any[] | undefined, isLoading: boolean) => {
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    const filtered = filterBySearch(orders);
    if (!filtered.length) return <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl mt-4 border border-dashed">Malumot topilmadi</div>;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {filtered.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            search={search}
            onOrderClick={() => setSelectedOrder(order)}
            actionButton={
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-12 text-base font-bold"
                  variant="default"
                  onClick={() => handleAccept(order)}
                  disabled={updateStatus.isPending}
                >
                  {order.isLocked ? <><Lock className="w-4 h-4 mr-1.5" />QABUL</> : "QABUL QILISH"}
                </Button>
                <Button
                  className="h-12 px-3 font-semibold text-xs border-dashed"
                  variant="outline"
                  onClick={() => openSplit(order)}
                  disabled={updateStatus.isPending}
                  title="Bo'lib qabul qilish"
                >
                  <Split className="w-4 h-4" />
                </Button>
              </div>
            }
          />
        ))}
      </div>
    );
  };

  const renderAcceptedOrders = (orders: any[] | undefined, isLoading: boolean) => {
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    const filtered = filterBySearch(orders);
    if (!filtered.length) return <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl mt-4 border border-dashed">Malumot topilmadi</div>;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {filtered.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            search={search}
            onOrderClick={() => setSelectedOrder(order)}
            actionButton={
              <Button
                className="w-full h-12 text-lg font-bold"
                variant="secondary"
                onClick={() => handleReady(order.id)}
                disabled={updateStatus.isPending}
              >
                TAYYOR
              </Button>
            }
          />
        ))}
      </div>
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
    <div className="min-h-screen bg-muted/20 pb-20">
      <Header
        title={`Ishchi: ${accountName}`}
        showLogout={true}
        onLogout={() => { clearPinAuth(); setLocation("/pin"); }}
        rightContent={
          <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full shadow-sm border text-sm font-medium mr-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
            </span>
            {secondsLeft}s
          </div>
        }
      />

      <div className="p-4 sticky top-[56px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-12 bg-muted/50 p-1">
            <TabsTrigger value="new" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              YANGI
              {newOrders && newOrders.length > 0 && <span className="ml-1.5 bg-destructive text-white px-1.5 py-0.5 rounded-full text-xs">{newOrders.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="accepted" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              QABUL
              {myAcceptedOrders.length > 0 && <span className="ml-1.5 bg-accent text-white px-1.5 py-0.5 rounded-full text-xs">{myAcceptedOrders.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TAYYOR</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TARIX</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Id, mijoz, miqdor, soat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 text-sm bg-card shadow-sm border-muted-foreground/20 focus-visible:ring-primary/50 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
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
        {activeTab === "new" && renderNewOrders(newOrders, isNewLoading)}
        {activeTab === "accepted" && renderAcceptedOrders(myAcceptedOrders, isAcceptedLoading)}
        {activeTab === "ready" && renderList(readyOrders, isReadyLoading)}
        {activeTab === "history" && renderList(historyOrders, isHistoryLoading)}
      </div>

      {/* + button for creating orders */}
      {workerServiceTypeId && (
        <>
          <button
            onClick={() => setCreateOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-primary text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex flex-col items-center justify-center z-50 gap-0.5"
          >
            <Plus className="w-7 h-7" />
            <span className="text-[9px] font-bold uppercase tracking-wide leading-none">Zakaz</span>
          </button>
          <CreateOrderDialog
            storeId={storeId!}
            workerServiceTypeId={workerServiceTypeId}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
        </>
      )}

      <OrderDetailModal order={selectedOrder} open={!!selectedOrder} onClose={() => setSelectedOrder(null)} />

      <LockPinModal
        order={lockPinOrder}
        open={!!lockPinOrder}
        onClose={() => setLockPinOrder(null)}
        onConfirm={(pin) => doAccept(lockPinOrder.id, pin)}
        isPending={updateStatus.isPending}
      />

      {/* Bo'lib qabul qilish dialog */}
      <Dialog open={!!splitOrder} onOpenChange={(v) => { if (!v) setSplitOrder(null); }}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Split className="w-5 h-5 text-primary" />
              Bo'lib qabul qilish
            </DialogTitle>
            <DialogDescription>
              Zakazning bir qismini qabul qiling. Qolgan qismi yangi zakaz sifatida qoladi.
            </DialogDescription>
          </DialogHeader>
          {splitOrder && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zakaz</span>
                  <span className="font-mono font-bold">{splitOrder.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Umumiy miqdor</span>
                  <span className="font-bold text-lg">{splitOrder.quantity}{splitOrder.unit ? ` ${splitOrder.unit}` : ""}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Siz qabul qiladigan miqdor</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder={`1 dan ${parseFloat(splitOrder.quantity) - 0.01} gacha`}
                  value={splitQty}
                  onChange={e => setSplitQty(e.target.value)}
                  className="h-12 text-xl font-bold text-center"
                  autoFocus
                />
                {splitQty && parseFloat(splitQty) > 0 && parseFloat(splitQty) < parseFloat(splitOrder.quantity) && (
                  <div className="text-xs text-muted-foreground flex justify-between px-1">
                    <span>Siz: <span className="font-semibold text-primary">{splitQty} {splitOrder.unit || ""}</span></span>
                    <span>Qoladi: <span className="font-semibold text-amber-600">{(parseFloat(splitOrder.quantity) - parseFloat(splitQty)).toFixed(2).replace(/\.?0+$/, "")} {splitOrder.unit || ""}</span></span>
                  </div>
                )}
              </div>

              {splitOrder.isLocked && splitOrder.createdById !== accountId && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-500" />
                    Qulf PIN kodi
                  </Label>
                  <Input
                    type="tel"
                    placeholder="4 ta raqam"
                    value={splitLockPin}
                    onChange={e => setSplitLockPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    className="h-12 text-center text-2xl font-mono tracking-widest"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitOrder(null)}>Bekor</Button>
            <Button
              onClick={doSplit}
              disabled={splitPending || !splitQty || parseFloat(splitQty) <= 0}
              className="gap-2"
            >
              {splitPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
              Bo'lib ol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
