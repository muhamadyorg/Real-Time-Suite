import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Eye, EyeOff, Star, GripVertical, FileText } from "lucide-react";

export const ALL_FIELD_KEYS = [
  { key: "serviceType",      defaultLabel: "Xizmat turi",          alwaysVisible: true },
  { key: "client",           defaultLabel: "Mijoz" },
  { key: "product",          defaultLabel: "Mahsulot" },
  { key: "quantity",         defaultLabel: "Soni" },
  { key: "unit",             defaultLabel: "O'lchov birligi" },
  { key: "shelf",            defaultLabel: "Joylashuv (qolib)" },
  { key: "notes",            defaultLabel: "Izoh" },
  { key: "requireOutputQty", defaultLabel: "Chiqish miqdori belgisi" },
];

export const DEFAULT_FIELDS = ALL_FIELD_KEYS.map(f => ({
  key: f.key,
  label: f.defaultLabel,
  required: f.key === "serviceType" || f.key === "quantity",
  visible: true,
}));

interface Field { key: string; label: string; required: boolean; visible: boolean; }
interface Template { id: number; storeId: number; name: string; fields: Field[]; }
interface ServiceType { id: number; name: string; templateId?: number | null; }

function FieldEditor({ fields, onChange }: { fields: Field[]; onChange: (f: Field[]) => void }) {
  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...fields];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    onChange(arr);
  };
  const update = (idx: number, patch: Partial<Field>) => {
    const arr = [...fields];
    arr[idx] = { ...arr[idx], ...patch };
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">Maydonlarni tartiblashtiring va sozlang:</p>
      {fields.map((f, i) => {
        const meta = ALL_FIELD_KEYS.find(m => m.key === f.key);
        return (
          <div key={f.key} className={`flex items-center gap-2 p-3 rounded-xl border bg-card transition-all ${!f.visible ? "opacity-50" : ""}`}>
            <div className="flex flex-col gap-0.5 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <Input
              value={f.label}
              onChange={e => update(i, { label: e.target.value })}
              className="h-8 text-sm flex-1 min-w-0"
              placeholder="Maydon nomi..."
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title={f.required ? "Majburiy" : "Ixtiyoriy"}
                onClick={() => update(i, { required: !f.required })}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${f.required ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >*</button>
              <button
                type="button"
                title={f.visible ? "Ko'rinadigan" : "Yashirin"}
                onClick={() => { if (!meta?.alwaysVisible) update(i, { visible: !f.visible }); }}
                disabled={!!meta?.alwaysVisible}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${f.visible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} disabled:cursor-not-allowed`}
              >
                {f.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TemplatesView({ storeId, token }: { storeId: number; token: string | null }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTmpl, setEditTmpl] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editName, setEditName] = useState("");
  const [editFields, setEditFields] = useState<Field[]>([]);
  const [editAssigned, setEditAssigned] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [tmplRes, stRes] = await Promise.all([
        fetch(`${apiBase}/api/order-templates`, { headers }),
        fetch(`${apiBase}/api/service-types`, { headers }),
      ]);
      const tmpls = await tmplRes.json();
      const sts = await stRes.json();
      setTemplates(Array.isArray(tmpls) ? tmpls : []);
      setServiceTypes(Array.isArray(sts) ? sts.filter((s: any) => s.storeId === storeId) : []);
    } catch { toast({ variant: "destructive", title: "Yuklanmadi" }); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [storeId]);

  const openNew = () => {
    setIsNew(true);
    setEditTmpl(null);
    setEditName("Yangi shablon");
    setEditFields(DEFAULT_FIELDS.map(f => ({ ...f })));
    setEditAssigned([]);
  };

  const openEdit = (tmpl: Template) => {
    setIsNew(false);
    setEditTmpl(tmpl);
    setEditName(tmpl.name);
    const existingKeys = new Set(tmpl.fields.map(f => f.key));
    const merged = [
      ...tmpl.fields,
      ...DEFAULT_FIELDS.filter(d => !existingKeys.has(d.key)).map(d => ({ ...d, visible: false })),
    ];
    setEditFields(merged);
    setEditAssigned(serviceTypes.filter(s => s.templateId === tmpl.id).map(s => s.id));
  };

  const toggleAssign = (id: number) => setEditAssigned(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!editName.trim()) { toast({ variant: "destructive", title: "Shablon nomi kerak" }); return; }
    setSaving(true);
    try {
      const body = { name: editName, fields: editFields, assignToServiceTypeIds: editAssigned, storeId };
      if (isNew) {
        const r = await fetch(`${apiBase}/api/order-templates`, { method: "POST", headers, body: JSON.stringify(body) });
        if (!r.ok) throw new Error();
      } else if (editTmpl) {
        const r = await fetch(`${apiBase}/api/order-templates/${editTmpl.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        if (!r.ok) throw new Error();
      }
      toast({ title: "✅ Saqlandi" });
      setEditTmpl(null); setIsNew(false);
      await load();
    } catch { toast({ variant: "destructive", title: "Xatolik" }); }
    setSaving(false);
  };

  const deleteTmpl = async (id: number) => {
    if (!confirm("Shablonni o'chirasizmi?")) return;
    try {
      await fetch(`${apiBase}/api/order-templates/${id}`, { method: "DELETE", headers });
      toast({ title: "O'chirildi" });
      await load();
    } catch { toast({ variant: "destructive", title: "Xatolik" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Zakaz shablonlari</h2>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" />Yangi shablon
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Har bir xizmat turi uchun zakaz formasini moslashtiring — qaysi maydonlar, qanday tartibda va nomi bilan chiqishini belgilang.</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Hech qanday shablon yo'q</p>
          <p className="text-sm mt-1">Yangi shablon yarating va xizmat turlariga ulang</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tmpl => {
            const assigned = serviceTypes.filter(s => s.templateId === tmpl.id);
            return (
              <Card key={tmpl.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{tmpl.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {assigned.length > 0
                          ? <>Ulangan: <span className="text-foreground font-medium">{assigned.map(s => s.name).join(", ")}</span></>
                          : <span className="text-amber-500">Hech bir xizmat turiga ulanmagan</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tmpl.fields.filter(f => f.visible).map(f => (
                          <span key={f.key} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {f.label}{f.required ? " *" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(tmpl)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTmpl(tmpl.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isNew || !!editTmpl} onOpenChange={v => { if (!v) { setEditTmpl(null); setIsNew(false); } }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{isNew ? "Yangi shablon" : "Shablonni tahrirlash"}</DialogTitle>
            <DialogDescription>Zakaz formasidagi maydonlarni tartiblashtiring</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
            <div className="space-y-2">
              <Label>Shablon nomi</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Masalan: Tikuvchilik shabloni" />
            </div>

            <div className="space-y-2">
              <Label>Xizmat turlari (ulash)</Label>
              <div className="flex flex-wrap gap-2">
                {serviceTypes.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleAssign(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${editAssigned.includes(st.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
                  >
                    {st.name}
                    {st.templateId && st.templateId !== editTmpl?.id && <span className="ml-1 text-xs opacity-60">(boshqa)</span>}
                  </button>
                ))}
                {serviceTypes.length === 0 && <p className="text-sm text-muted-foreground">Xizmat turlari topilmadi</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Maydonlar</Label>
              <FieldEditor fields={editFields} onChange={setEditFields} />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
            <Button variant="outline" onClick={() => { setEditTmpl(null); setIsNew(false); }}>Bekor</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
