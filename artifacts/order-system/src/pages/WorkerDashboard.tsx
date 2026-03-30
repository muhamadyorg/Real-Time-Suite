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
import { Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function WorkerDashboard() {
  const { accountName, storeId, accountId, clearPinAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("new");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useSocket(); // Setup real-time listeners

  const handleTimeout = useCallback(() => {
    clearPinAuth();
    setLocation("/pin");
  }, [clearPinAuth, setLocation]);

  const { secondsLeft } = useInactivityTimer(15, handleTimeout);

  const { data: newOrders, isLoading: isNewLoading } = useGetOrders({ status: "new", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "new", storeId: storeId! }) } });
  const { data: acceptedOrders, isLoading: isAcceptedLoading } = useGetOrders({ status: "accepted", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "accepted", storeId: storeId! }) } });
  const { data: readyOrders, isLoading: isReadyLoading } = useGetOrders({ status: "ready", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "ready", storeId: storeId! }) } });
  const { data: historyOrders, isLoading: isHistoryLoading } = useGetOrders({ storeId: storeId!, date }, { query: { queryKey: getGetOrdersQueryKey({ storeId: storeId!, date }) } });

  const updateStatus = useUpdateOrderStatus();

  const handleStatusUpdate = (orderId: number, status: "accepted" | "ready") => {
    updateStatus.mutate(
      { id: orderId, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Holat yangilandi", description: `Zakaz holati ${status} qilib belgilandi.` });
          queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
        },
        onError: () => {
          toast({ title: "Xatolik", description: "Holatni yangilashda xatolik yuz berdi", variant: "destructive" });
        }
      }
    );
  };

  const myAcceptedOrders = acceptedOrders?.filter(o => o.acceptedByName === accountName) || [];

  const filterBySearch = (orders: any[] | undefined) => {
    if (!orders) return [];
    if (!search) return orders;
    const s = search.toLowerCase();
    return orders.filter(o => 
      o.orderId.toLowerCase().includes(s) || 
      o.serviceTypeName.toLowerCase().includes(s) || 
      (o.clientName && o.clientName.toLowerCase().includes(s)) ||
      (o.notes && o.notes.toLowerCase().includes(s)) ||
      (o.shelf && o.shelf.toLowerCase().includes(s))
    );
  };

  const renderList = (orders: any[] | undefined, isLoading: boolean, actionLabel?: string, actionStatus?: "accepted" | "ready") => {
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    const filtered = filterBySearch(orders);
    if (!filtered.length) return <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl mt-4 border border-dashed">Malumot topilmadi</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-4">
        {filtered.map(order => (
          <OrderCard 
            key={order.id} 
            order={order} 
            search={search}
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
      
      <div className="p-4 sticky top-[60px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-14 bg-muted/50 p-1">
            <TabsTrigger value="new" className="text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              YANGI
              {newOrders && newOrders.length > 0 && <span className="ml-2 bg-destructive text-white px-2 py-0.5 rounded-full text-xs">{newOrders.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="accepted" className="text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">
              QABUL
              {myAcceptedOrders.length > 0 && <span className="ml-2 bg-accent text-white px-2 py-0.5 rounded-full text-xs">{myAcceptedOrders.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TAYYOR</TabsTrigger>
            <TabsTrigger value="history" className="text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">TARIX</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Qidirish (id, mijoz, xizmat)..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 text-base bg-card shadow-sm border-muted-foreground/20 focus-visible:ring-primary/50 transition-all"
            />
          </div>
          {activeTab === "history" && (
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-[150px] h-12 bg-card shadow-sm border-muted-foreground/20"
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
    </div>
  );
}
