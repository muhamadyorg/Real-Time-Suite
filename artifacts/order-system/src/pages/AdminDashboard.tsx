import { useState } from "react";
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
import { Search, Loader2, Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

function CreateOrderSheet({ storeId }: { storeId: number }) {
  const [open, setOpen] = useState(false);
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
          setOpen(false);
          resetForm();
        },
        onError: (err) => {
          toast({ title: "Xatolik", description: err.data?.error || "Xatolik yuz berdi", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="lg" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl transition-all p-0 z-50">
          <Plus className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full bg-background border-l">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-2xl font-bold">Yangi Zakaz</SheetTitle>
          <SheetDescription>Mijoz uchun yangi buyurtma yarating</SheetDescription>
        </SheetHeader>
        
        <form onSubmit={onSubmit} className="flex-1 flex flex-col h-full overflow-hidden">
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-6">
              
              <div className="space-y-2">
                <Label htmlFor="service">Xizmat turi *</Label>
                <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                  <SelectTrigger id="service" className="h-12 bg-card">
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
                  <Label htmlFor="quantity">Soni *</Label>
                  <Input 
                    id="quantity" 
                    type="number" 
                    min="1"
                    value={quantity} 
                    onChange={e => setQuantity(e.target.value)} 
                    className="h-12 bg-card font-semibold text-lg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">O'lchov birligi</Label>
                  <Input 
                    id="unit" 
                    placeholder="dona, m2..." 
                    value={unit} 
                    onChange={e => setUnit(e.target.value)} 
                    className="h-12 bg-card"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shelf">Polka (joylashuv)</Label>
                <Input 
                  id="shelf" 
                  placeholder="Masalan: A-12" 
                  value={shelf} 
                  onChange={e => setShelf(e.target.value)} 
                  className="h-12 bg-card font-mono"
                />
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Mijoz malumotlari</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="manual-client" className="text-xs text-muted-foreground cursor-pointer">Qo'lda kiritish</Label>
                    <Switch id="manual-client" checked={isClientManual} onCheckedChange={setIsClientManual} />
                  </div>
                </div>

                {!isClientManual ? (
                  <div className="space-y-2">
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger className="h-12 bg-card">
                        <SelectValue placeholder="Ro'yxatdan mijoz tanlang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName} ({c.phone})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">Ism / Familiya</Label>
                      <Input 
                        id="clientName" 
                        placeholder="Mijoz ismi..." 
                        value={clientName} 
                        onChange={e => setClientName(e.target.value)} 
                        className="h-12 bg-card"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientPhone">Telefon raqam</Label>
                      <Input 
                        id="clientPhone" 
                        placeholder="+998..." 
                        value={clientPhone} 
                        onChange={e => setClientPhone(e.target.value)} 
                        className="h-12 bg-card"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Qo'shimcha izoh</Label>
                <Input 
                  id="notes" 
                  placeholder="Buyurtma haqida izoh..." 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="h-12 bg-card"
                />
              </div>

            </div>
          </ScrollArea>
          
          <SheetFooter className="pt-4 mt-auto border-t">
            <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" disabled={createOrder.isPending}>
              {createOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              SAQLASH
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminDashboard({ hideHeader = false }: { hideHeader?: boolean }) {
  const { accountName, storeId, role } = useAuth();
  const [activeTab, setActiveTab] = useState("new");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const isViewer = role === 'viewer';

  useSocket();

  const { data: summary } = useGetOrdersSummary({ query: { queryKey: ["getOrdersSummary"] } });
  
  const { data: newOrders, isLoading: isNewLoading } = useGetOrders({ status: "new", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "new", storeId: storeId! }) } });
  const { data: acceptedOrders, isLoading: isAcceptedLoading } = useGetOrders({ status: "accepted", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "accepted", storeId: storeId! }) } });
  const { data: readyOrders, isLoading: isReadyLoading } = useGetOrders({ status: "ready", storeId: storeId! }, { query: { queryKey: getGetOrdersQueryKey({ status: "ready", storeId: storeId! }) } });
  const { data: historyOrders, isLoading: isHistoryLoading } = useGetOrders({ storeId: storeId!, date }, { query: { queryKey: getGetOrdersQueryKey({ storeId: storeId!, date }) } });

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

  const renderList = (orders: any[] | undefined, isLoading: boolean) => {
    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    const filtered = filterBySearch(orders);
    if (!filtered.length) return <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl mt-4 border border-dashed">Malumot topilmadi</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-4">
        {filtered.map(order => (
          <OrderCard key={order.id} order={order} search={search} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      {!hideHeader && <Header title={`${isViewer ? 'Kuzatuvchi' : 'Admin'}: ${accountName}`} showLogout={true} />}
      
      {summary && (
        <div className="grid grid-cols-4 gap-2 p-4 pb-0">
          <div className="bg-chart-1/10 text-chart-1 rounded-lg p-3 text-center border border-chart-1/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.new}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider">Yangi</div>
          </div>
          <div className="bg-chart-4/10 text-chart-4 rounded-lg p-3 text-center border border-chart-4/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.accepted}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider">Qabul</div>
          </div>
          <div className="bg-chart-3/10 text-chart-3 rounded-lg p-3 text-center border border-chart-3/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.ready}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider">Tayyor</div>
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-3 text-center border border-primary/20 shadow-sm">
            <div className="text-2xl font-bold">{summary.totalToday}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider">Jami(Bugun)</div>
          </div>
        </div>
      )}

      <div className="p-4 sticky top-[60px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full h-14 bg-muted/50 p-1">
            <TabsTrigger value="new" className="text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">YANGI</TabsTrigger>
            <TabsTrigger value="accepted" className="text-sm font-semibold h-full data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary">QABUL</TabsTrigger>
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
        {activeTab === "new" && renderList(newOrders, isNewLoading)}
        {activeTab === "accepted" && renderList(acceptedOrders, isAcceptedLoading)}
        {activeTab === "ready" && renderList(readyOrders, isReadyLoading)}
        {activeTab === "history" && renderList(historyOrders, isHistoryLoading)}
      </div>

      {!isViewer && <CreateOrderSheet storeId={storeId!} />}
    </div>
  );
}
