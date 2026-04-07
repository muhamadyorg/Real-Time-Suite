import { useState, useRef } from "react";
import { buildReceiptHtml } from "@/lib/printUtils";
import {
  useBTPrinterContext, PRINTER_PROFILES,
  buildTsplReceipt, computeTsplRows,
  DEFAULT_TSPL_LAYOUT, type TsplLayout, type HAlign, type TsplRow,
} from "@/hooks/useBTPrinter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bluetooth, BluetoothConnected, BluetoothOff, BluetoothSearching,
  Printer, CheckCircle2, XCircle, AlertCircle, RefreshCw, Zap,
  ChevronDown, ChevronUp, Clock, FileText, Eye, EyeOff,
  AlignLeft, AlignCenter, AlignRight, Ruler, RotateCcw, GripVertical,
} from "lucide-react";

// ─── Meta ─────────────────────────────────────────────────────────────────────
const STATUS_META = {
  idle:       { label: "Tayyor",           color: "bg-gray-100 text-gray-700 border-gray-200",                    icon: Bluetooth },
  connecting: { label: "Ulanmoqda...",     color: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",      icon: BluetoothSearching },
  printing:   { label: "Chop etmoqda...", color: "bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse", icon: Printer },
  done:       { label: "✅ Chop etildi!",  color: "bg-green-100 text-green-700 border-green-200",                icon: CheckCircle2 },
  error:      { label: "❌ Xatolik",       color: "bg-red-100 text-red-700 border-red-200",                      icon: XCircle },
};

const ELEMENT_LABELS: Record<string, string> = {
  storeName:   "Do'kon nomi",
  orderId:     "Buyurtma raqami",
  dateTime:    "Sana / vaqt",
  sep1:        "Ajratgich 1",
  serviceType: "Xizmat turi",
  quantity:    "Miqdor",
  shelf:       "Javon",
  clientName:  "Mijoz ismi",
  sep2:        "Ajratgich 2",
  qr:          "QR kod",
  footer:      "Rahmat!",
};

const ELEMENT_COLORS: Record<string, string> = {
  storeName:   "#3b82f6",
  orderId:     "#8b5cf6",
  dateTime:    "#6b7280",
  sep1:        "#94a3b8",
  serviceType: "#22c55e",
  quantity:    "#0ea5e9",
  shelf:       "#14b8a6",
  clientName:  "#f59e0b",
  sep2:        "#94a3b8",
  qr:          "#f97316",
  footer:      "#ec4899",
};

const DEMO_ORDER = {
  id: 42,
  orderId: "00042",
  storeName: "Alshib shop",
  serviceTypeName: "Kimyoviy tozalash",
  quantity: 3,
  unit: "dona",
  shelf: "A-12",
  clientName: "Alisher Karimov",
  createdAt: new Date().toISOString(),
};

const PRESETS = [
  { w: 58, h: 0 },
  { w: 58, h: 40 },
  { w: 58, h: 60 },
  { w: 80, h: 0 },
  { w: 40, h: 30 },
];

// ─── Draggable Preview ────────────────────────────────────────────────────────
function LabelPreview({
  rows, layout, onDrag,
}: {
  rows: TsplRow[];
  layout: TsplLayout;
  onDrag: (key: string, newYOffset: number) => void;
}) {
  const DPM       = 8;
  const widthDots = layout.widthMm * DPM;
  const lxDots    = layout.leftMarginMm * DPM;
  const cw        = widthDots - lxDots * 2;

  const maxY      = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h + 16 : 120;
  const heightDots = layout.heightMm > 0 ? layout.heightMm * DPM : maxY;

  const PW    = 240;
  const scale = PW / widthDots;
  const PH    = Math.round(heightDots * scale);

  const tX = (d: number) => Math.round(d * scale);
  const tY = (d: number) => Math.round(d * scale);
  const tW = (d: number) => Math.max(1, Math.round(d * scale));
  const tH = (d: number) => Math.max(1, Math.round(d * scale));

  // Drag state
  const dragRef = useRef<{ key: string; startClientY: number; startYOffset: number } | null>(null);

  const onPointerDown = (row: TsplRow) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const cfg = (layout.elements as any)[row.key];
    dragRef.current = { key: row.key, startClientY: e.clientY, startYOffset: cfg?.yOffset ?? 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dy     = e.clientY - dragRef.current.startClientY;
    const delta  = Math.round(dy / scale);
    onDrag(dragRef.current.key, dragRef.current.startYOffset + delta);
  };

  const onPointerUp = () => { dragRef.current = null; };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground font-mono">
        {layout.widthMm}mm × {layout.heightMm > 0 ? layout.heightMm + "mm" : "auto"} · {widthDots}×{heightDots} dots · ☝ sudrab joylashtiring
      </p>
      <div
        className="border-2 border-dashed border-primary/40 rounded overflow-hidden bg-white shadow-lg select-none"
        style={{ width: PW, height: Math.max(PH, 60) }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width={PW} height={Math.max(PH, 60)} xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
          {/* background */}
          <rect x={0} y={0} width={PW} height={Math.max(PH,60)} fill="white" />
          {/* margin band */}
          <rect x={tX(lxDots)} y={0} width={tW(cw)} height={Math.max(PH,60)} fill="#f8fafc" />

          {rows.map((row, i) => {
            const color = ELEMENT_COLORS[row.key] ?? "#94a3b8";
            const bh    = Math.max(tH(row.h), row.kind === "bar" ? 2 : 9);

            if (row.kind === "bar") {
              return (
                <rect
                  key={i}
                  x={tX(lxDots)} y={tY(row.y)} width={tW(cw)} height={Math.max(2, tH(2))}
                  fill={color}
                  className="cursor-ns-resize"
                  onPointerDown={onPointerDown(row)}
                />
              );
            }

            if (row.kind === "qr") {
              const qsz = tW(80);
              let qx = tX(lxDots);
              if (row.align === "center") qx = tX(lxDots) + Math.round((tW(cw) - qsz) / 2);
              if (row.align === "right")  qx = tX(lxDots) + tW(cw) - qsz;
              return (
                <g key={i} className="cursor-ns-resize" onPointerDown={onPointerDown(row)}>
                  <rect x={qx} y={tY(row.y)} width={qsz} height={qsz} fill={color} opacity={0.18} rx={3} />
                  {/* QR grid overlay */}
                  {Array.from({ length: 5 }).map((_, ri) =>
                    Array.from({ length: 5 }).map((_, ci) =>
                      (ri + ci) % 2 === 0 ? (
                        <rect key={`${ri}-${ci}`}
                          x={qx + ci * Math.round(qsz/5) + 1} y={tY(row.y) + ri * Math.round(qsz/5) + 1}
                          width={Math.round(qsz/5)-2} height={Math.round(qsz/5)-2}
                          fill={color} opacity={0.5} rx={1}
                        />
                      ) : null
                    )
                  )}
                  <text x={qx+qsz/2} y={tY(row.y)+qsz+9} textAnchor="middle" fontSize={7} fill={color} fontFamily="monospace">QR</text>
                </g>
              );
            }

            // block — draggable
            const textX = row.align === "center"
              ? tX(lxDots) + tW(cw)/2
              : row.align === "right"
              ? tX(lxDots) + tW(cw) - 2
              : tX(lxDots) + 2;
            const anchor = row.align === "center" ? "middle" : row.align === "right" ? "end" : "start";
            const fSize  = Math.max(6, Math.min(10, bh - 2));

            return (
              <g key={i} className="cursor-ns-resize" onPointerDown={onPointerDown(row)}>
                <rect x={tX(lxDots)} y={tY(row.y)} width={tW(cw)} height={bh} fill={color} opacity={0.13} rx={1} />
                {/* drag handle icon */}
                <text x={tX(lxDots) + 2} y={tY(row.y) + bh/2 + 3} fontSize={6} fill={color} opacity={0.6}>⠿</text>
                <text
                  x={textX} y={tY(row.y) + bh/2 + Math.round(fSize/3)}
                  textAnchor={anchor}
                  fontSize={fSize}
                  fill={color}
                  fontFamily="monospace"
                  fontWeight={row.key === "storeName" ? "bold" : "normal"}
                >
                  {(row.text ?? row.label).slice(0, 30)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Element row (list) ───────────────────────────────────────────────────────
function ElementRow({
  elKey, config, onChange,
}: {
  elKey: string;
  config: { show: boolean; align: HAlign; yOffset: number };
  onChange: (c: { show: boolean; align: HAlign; yOffset: number }) => void;
}) {
  const color = ELEMENT_COLORS[elKey] ?? "#94a3b8";
  const isSep = elKey.startsWith("sep");

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-opacity ${config.show ? "" : "opacity-40"}`}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs flex-1 truncate">{ELEMENT_LABELS[elKey] ?? elKey}</span>

      {/* yOffset badge */}
      {config.yOffset !== 0 && (
        <span className="text-xs font-mono text-muted-foreground">{config.yOffset > 0 ? `+${config.yOffset}` : config.yOffset}px</span>
      )}

      {/* Ko'rsat/yashir */}
      <button
        type="button"
        onClick={() => onChange({ ...config, show: !config.show })}
        className="p-1 rounded hover:bg-muted transition-colors"
        title={config.show ? "Yashir" : "Ko'rsat"}
      >
        {config.show ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* Hizalash (separator uchun kerak emas) */}
      {!isSep && (
        <div className="flex border rounded overflow-hidden">
          {(["left", "center", "right"] as HAlign[]).map(a => (
            <button
              key={a}
              type="button"
              disabled={!config.show}
              onClick={() => onChange({ ...config, align: a })}
              className={`p-1 transition-colors ${config.align === a ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              title={a === "left" ? "Chap" : a === "center" ? "Markaz" : "O'ng"}
            >
              {a === "left" ? <AlignLeft className="w-3 h-3" /> : a === "center" ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stepper (touch-friendly +/-) ────────────────────────────────────────────
function Stepper({ label, value, unit = "mm", min = 0, max = 300, step = 1, onChange }: {
  label: string; value: number; unit?: string; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="w-9 h-9 rounded border text-lg font-bold flex items-center justify-center hover:bg-muted active:scale-95 transition-transform select-none"
          onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(1))))}
        >−</button>
        <div className="flex-1 text-center font-mono text-sm font-semibold">
          {value}{unit}
        </div>
        <button
          type="button"
          className="w-9 h-9 rounded border text-lg font-bold flex items-center justify-center hover:bg-muted active:scale-95 transition-transform select-none"
          onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(1))))}
        >+</button>
      </div>
    </div>
  );
}

// ─── Asosiy panel ─────────────────────────────────────────────────────────────
export default function BluetoothPrinterPanel() {
  const {
    printTspl, printRaw, connect, disconnect,
    status, errorMsg, printerName, profileName,
    serviceUuid, charUuid, allServices, isConnected, isSupported,
    printLog, labelBytes,
    layout, setLayout, resetLayout,
  } = useBTPrinterContext();

  const [showServices,  setShowServices]  = useState(false);
  const [showLog,       setShowLog]       = useState(false);
  const [showDesigner,  setShowDesigner]  = useState(true);
  const [showElements,  setShowElements]  = useState(true);

  const isBusy    = status === "connecting" || status === "printing";
  const StatusIcon = STATUS_META[status].icon;

  const rows = computeTsplRows(DEMO_ORDER, layout);

  const setEl = (key: keyof TsplLayout["elements"], cfg: { show: boolean; align: HAlign; yOffset: number }) => {
    setLayout({ ...layout, elements: { ...layout.elements, [key]: cfg } });
  };

  const handleDrag = (key: string, newYOffset: number) => {
    const k = key as keyof TsplLayout["elements"];
    setLayout({ ...layout, elements: { ...layout.elements, [k]: { ...layout.elements[k], yOffset: newYOffset } } });
  };

  const handleTsplPrint = () => printTspl(DEMO_ORDER);  // demo uchun

  const handleBrowserPrint = () => {
    const html = buildReceiptHtml(DEMO_ORDER);
    const w = window.open("", "_blank", "width=300,height=600");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.print(); w.onafterprint = () => w.close(); };
  };

  const handleRawTest = () => {
    const data = buildTsplReceipt(DEMO_ORDER, layout);
    printRaw(data, "TSPL raw");
  };

  if (!isSupported) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">Web Bluetooth qo'llab-quvvatlanmaydi</p>
              <p className="text-sm mt-1 opacity-80">
                Faqat <strong>Chrome Android</strong> da va <strong>HTTPS</strong> orqali ishlaydi.
                To'g'ridan-to'g'ri <code className="bg-black/10 px-1 rounded">zakaz.muhamadyorg.uz</code> saytiga kiring.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* ── STATUS ── */}
      <Card className={`border ${STATUS_META[status].color}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className="w-6 h-6" />
            <div>
              <p className="font-semibold">{STATUS_META[status].label}</p>
              {errorMsg && <p className="text-xs mt-0.5 font-mono whitespace-pre-wrap break-all opacity-90">{errorMsg}</p>}
            </div>
          </div>
          {isConnected ? <BluetoothConnected className="w-5 h-5 text-green-600" /> : <BluetoothOff className="w-5 h-5 text-gray-400" />}
        </CardContent>
      </Card>

      {/* ── QURILMA ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bluetooth className="w-4 h-4" /> Printer qurilma
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div><span className="text-muted-foreground text-xs">Qurilma</span><p className="font-medium truncate">{printerName ?? "—"}</p></div>
            <div><span className="text-muted-foreground text-xs">Profil</span><p className="font-mono text-xs">{profileName || "—"}</p></div>
            {serviceUuid && <div className="col-span-2"><span className="text-xs text-muted-foreground">Service</span><p className="font-mono text-xs break-all text-blue-600">{serviceUuid}</p></div>}
            {charUuid    && <div className="col-span-2"><span className="text-xs text-muted-foreground">Char</span><p className="font-mono text-xs break-all text-green-600">{charUuid}</p></div>}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button className="flex-1" variant={isConnected ? "outline" : "default"} onClick={connect} disabled={isBusy}>
              {isBusy ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Ulanmoqda...</> : isConnected ? <><RefreshCw className="w-4 h-4 mr-2" />Boshqasini ulash</> : <><Bluetooth className="w-4 h-4 mr-2" />Bluetooth ulash</>}
            </Button>
            {isConnected && <Button variant="destructive" size="icon" onClick={disconnect} disabled={isBusy} title="Uzish"><BluetoothOff className="w-4 h-4" /></Button>}
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">Ma'lum profil ({PRINTER_PROFILES.length} ta)</summary>
            <div className="mt-2 space-y-1">
              {PRINTER_PROFILES.map(p => (
                <div key={p.char} className="flex items-center gap-2">
                  <Badge variant={profileName === p.name ? "default" : "outline"} className="text-xs font-normal">{p.name}</Badge>
                  <span className="font-mono text-muted-foreground">{p.svc.slice(4,8)}/{p.char.slice(4,8)}</span>
                  {profileName === p.name && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* ── BLE SERVICES ── */}
      {allServices.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={() => setShowServices(v => !v)}>
              <span className="flex items-center gap-2"><Bluetooth className="w-4 h-4" />Topilgan UUID lar ({allServices.length})</span>
              {showServices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showServices && (
            <CardContent className="px-4 pb-4 space-y-2">
              {allServices.map(svc => (
                <div key={svc.uuid} className="rounded border p-2 space-y-1">
                  <p className="font-mono text-xs break-all text-muted-foreground">{svc.uuid}</p>
                  {svc.chars.map(ch => (
                    <div key={ch.uuid} className={`ml-3 pl-2 border-l-2 ${ch.isWritable ? "border-green-400" : "border-gray-200"}`}>
                      <p className="font-mono text-xs break-all">{ch.uuid}</p>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {ch.props.map(p => <Badge key={p} variant={p.includes("write") ? "default" : "secondary"} className="text-xs h-4 py-0">{p}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── LABEL DIZAYNERI ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={() => setShowDesigner(v => !v)}>
            <span className="flex items-center gap-2"><Ruler className="w-4 h-4" />Label dizayneri <span className="text-xs font-normal text-muted-foreground">(saqlanadi)</span></span>
            {showDesigner ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>

        {showDesigner && (
          <CardContent className="px-4 pb-4 space-y-5">

            {/* ── O'LCHAMLAR ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">O'lchamlar</p>
              <div className="grid grid-cols-3 gap-3">
                <Stepper label="Kenglik" value={layout.widthMm} unit="mm" min={20} max={120}
                  onChange={v => setLayout({ ...layout, widthMm: v })} />
                <Stepper label="Balandlik (0=auto)" value={layout.heightMm} unit="mm" min={0} max={300}
                  onChange={v => setLayout({ ...layout, heightMm: v })} />
                <Stepper label="Chap chegara" value={layout.leftMarginMm} unit="mm" min={0} max={20} step={0.5}
                  onChange={v => setLayout({ ...layout, leftMarginMm: v })} />
              </div>

              {/* Tez presetlar */}
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map(p => (
                  <button
                    key={`${p.w}x${p.h}`}
                    type="button"
                    onClick={() => setLayout({ ...layout, widthMm: p.w, heightMm: p.h })}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${layout.widthMm === p.w && layout.heightMm === p.h ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"}`}
                  >
                    {p.w}×{p.h || "auto"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* ── PREVIEW (draggable) ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                <GripVertical className="w-3 h-3" /> Chekni sudrab joylashtirishingiz mumkin
              </p>
              <LabelPreview rows={rows} layout={layout} onDrag={handleDrag} />
            </div>

            <Separator />

            {/* ── ELEMENTLAR ── */}
            <div>
              <button
                className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground mb-2"
                onClick={() => setShowElements(v => !v)}
              >
                <span>Elementlar (Ko'z = ko'rsat/yashir · L/C/R = hizalash)</span>
                {showElements ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showElements && (
                <div className="space-y-0.5">
                  {(Object.keys(layout.elements) as Array<keyof TsplLayout["elements"]>).map(key => (
                    <ElementRow
                      key={key}
                      elKey={key}
                      config={layout.elements[key]}
                      onChange={cfg => setEl(key, cfg)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Reset */}
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={resetLayout}>
              <RotateCcw className="w-3.5 h-3.5" /> Standart holatga qaytarish
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── CHOP ETISH ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" /> Test chop etish
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Haqiqiy buyurtmalar ekranidan bosganda ham xuddi shu nastroyka ishlatiladi.
          </p>

          <Button className="w-full h-12 text-base font-bold" onClick={handleTsplPrint} disabled={isBusy}>
            {status === "printing" ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Chop etmoqda... ({labelBytes}B)</>
             : status === "done"   ? <><CheckCircle2 className="w-5 h-5 mr-2" />Chop etildi!</>
             : <><Printer className="w-5 h-5 mr-2" />TSPL test chop et</>}
          </Button>

          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleBrowserPrint}>
            <FileText className="w-4 h-4 mr-2" /> Brauzer orqali chop et (BLE shart emas)
          </Button>

          <Button className="w-full" variant="outline" size="sm" onClick={handleRawTest} disabled={isBusy}>
            <Zap className="w-4 h-4 mr-2" /> TSPL raw baytlar (diagnostika)
          </Button>
        </CardContent>
      </Card>

      {/* ── TARIXI ── */}
      {printLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={() => setShowLog(v => !v)}>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" />Chop tarixi ({printLog.length})</span>
              {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showLog && (
            <CardContent className="px-4 pb-4 space-y-2">
              {printLog.map((e, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${e.status==="done"?"bg-green-50 border border-green-100":"bg-red-50 border border-red-100"}`}>
                  {e.status==="done" ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
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
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Muhim</p>
              <p>Web Bluetooth faqat <strong>Chrome Android</strong> da va <strong>HTTPS</strong> saytida ishlaydi.</p>
              <p>Printer: <strong>Xprinter XP-365B</strong> · 203 DPI · TSPL protokol</p>
              <p className="text-green-800 font-medium">✓ Nastroykalar avtomatik saqlanadi va hamma joyda ishlatiladi</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
