import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { useSocket } from "@/hooks/useSocket";
import { useGetOrders, useUpdateOrderStatus, getGetOrdersQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/OrderCard";
import { Search, Loader2, X, QrCode, Clock, CheckCircle, Package, Hash, User, Phone, FileText, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
          {/* Status */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusInfo.color}`}>
            {order.status === 'new' && <Clock className="w-4 h-4" />}
            {order.status === 'accepted' && <Package className="w-4 h-4" />}
            {order.status === 'ready' && <CheckCircle className="w-4 h-4" />}
            {statusInfo.label}
          </div>

          {/* Main info */}
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

          {/* Client info */}
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

          {/* Notes */}
          {order.notes && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <FileText className="w-3.5 h-3.5" />
                Izoh
              </div>
              <p className="text-sm italic">{order.notes}</p>
            </div>
          )}

          {/* Timeline */}
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

          {/* Store & worker info */}
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="w-3.5 h-3.5" />
              <span>{order.storeName}</span>
            </div>
            <span className="text-muted-foreground">{order.createdByName}</span>
          </div>

          {/* QR Code */}
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

export default function WorkerDashboard() {
  const { accountName, storeId, accountId, clearPinAuth, token } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("new");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useSocket(token, storeId);

  const handleTimeout = useCallback(() => {
    clearPinAuth();
    setLocation("/pin");
  }, [clearPinAuth, setLocation]);

  const { secondsLeft } = useInactivityTimer(15, handleTimeout);

  const { data: newOrders, isLoading: isNewLoading } = useGetOrders({ status: "new", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "new", storeId: storeId! }), refetchInterval: 30000 } });
  const { data: acceptedOrders, isLoading: isAcceptedLoading } = useGetOrders({ status: "accepted", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "accepted", storeId: storeId! }), refetchInterval: 30000 } });
  const { data: readyOrders, isLoading: isReadyLoading } = useGetOrders({ status: "ready", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "ready", storeId: storeId! }), refetchInterval: 30000 } });
  const { data: historyOrders, isLoading: isHistoryLoading } = useGetOrders({ storeId: storeId!, date }, { query: { queryKey: getGetOrdersQueryKey({ storeId: storeId!, date }), refetchInterval: 30000 } });

  const updateStatus = useUpdateOrderStatus();

  const handleStatusUpdate = (orderId: number, status: "accepted" | "ready") => {
    updateStatus.mutate(
      { id: orderId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Holat yangilandi" });
          queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
        },
        onError: () => {
          toast({ title: "Xatolik", variant: "destructive" });
        }
      }
    );
  };

  const myAcceptedOrders = acceptedOrders?.filter(o => o.acceptedByName === accountName) || [];

  const filterBySearch = (orders: any[] | undefined) => {
    if (!orders) return [];
    if (!search.trim()) return orders;
    const s = search.toLowerCase();
    return orders.filter(o => 
      o.orderId.toLowerCase().includes(s) ||
      o.serviceTypeName.toLowerCase().includes(s) ||
      (o.clientName && o.clientName.toLowerCase().includes(s)) ||
      (o.clientPhone && o.clientPhone.includes(s)) ||
      (o.notes && o.notes.toLowerCase().includes(s)) ||
      (o.shelf && o.shelf.toLowerCase().includes(s)) ||
      String(o.quantity).includes(s) ||
      (o.unit && o.unit.toLowerCase().includes(s)) ||
      format(new Date(o.createdAt), "HH:mm").includes(s) ||
      format(new Date(o.createdAt), "dd.MM.yyyy").includes(s)
    );
  };

  const renderList = (orders: any[] | undefined, isLoading: boolean, actionLabel?: string, actionStatus?: "accepted" | "ready") => {
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
              actionLabel && actionStatus ? (
                <Button 
                  className="w-full h-12 text-lg font-bold" 
                  variant={actionStatus === 'accepted' ? 'default' : 'secondary'}
                  onClick={() => handleStatusUpdate(order.id, actionStatus)}
                  disabled={updateStatus.isPending}
                >
                  {actionLabel}
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <Header 
        title={`Ishchi: ${accountName}`} 
        showLogout={true} 
        onLogout={() => {
          clearPinAuth();
          setLocation("/pin");
        }}
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
        {activeTab === "new" && renderList(newOrders, isNewLoading, "QABUL QILISH", "accepted")}
        {activeTab === "accepted" && renderList(myAcceptedOrders, isAcceptedLoading, "TAYYOR", "ready")}
        {activeTab === "ready" && renderList(readyOrders, isReadyLoading)}
        {activeTab === "history" && renderList(historyOrders, isHistoryLoading)}
      </div>

      <OrderDetailModal
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
