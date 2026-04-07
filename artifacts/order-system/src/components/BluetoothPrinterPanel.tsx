import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { buildReceiptHtml } from "@/lib/printUtils";
import {
  useBTPrinterContext, PRINTER_PROFILES,
  buildTsplReceipt, getOrderNum,
  DEFAULT_TSPL_LAYOUT, elHeight, qrDots, FONT_H,
  type TsplLayout, type TsplElementConfig, type HAlign, type Rotation,
} from "@/hooks/useBTPrinter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bluetooth, BluetoothConnected, BluetoothOff, BluetoothSearching,
  Printer, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Clock, FileText, Eye, EyeOff,
  AlignLeft, AlignCenter, AlignRight, RotateCcw, X, Edit3,
  ZoomIn,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DPM = 8;

const STATUS_META = {
  idle:       { label: "Tayyor",           color: "bg-gray-100 text-gray-700 border-gray-200",                    icon: Bluetooth },
  connecting: { label: "Ulanmoqda...",     color: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",      icon: BluetoothSearching },
  printing:   { label: "Chop etmoqda...", color: "bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse", icon: Printer },
  done:       { label: "✅ Chop etildi!",  color: "bg-green-100 text-green-700 border-green-200",                icon: CheckCircle2 },
  error:      { label: "❌ Xatolik",       color: "bg-red-100 text-red-700 border-red-200",                      icon: XCircle },
};

const EL_LABELS: Record<string, string> = {
  storeName:"Do'kon nomi", orderId:"Buyurtma #", dateTime:"Sana/vaqt",
  sep1:"Chiziq 1", serviceType:"Xizmat turi", quantity:"Miqdor",
  shelf:"Javon", clientName:"Mijoz", sep2:"Chiziq 2", qr:"QR kod", footer:"Rahmat!",
};
const EL_COLORS: Record<string, string> = {
  storeName:"#3b82f6", orderId:"#8b5cf6", dateTime:"#6b7280",
  sep1:"#94a3b8", serviceType:"#22c55e", quantity:"#0ea5e9",
  shelf:"#14b8a6", clientName:"#f59e0b", sep2:"#94a3b8", qr:"#f97316", footer:"#ec4899",
};
const FONTS = ["1","2","3","4","5","6","7","8"];
const DEMO_ORDER = {
  id:42, orderId:"00042", storeName:"Alshib shop",
  serviceTypeName:"Kimyoviy tozalash", quantity:3, unit:"dona",
  shelf:"A-12", clientName:"Alisher Karimov", createdAt:new Date().toISOString(),
};

type ElKey = keyof TsplLayout["elements"];

// ─── Text map for preview ─────────────────────────────────────────────────────
function getTextMap(order: any): Record<string, string> {
  const now=new Date(order.createdAt??Date.now()); const u5=new Date(now.getTime()+5*3600_000);
  const pad=(n:number)=>String(n).padStart(2,"0");
  const d=`${pad(u5.getUTCDate())}.${pad(u5.getUTCMonth()+1)}.${u5.getUTCFullYear()}`;
  const t=`${pad(u5.getUTCHours())}:${pad(u5.getUTCMinutes())}`;
  const qty=[order.quantity,order.unit].filter(Boolean).join(" ");
  return {
    storeName:order.storeName??"DO'KON", orderId:`Buyurtma #${getOrderNum(order)}`,
    dateTime:`${d}  ${t}`, serviceType:order.serviceTypeName??"Xizmat",
    quantity:qty?`Miqdor: ${qty}`:"", shelf:order.shelf?`Javon: ${order.shelf}`:"",
    clientName:order.clientName?`Mijoz: ${order.clientName}`:"", footer:"Rahmat!",
  };
}

// ─── Label SVG Canvas ─────────────────────────────────────────────────────────
interface CanvasProps {
  layout: TsplLayout;
  order:  any;
  scale:  number;
  selectedKey?: ElKey | null;
  onSelect?:    (k: ElKey) => void;
  onDrag?:      (k: ElKey, dx: number, dy: number) => void;  // dots delta
  interactive?: boolean;
}

function LabelCanvas({ layout, order, scale, selectedKey, onSelect, onDrag, interactive=false }: CanvasProps) {
  const wDots = layout.widthMm * DPM;
  const texts  = getTextMap(order);
  const dragRef = useRef<{ key:ElKey; startCX:number; startCY:number; startX:number; startY:number } | null>(null);

  // Compute auto height
  let maxY = 60;
  for (const [k,el] of Object.entries(layout.elements) as [ElKey, TsplElementConfig][]) {
    if (!el.show) continue;
    const h = (k==="sep1"||k==="sep2") ? el.height : k==="qr" ? qrDots(el.qrSize) : elHeight(el);
    maxY = Math.max(maxY, el.y + h + 10);
  }
  const hDots  = layout.heightMm > 0 ? layout.heightMm * DPM : maxY;
  const W = Math.round(wDots * scale);
  const H = Math.round(hDots * scale);

  const toS = (d: number) => d * scale;

  const handlePD = (k: ElKey) => (e: React.PointerEvent<SVGGElement>) => {
    if (!interactive || !onSelect || !onDrag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect(k);
    dragRef.current = { key:k, startCX:e.clientX, startCY:e.clientY, startX:layout.elements[k].x, startY:layout.elements[k].y };
    e.stopPropagation();
  };
  const handlePM = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !onDrag) return;
    const dx = Math.round((e.clientX - dragRef.current.startCX) / scale);
    const dy = Math.round((e.clientY - dragRef.current.startCY) / scale);
    onDrag(dragRef.current.key, dx, dy);
  };
  const handlePU = () => { dragRef.current = null; };

  return (
    <svg
      width={W} height={H}
      style={{ display:"block", background:"white", userSelect:"none", touchAction:"none" }}
      onPointerMove={handlePM}
      onPointerUp={handlePU}
      onPointerCancel={handlePU}
    >
      {/* label background */}
      <rect x={0} y={0} width={W} height={H} fill="white" />

      {(Object.entries(layout.elements) as [ElKey, TsplElementConfig][]).map(([k, el]) => {
        if (!el.show) return null;
        const col   = EL_COLORS[k] ?? "#888";
        const isSep = k==="sep1"||k==="sep2";
        const isQr  = k==="qr";
        const sx    = toS(el.x);
        const sy    = toS(el.y);
        const sw    = toS(el.width);
        const isSel = selectedKey === k;
        const cursor = interactive ? "grab" : "default";

        if (isSep) {
          const sh = Math.max(1, toS(el.height));
          return (
            <g key={k} style={{ cursor }} onPointerDown={handlePD(k)}>
              <rect x={sx} y={sy} width={sw} height={sh} fill={col} />
              {isSel && <rect x={sx-1} y={sy-2} width={sw+2} height={sh+4} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 2" />}
            </g>
          );
        }

        if (isQr) {
          const qsz = toS(qrDots(el.qrSize));
          const cx  = sx + qsz/2; const cy = sy + qsz/2;
          const cells = 5;
          const cell  = qsz / cells;
          return (
            <g key={k} style={{ cursor }} transform={`rotate(${el.rotation},${cx},${cy})`} onPointerDown={handlePD(k)}>
              <rect x={sx} y={sy} width={qsz} height={qsz} fill={col} opacity={0.12} rx={2} />
              {Array.from({length:cells}).map((_,ri)=>Array.from({length:cells}).map((_,ci)=>
                (ri+ci)%2===0 ? <rect key={`${ri}-${ci}`} x={sx+ci*cell+1} y={sy+ri*cell+1} width={cell-2} height={cell-2} fill={col} opacity={0.55} rx={1}/> : null
              ))}
              <text x={cx} y={sy+qsz+toS(6)} textAnchor="middle" fontSize={Math.max(7,toS(6))} fill={col} fontFamily="monospace">QR</text>
              {isSel && <rect x={sx-2} y={sy-2} width={qsz+4} height={qsz+4} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 2"/>}
            </g>
          );
        }

        // text block
        const h   = elHeight(el);
        const sh  = Math.max(toS(h), 9);
        const fs  = Math.max(6, Math.min(12, (FONT_H[el.font]??12) * el.yScale * scale));
        const cx  = sx + sw/2; const cy = sy + sh/2;
        const txt = texts[k] ?? EL_LABELS[k] ?? k;
        const ta  = el.align==="center" ? "middle" : el.align==="right" ? "end" : "start";
        const tx  = el.align==="center" ? cx : el.align==="right" ? sx+sw-2 : sx+2;

        return (
          <g key={k} style={{ cursor }} transform={`rotate(${el.rotation},${cx},${cy})`} onPointerDown={handlePD(k)}>
            <rect x={sx} y={sy} width={sw} height={sh} fill={col} opacity={isSel?0.2:0.1} rx={1} />
            <text x={tx} y={cy+fs*0.35} textAnchor={ta} fontSize={fs} fill={col}
              fontFamily="monospace" fontWeight={k==="storeName"?"bold":"normal"}>
              {txt.slice(0, Math.floor(sw/Math.max(3,fs*0.6)))}
            </text>
            {isSel && <rect x={sx-1} y={sy-1} width={sw+2} height={sh+2} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 2"/>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Sp({ val, onChange, min=0, max=9999, step=1, label="" }: { val:number; onChange:(v:number)=>void; min?:number; max?:number; step?:number; label?:string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
      <div className="flex items-center border rounded overflow-hidden h-8">
        <button type="button" className="w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-muted active:scale-90 select-none" onClick={()=>onChange(Math.max(min,parseFloat((val-step).toFixed(2))))}>−</button>
        <span className="w-12 text-center text-xs font-mono">{val}</span>
        <button type="button" className="w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-muted active:scale-90 select-none" onClick={()=>onChange(Math.min(max,parseFloat((val+step).toFixed(2))))}>+</button>
      </div>
    </div>
  );
}

// ─── Full-screen Editor ───────────────────────────────────────────────────────
function LabelEditor({ initialLayout, onSave, onClose }: {
  initialLayout: TsplLayout;
  onSave: (l: TsplLayout) => void;
  onClose: () => void;
}) {
  const [draft,   setDraft]   = useState<TsplLayout>(initialLayout);
  const [selKey,  setSelKey]  = useState<ElKey | null>(null);
  const [history, setHistory] = useState<TsplLayout[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Undo
  const pushHistory = useCallback((prev: TsplLayout) => {
    setHistory(h => [...h.slice(-19), prev]);
  }, []);
  const undo = () => {
    if (!history.length) return;
    setDraft(history[history.length-1]);
    setHistory(h => h.slice(0,-1));
  };

  const updateEl = useCallback((key: ElKey, updates: Partial<TsplElementConfig>) => {
    setDraft(prev => {
      pushHistory(prev);
      return { ...prev, elements: { ...prev.elements, [key]: { ...prev.elements[key], ...updates } } };
    });
  }, [pushHistory]);

  // Drag handler — x,y dots delta
  const handleDrag = useCallback((key: ElKey, dx: number, dy: number) => {
    setDraft(prev => {
      const el = prev.elements[key];
      return { ...prev, elements: { ...prev.elements, [key]: { ...el, x: Math.max(0, el.x + dx), y: Math.max(0, el.y + dy) } } };
    });
  }, []);

  // Compute canvas scale from container width
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const compute = () => {
      const w = containerRef.current?.clientWidth ?? 340;
      setScale((w - 24) / (draft.widthMm * DPM));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [draft.widthMm]);

  const sel = selKey ? draft.elements[selKey] : null;
  const isSep = selKey==="sep1"||selKey==="sep2";
  const isQr  = selKey==="qr";

  const rotNext = (): Rotation => {
    if (!sel) return 0;
    const order: Rotation[] = [0,90,180,270];
    return order[(order.indexOf(sel.rotation)+1)%4];
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ touchAction:"none" }}>

      {/* ── TOP TOOLBAR ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <button type="button" onClick={onClose} className="p-2 rounded hover:bg-muted">
          <X className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm flex-1">Label tahrirlash</span>

        {/* Label size */}
        <div className="flex items-center gap-1 text-xs">
          <Sp val={draft.widthMm}  onChange={v=>setDraft(p=>({...p,widthMm:v}))}  min={20} max={120} step={1} label="mm" />
          <span className="text-muted-foreground mt-4">×</span>
          <Sp val={draft.heightMm} onChange={v=>setDraft(p=>({...p,heightMm:v}))} min={0}  max={300} step={1} label="mm" />
        </div>

        <button type="button" onClick={undo} disabled={!history.length} className="p-2 rounded hover:bg-muted disabled:opacity-30">
          <RotateCcw className="w-4 h-4" />
        </button>
        <Button size="sm" onClick={()=>{ onSave(draft); onClose(); }} className="h-8">
          Saqlash
        </Button>
      </div>

      {/* ── CANVAS ── */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex flex-col items-center py-4 gap-3">
        <p className="text-xs text-gray-400 select-none">Elementlarni barmog'ingiz bilan suring • bosib tanlang</p>
        <div className="shadow-2xl border border-gray-200 rounded overflow-hidden" style={{ width: Math.round(draft.widthMm * DPM * scale), lineHeight:0 }}>
          <LabelCanvas
            layout={draft}
            order={DEMO_ORDER}
            scale={scale}
            selectedKey={selKey}
            onSelect={setSelKey}
            onDrag={handleDrag}
            interactive
          />
        </div>
      </div>

      {/* ── ELEMENT LIST ── */}
      <div className="border-t bg-card shrink-0">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
          {(Object.keys(draft.elements) as ElKey[]).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setSelKey(k)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs whitespace-nowrap transition-all shrink-0 ${selKey===k ? "bg-primary text-primary-foreground border-primary" : draft.elements[k].show ? "bg-card hover:bg-muted" : "opacity-40 hover:bg-muted"}`}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: EL_COLORS[k]??"#888" }} />
              {EL_LABELS[k]}
            </button>
          ))}
        </div>

        {/* ── SELECTED ELEMENT CONTROLS ── */}
        {sel && selKey && (
          <div className="border-t px-3 py-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{background:EL_COLORS[selKey]??"#888"}}/>
                {EL_LABELS[selKey]}
              </span>
              <button
                type="button"
                onClick={()=>updateEl(selKey,{show:!sel.show})}
                className="flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-muted"
              >
                {sel.show ? <><Eye className="w-3 h-3"/>Ko'rsat</> : <><EyeOff className="w-3 h-3"/>Yashir</>}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* X, Y */}
              <Sp label="X (dots)" val={sel.x} onChange={v=>updateEl(selKey,{x:Math.max(0,v)})} step={4} />
              <Sp label="Y (dots)" val={sel.y} onChange={v=>updateEl(selKey,{y:Math.max(0,v)})} step={4} />
              {/* Width */}
              <Sp label="Kenglik" val={sel.width} onChange={v=>updateEl(selKey,{width:Math.max(10,v)})} step={8} />

              {/* Sep height */}
              {isSep && <Sp label="Qalinlik" val={sel.height} onChange={v=>updateEl(selKey,{height:Math.max(1,v)})} step={1} min={1} max={20}/>}

              {/* QR size */}
              {isQr && <Sp label="QR katakcha" val={sel.qrSize} onChange={v=>updateEl(selKey,{qrSize:Math.max(1,Math.min(10,v))})} step={1} min={1} max={10}/>}

              {/* Font */}
              {!isSep && !isQr && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Font</span>
                  <div className="flex border rounded overflow-hidden">
                    {FONTS.map(f=>(
                      <button key={f} type="button"
                        onClick={()=>updateEl(selKey,{font:f})}
                        className={`w-7 h-8 text-xs font-mono transition-colors ${sel.font===f?"bg-primary text-primary-foreground":"hover:bg-muted"}`}
                      >{f}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* X/Y Scale */}
              {!isSep && (
                <>
                  <Sp label="X ko'p" val={sel.xScale} onChange={v=>updateEl(selKey,{xScale:Math.max(1,Math.min(10,v))})} step={1} min={1} max={10}/>
                  <Sp label="Y ko'p" val={sel.yScale} onChange={v=>updateEl(selKey,{yScale:Math.max(1,Math.min(10,v))})} step={1} min={1} max={10}/>
                </>
              )}

              {/* Rotation */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">Burish</span>
                <div className="flex border rounded overflow-hidden">
                  {([0,90,180,270] as Rotation[]).map(r=>(
                    <button key={r} type="button"
                      onClick={()=>updateEl(selKey,{rotation:r})}
                      className={`px-2 h-8 text-xs transition-colors ${sel.rotation===r?"bg-primary text-primary-foreground":"hover:bg-muted"}`}
                    >{r}°</button>
                  ))}
                </div>
              </div>

              {/* Align (not for sep/qr) */}
              {!isSep && !isQr && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Hizalash</span>
                  <div className="flex border rounded overflow-hidden">
                    {([["left","Chap",AlignLeft],["center","Markaz",AlignCenter],["right","O'ng",AlignRight]] as const).map(([a,,Icon])=>(
                      <button key={a} type="button"
                        onClick={()=>updateEl(selKey,{align:a as HAlign})}
                        className={`w-8 h-8 flex items-center justify-center transition-colors ${sel.align===a?"bg-primary text-primary-foreground":"hover:bg-muted"}`}
                        title={a}
                      ><Icon className="w-3.5 h-3.5"/></button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main BluetoothPrinterPanel ───────────────────────────────────────────────
export default function BluetoothPrinterPanel() {
  const {
    printTspl, printRaw, connect, disconnect,
    status, errorMsg, printerName, profileName,
    serviceUuid, charUuid, allServices, isConnected, isSupported,
    printLog, labelBytes, layout, setLayout, resetLayout,
  } = useBTPrinterContext();

  const [editorOpen, setEditorOpen] = useState(false);
  const [showLog,    setShowLog]    = useState(false);
  const [showSvc,    setShowSvc]    = useState(false);

  const isBusy     = status==="connecting"||status==="printing";
  const StatusIcon = STATUS_META[status].icon;
  const miniScale  = 130 / (layout.widthMm * DPM);

  const handleBrowserPrint = () => {
    const html=buildReceiptHtml(DEMO_ORDER);
    const w=window.open("","_blank","width=300,height=600");
    if(!w)return;
    w.document.open();w.document.write(html);w.document.close();
    w.onload=()=>{w.focus();w.print();w.onafterprint=()=>w.close();};
  };

  if (!isSupported) return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-6 h-6 flex-shrink-0"/>
          <div>
            <p className="font-semibold">Web Bluetooth qo'llab-quvvatlanmaydi</p>
            <p className="text-sm mt-1 opacity-80">
              Faqat <strong>Chrome Android</strong> da va <strong>HTTPS</strong> orqali.
              To'g'ridan-to'g'ri <code className="bg-black/10 px-1 rounded">zakaz.muhamadyorg.uz</code> ga kiring.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* ── STATUS ── */}
      <Card className={`border ${STATUS_META[status].color}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className="w-6 h-6"/>
            <div>
              <p className="font-semibold">{STATUS_META[status].label}</p>
              {errorMsg && <p className="text-xs mt-0.5 font-mono whitespace-pre-wrap break-all opacity-90">{errorMsg}</p>}
            </div>
          </div>
          {isConnected ? <BluetoothConnected className="w-5 h-5 text-green-600"/> : <BluetoothOff className="w-5 h-5 text-gray-400"/>}
        </CardContent>
      </Card>

      {/* ── QURILMA ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bluetooth className="w-4 h-4"/> Printer qurilma
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div><span className="text-muted-foreground text-xs">Qurilma</span><p className="font-medium truncate">{printerName??"—"}</p></div>
            <div><span className="text-muted-foreground text-xs">Profil</span><p className="font-mono text-xs">{profileName||"—"}</p></div>
            {serviceUuid&&<div className="col-span-2"><span className="text-xs text-muted-foreground">Service</span><p className="font-mono text-xs break-all text-blue-600">{serviceUuid}</p></div>}
            {charUuid   &&<div className="col-span-2"><span className="text-xs text-muted-foreground">Char</span><p className="font-mono text-xs break-all text-green-600">{charUuid}</p></div>}
          </div>
          <Separator/>
          <div className="flex gap-2">
            <Button className="flex-1" variant={isConnected?"outline":"default"} onClick={connect} disabled={isBusy}>
              {isBusy?<><RefreshCw className="w-4 h-4 mr-2 animate-spin"/>Ulanmoqda...</>:isConnected?<><RefreshCw className="w-4 h-4 mr-2"/>Boshqasini ulash</>:<><Bluetooth className="w-4 h-4 mr-2"/>Bluetooth ulash</>}
            </Button>
            {isConnected&&<Button variant="destructive" size="icon" onClick={disconnect} disabled={isBusy}><BluetoothOff className="w-4 h-4"/></Button>}
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">Ma'lum profil ({PRINTER_PROFILES.length} ta)</summary>
            <div className="mt-2 space-y-1">
              {PRINTER_PROFILES.map(p=>(
                <div key={p.char} className="flex items-center gap-2">
                  <Badge variant={profileName===p.name?"default":"outline"} className="text-xs font-normal">{p.name}</Badge>
                  <span className="font-mono text-muted-foreground">{p.svc.slice(4,8)}/{p.char.slice(4,8)}</span>
                  {profileName===p.name&&<CheckCircle2 className="w-3 h-3 text-green-500 ml-auto"/>}
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* ── LABEL PREVIEW (clickable → editor) ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ZoomIn className="w-4 h-4"/> Chek dizayni
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-4 items-start">
            {/* Mini preview — clickable */}
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="relative group shrink-0 rounded overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors shadow"
              style={{ width:130, lineHeight:0 }}
              title="Tahrirlash uchun bosing"
            >
              <LabelCanvas layout={layout} order={DEMO_ORDER} scale={miniScale}/>
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-primary text-primary-foreground rounded-full p-2">
                  <Edit3 className="w-4 h-4"/>
                </div>
              </div>
            </button>

            {/* Right side info + buttons */}
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Chekga bosib tahrirlang</p>
              <p className="text-xs text-muted-foreground">
                {layout.widthMm}mm × {layout.heightMm>0?layout.heightMm+"mm":"auto"} · Elementlarni sudrang, buriting, kattalashtiring
              </p>
              <Button className="w-full gap-2" size="sm" onClick={()=>setEditorOpen(true)}>
                <Edit3 className="w-4 h-4"/> To'liq ekranda tahrirlash
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={resetLayout}>
                <RotateCcw className="w-3.5 h-3.5"/> Standartga qaytarish
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CHOP ETISH ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Printer className="w-4 h-4"/> Chop etish
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground">Haqiqiy buyurtmalardan bosganda ham xuddi shu dizayn ishlatiladi.</p>
          <Button className="w-full h-12 text-base font-bold" onClick={()=>printTspl(DEMO_ORDER)} disabled={isBusy}>
            {status==="printing"?<><RefreshCw className="w-5 h-5 mr-2 animate-spin"/>Chop etmoqda... ({labelBytes}B)</>:status==="done"?<><CheckCircle2 className="w-5 h-5 mr-2"/>Chop etildi!</>:<><Printer className="w-5 h-5 mr-2"/>TSPL test chop et</>}
          </Button>
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleBrowserPrint}>
            <FileText className="w-4 h-4 mr-2"/> Brauzer orqali chop et
          </Button>
          <Button className="w-full" variant="outline" size="sm" onClick={()=>printRaw(buildTsplReceipt(DEMO_ORDER,layout),"raw")} disabled={isBusy}>
            Raw TSPL baytlar (diagnostika)
          </Button>
        </CardContent>
      </Card>

      {/* ── BLE SERVICES ── */}
      {allServices.length>0&&(
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={()=>setShowSvc(v=>!v)}>
              <span className="flex items-center gap-2"><Bluetooth className="w-4 h-4"/>UUID ({allServices.length})</span>
              {showSvc?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
            </button>
          </CardHeader>
          {showSvc&&(
            <CardContent className="px-4 pb-4 space-y-2">
              {allServices.map(s=>(
                <div key={s.uuid} className="rounded border p-2 space-y-1">
                  <p className="font-mono text-xs break-all text-muted-foreground">{s.uuid}</p>
                  {s.chars.map(c=>(
                    <div key={c.uuid} className={`ml-3 pl-2 border-l-2 ${c.isWritable?"border-green-400":"border-gray-200"}`}>
                      <p className="font-mono text-xs break-all">{c.uuid}</p>
                      <div className="flex gap-1 flex-wrap mt-0.5">{c.props.map(p=><Badge key={p} variant={p.includes("write")?"default":"secondary"} className="text-xs h-4 py-0">{p}</Badge>)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── TARIXI ── */}
      {printLog.length>0&&(
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={()=>setShowLog(v=>!v)}>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4"/>Chop tarixi ({printLog.length})</span>
              {showLog?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
            </button>
          </CardHeader>
          {showLog&&(
            <CardContent className="px-4 pb-4 space-y-2">
              {printLog.map((e,i)=>(
                <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${e.status==="done"?"bg-green-50 border border-green-100":"bg-red-50 border border-red-100"}`}>
                  {e.status==="done"?<CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5"/>:<XCircle className="w-4 h-4 text-red-600 mt-0.5"/>}
                  <div><span className="font-medium">{e.time}</span><span className="text-muted-foreground ml-2">{e.ms}ms</span><p className="text-muted-foreground break-all mt-0.5">{e.msg}</p></div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── ESLATMA ── */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex gap-3 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
            <div className="space-y-1">
              <p className="font-semibold">Muhim</p>
              <p>Web Bluetooth faqat <strong>Chrome Android</strong> da va <strong>HTTPS</strong> saytida ishlaydi.</p>
              <p>Printer: <strong>Xprinter XP-365B</strong> · 203 DPI · TSPL</p>
              <p className="text-green-800 font-medium">✓ Nastroykalar avtomatik saqlanadi va hamma joyda ishlatiladi</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── FULL-SCREEN EDITOR ── */}
      {editorOpen && (
        <LabelEditor
          initialLayout={layout}
          onSave={setLayout}
          onClose={()=>setEditorOpen(false)}
        />
      )}
    </div>
  );
}
