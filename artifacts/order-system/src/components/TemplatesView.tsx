import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Eye, EyeOff, FileText, X, Check, Tag } from "lucide-react";

const ALL_FIELD_KEYS: { key: string; defaultLabel: string; alwaysVisible?: boolean; noOptions?: boolean }[] = [
  { key: "serviceType",      defaultLabel: "Xizmat turi",            alwaysVisible: true, noOptions: true },
  { key: "client",           defaultLabel: "Mijoz",                   noOptions: true },
  { key: "product",          defaultLabel: "Mahsulot",               noOptions: true },
  { key: "quantity",         defaultLabel: "Soni",                   noOptions: true },
  { key: "unit",             defaultLabel: "O'lchov birligi" },
  { key: "shelf",            defaultLabel: "Joylashuv (qolib)" },
  { key: "notes",            defaultLabel: "Izoh" },
  { key: "requireOutputQty", defaultLabel: "Chiqish miqdori belgisi", noOptions: true },
];

interface TemplateField {
  key: string;
  label: string;
  required: boolean;
  visible: boolean;
  options?: string[];
}

const DEFAULT_FIELDS: TemplateField[] = ALL_FIELD_KEYS.map(f => ({
  key: f.key,
  label: f.defaultLabel,
  required: f.key === "serviceType" || f.key === "quantity",
  visible: true,
  options: [],
}));

interface Template { id: number; storeId: number; name: string; fields: TemplateField[]; }
interface ServiceType { id: number; name: string; storeId?: number | null; templateId?: number | null; }

