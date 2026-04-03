import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Pencil, Package, GripVertical } from "lucide-react";
import { useGetServiceTypes, getGetServiceTypesQueryKey } from "@workspace/api-client-react";

interface Product {
  id: number;
  name: string;
  serviceTypeId: number;
  sortOrder: number;
  active: boolean;
}

interface ProductsViewProps {
  storeId?: number;
}

export default function ProductsView({ storeId }: ProductsViewProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: allServiceTypes } = useGetServiceTypes({ query: { queryKey: getGetServiceTypesQueryKey() } });

  const serviceTypes = storeId
    ? (allServiceTypes ?? []).filter(s => s.storeId === storeId || s.storeId === null)
    : (allServiceTypes ?? []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterServiceTypeId, setFilterServiceTypeId] = useState<string>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addServiceTypeId, setAddServiceTypeId] = useState<string>("");
  const [addSortOrder, setAddSortOrder] = useState("0");
  const [adding, setAdding] = useState(false);

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [editActive, setEditActive] = useState(true);
  const [editing, setEditing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = filterServiceTypeId !== "all"
        ? `/api/products?serviceTypeId=${filterServiceTypeId}`
        : `/api/products`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Xatolik", description: "Mahsulotlarni yuklab bo'lmadi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [token, filterServiceTypeId]);

  const handleAdd = async () => {
    if (!addName.trim() || !addServiceTypeId) {
      toast({ title: "Nom va xizmat turi kerak", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: addName.trim(), serviceTypeId: Number(addServiceTypeId), sortOrder: Number(addSortOrder) }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "✅ Mahsulot qo'shildi" });
      setAddOpen(false);
      setAddName(""); setAddServiceTypeId(""); setAddSortOrder("0");
      fetchProducts();
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditName(p.name);
    setEditSortOrder(String(p.sortOrder));
    setEditActive(p.active);
  };

  const handleEdit = async () => {
    if (!editProduct) return;
    setEditing(true);
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName.trim(), sortOrder: Number(editSortOrder), active: editActive }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "✅ Saqlandi" });
      setEditProduct(null);
      fetchProducts();
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: "✅ O'chirildi" });
      setDeleteTarget(null);
      fetchProducts();
    } catch {
      toast({ title: "Xatolik", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const grouped: Record<number, { typeName: string; items: Product[] }> = {};
  for (const p of products) {
    const st = serviceTypes.find(s => s.id === p.serviceTypeId);
    if (!grouped[p.serviceTypeId]) {
      grouped[p.serviceTypeId] = { typeName: st?.name ?? `Xizmat #${p.serviceTypeId}`, items: [] };
    }
    grouped[p.serviceTypeId].items.push(p);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Mahsulotlar
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} ta mahsulot</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterServiceTypeId} onValueChange={setFilterServiceTypeId}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha xizmatlar</SelectItem>
              {serviceTypes.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => { setAddOpen(true); if (filterServiceTypeId !== "all") setAddServiceTypeId(filterServiceTypeId); }}>
            <Plus className="w-4 h-4" />
            Qo'shish
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <div className="text-center p-16 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div className="font-medium">Mahsulotlar yo'q</div>
          <div className="text-sm mt-1">Yangi mahsulot qo'shing</div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([stId, { typeName, items }]) => (
            <Card key={stId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  {typeName}
                  <Badge variant="secondary" className="ml-auto text-xs">{items.length} ta</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {items.sort((a, b) => a.sortOrder - b.sortOrder).map(p => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        p.active ? "bg-card" : "bg-muted/50 opacity-60"
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground" />
                      <span>{p.name}</span>
                      {!p.active && <span className="text-xs text-muted-foreground">(o'chirilgan)</span>}
                      <div className="flex gap-1 ml-1">
                        <button onClick={() => openEdit(p)} className="text-primary hover:text-primary/80 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="text-destructive hover:text-destructive/80 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Mahsulot qo'shish</DialogTitle>
            <DialogDescription>Xizmat turiga mahsulot qo'shing</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Xizmat turi *</Label>
              <Select value={addServiceTypeId} onValueChange={setAddServiceTypeId}>
                <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mahsulot nomi *</Label>
              <Input placeholder="Masalan: Balonli kardon" value={addName} onChange={e => setAddName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tartib raqami</Label>
              <Input type="number" value={addSortOrder} onChange={e => setAddSortOrder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Qo'shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Mahsulotni tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mahsulot nomi</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tartib raqami</Label>
              <Input type="number" value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Label>Faol</Label>
              <button
                type="button"
                onClick={() => setEditActive(!editActive)}
                className={`relative w-11 h-6 rounded-full transition-colors ${editActive ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>Bekor qilish</Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2"><Trash2 className="w-4 h-4" /> O'chirish</DialogTitle>
            <DialogDescription>
              "<span className="font-semibold">{deleteTarget?.name}</span>" mahsulotini o'chirmoqchisiz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Bekor qilish</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              O'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