function OptionsManager({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [input, setInput] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const v = input.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  const startEdit = (i: number) => { setEditIdx(i); setEditVal(options[i]); };
  const commitEdit = () => {
    if (editIdx === null) return;
    const v = editVal.trim();
    if (v && !options.some((o, i) => o === v && i !== editIdx)) {
      const arr = [...options]; arr[editIdx] = v; onChange(arr);
    }
    setEditIdx(null);
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
        <Tag className="w-3 h-3 shrink-0" />
        Tayyor variantlar — foydalanuvchi bosib tanlaydi:
      </p>

      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">
          Variant yo'q — oddiy matn kiritish ko'rsatiladi
        </p>
      )}

      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1">
            {editIdx === i ? (
              <>
                <input
                  autoFocus
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") setEditIdx(null); }}
                  className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-0.5 text-xs outline-none"
                />
                <button type="button" onClick={commitEdit} className="text-green-500 hover:text-green-600 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setEditIdx(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-xs font-medium">{opt}</span>
                <button type="button" onClick={() => startEdit(i)} title="Tahrirlash" className="text-muted-foreground hover:text-foreground shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => remove(i)} title="O'chirish" className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Yangi variant nomi (Enter)..."
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-8 px-2 shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FieldEditor({ fields, onChange }: { fields: TemplateField[]; onChange: (f: TemplateField[]) => void }) {
  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...fields];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    onChange(arr);
  };
  const update = (idx: number, patch: Partial<TemplateField>) => {
    const arr = [...fields];
    arr[idx] = { ...arr[idx], ...patch };
    onChange(arr);
  };
  const remove = (idx: number) => onChange(fields.filter((_, i) => i !== idx));
  const addCustom = () => {
    const key = `custom_${Date.now()}`;
    onChange([...fields, { key, label: "Yangi maydon", required: false, visible: true, options: [] }]);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Maydonlarni tartiblashtiring. Variantlar qo'shilsa — chip tugmachalar sifatida ko'rsatiladi.
      </p>
      {fields.map((f, i) => {
        const meta = ALL_FIELD_KEYS.find(m => m.key === f.key);
        const isCustom = f.key.startsWith("custom_");
        const hasOptions = isCustom || !meta?.noOptions;

        return (
          <div key={f.key} className={`rounded-xl border bg-card transition-all ${!f.visible ? "opacity-50" : ""} ${isCustom ? "border-primary/30" : ""}`}>
            <div className="flex items-center gap-2 p-3">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <Input
                value={f.label}
                onChange={e => update(i, { label: e.target.value })}
                className="h-8 text-sm flex-1 min-w-0"
                placeholder="Maydon nomi..."
              />
              <button
                type="button"
                title={f.required ? "Majburiy" : "Ixtiyoriy"}
                onClick={() => update(i, { required: !f.required })}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all text-xs font-bold shrink-0 ${f.required ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >*</button>
              {isCustom ? (
                <button
                  type="button"
                  title="Maydonni o'chirish"
                  onClick={() => remove(i)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  title={f.visible ? "Ko'rinadigan" : "Yashirin"}
                  onClick={() => { if (!meta?.alwaysVisible) update(i, { visible: !f.visible }); }}
                  disabled={!!meta?.alwaysVisible}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${f.visible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} disabled:cursor-not-allowed`}
                >
                  {f.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {hasOptions && (
              <div className="px-3 pb-3">
                <OptionsManager
                  options={f.options ?? []}
                  onChange={opts => update(i, { options: opts })}
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addCustom}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        Yangi maydon qo'shish
      </button>
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
  const [editFields, setEditFields] = useState<TemplateField[]>([]);
  const [editAssigned, setEditAssigned] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      // Agar aniq bir do'kon bo'lsa, "Standart" shablon yo'q bo'lsa avtomatik yaratamiz
      if (storeId > 0) {
        await fetch(`${apiBase}/api/order-templates/ensure-default`, {
          method: "POST",
          headers,
          body: JSON.stringify({ storeId }),
        });
      }

      const [tmplRes, stRes] = await Promise.all([
        fetch(`${apiBase}/api/order-templates`, { headers }),
        fetch(`${apiBase}/api/service-types`, { headers }),
      ]);
      const tmpls = await tmplRes.json();
      const sts = await stRes.json();
      setTemplates(Array.isArray(tmpls) ? tmpls : []);
      // SUDO (storeId=-1 yoki null) — barcha xizmatlar; admin — o'zinikilar + global (null storeId) xizmatlar
      setServiceTypes(Array.isArray(sts)
        ? (storeId === -1 || storeId == null
          ? sts
          : sts.filter((s: any) => s.storeId === storeId || s.storeId == null))
        : []);
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
    const merged: TemplateField[] = [
      ...tmpl.fields.map(f => ({ ...f, options: f.options ?? [] })),
      ...DEFAULT_FIELDS.filter(d => !existingKeys.has(d.key)).map(d => ({ ...d, visible: false })),
    ];
    setEditFields(merged);
    setEditAssigned(serviceTypes.filter(s => s.templateId === tmpl.id).map(s => s.id));
  };

  const toggleAssign = (id: number) =>
    setEditAssigned(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!editName.trim()) { toast({ variant: "destructive", title: "Shablon nomi kerak" }); return; }
    setSaving(true);
    try {
      const body = { name: editName, fields: editFields, assignToServiceTypeIds: editAssigned, storeId };
      if (isNew) {
        const r = await fetch(`${apiBase}/api/order-templates`, { method: "POST", headers, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(await r.text());
      } else if (editTmpl) {
        const r = await fetch(`${apiBase}/api/order-templates/${editTmpl.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(await r.text());
      }
      toast({ title: "✅ Saqlandi" });
      setEditTmpl(null); setIsNew(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Xatolik", description: String(e) });
    }
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

  const assignedToTemplate = (tmpl: Template) => serviceTypes.filter(s => s.templateId === tmpl.id);

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
      <p className="text-sm text-muted-foreground">
        Har bir xizmat turi uchun zakaz formasini moslashtiring. Maydonlarga tayyor variantlar qo'shsangiz, ishchilar bosib tez zakaz beradi.
      </p>

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
            const assigned = assignedToTemplate(tmpl);
            const visibleFields = Array.isArray(tmpl.fields) ? tmpl.fields.filter(f => f.visible) : [];
            return (
              <Card key={tmpl.id} className={tmpl.name === "Standart" ? "border-primary/40 bg-primary/5" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{tmpl.name}</span>
                        {tmpl.name === "Standart" && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">Default</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {assigned.length > 0
                          ? <>Ulangan: <span className="text-foreground font-medium">{assigned.map(s => s.name).join(", ")}</span></>
                          : <span className="text-amber-500">Hech bir xizmat turiga ulanmagan</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {visibleFields.map(f => (
                          <span key={f.key} className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                            {f.label}{f.required ? " *" : ""}
                            {(f.options?.length ?? 0) > 0 && (
                              <span className="bg-primary/20 text-primary rounded-full px-1 font-bold">{f.options!.length}</span>
                            )}
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
            <DialogDescription>Maydonlar, ularning tartibi va tayyor variantlari</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
            <div className="space-y-2">
              <Label>Shablon nomi</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Masalan: Tikuvchilik shabloni" />
            </div>

            <div className="space-y-2">
              <Label>Xizmat turlariga ulash</Label>
              {serviceTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 px-3 bg-muted rounded-lg">
                  Bu do'konga tegishli xizmat turlari topilmadi. Avval "Xizmatlar" tabida xizmat turi qo'shing.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {serviceTypes.map(st => {
                    const isSelected = editAssigned.includes(st.id);
                    const otherTmpl = !isSelected && st.templateId && st.templateId !== editTmpl?.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleAssign(st.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1.5 ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        {st.name}
                        {otherTmpl && <span className="text-xs opacity-60">(boshqa)</span>}
                      </button>
                    );
                  })}
                </div>
              )}
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
