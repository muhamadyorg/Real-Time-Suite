import { useState } from "react";
import { buildReceiptHtml } from "@/lib/printUtils";
import {
  useBTPrinterContext, PRINTER_PROFILES,
  buildTsplReceipt, computeTsplRows,
  DEFAULT_TSPL_LAYOUT, type TsplLayout, type HAlign, type TsplRow,
} from "@/hooks/useBTPrinter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bluetooth, BluetoothConnected, BluetoothOff, BluetoothSearching,
  Printer, CheckCircle2, XCircle, AlertCircle, RefreshCw, Zap,
  ChevronDown, ChevronUp, Clock, FileText, Eye, EyeOff, AlignLeft,
  AlignCenter, AlignRight, Ruler,
} from "lucide-react";

// ─── Statuslar ────────────────────────────────────────────────────────────────
const STATUS_META = {
  idle:       { label: "Tayyor",           color: "bg-gray-100 text-gray-700 border-gray-200",                     icon: Bluetooth },
  connecting: { label: "Ulanmoqda...",     color: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",       icon: BluetoothSearching },
  printing:   { label: "Chop etmoqda...", color: "bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse", icon: Printer },
  done:       { label: "✅ Chop etildi!",  color: "bg-green-100 text-green-700 border-green-200",                 icon: CheckCircle2 },
  error:      { label: "❌ Xatolik",       color: "bg-red-100 text-red-700 border-red-200",                       icon: XCircle },
};

// ─── Elementlar meta ──────────────────────────────────────────────────────────
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

const DEFAULT_TEST_ORDER = {
  id: 42,
  storeName: "Alshib shop",
  serviceTypeName: "Kimyoviy tozalash",
  quantity: "3",
  unit: "dona",
  shelf: "A-12",
  clientName: "Alisher Karimov",
  createdAt: new Date().toISOString(),
};

// ─── Preview SVG ──────────────────────────────────────────────────────────────
function LabelPreview({ rows, layout }: { rows: TsplRow[]; layout: TsplLayout }) {
  const DPM       = 8;
  const widthDots = layout.widthMm * DPM;
  const leftDots  = layout.leftMarginMm * DPM;
  const cw        = widthDots - leftDots * 2;

  const maxY = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h + 10 : 100;
  const heightDots = layout.heightMm > 0 ? layout.heightMm * DPM : maxY;

  const PREVIEW_W = 240;
  const scale     = PREVIEW_W / widthDots;
  const PREVIEW_H = Math.round(heightDots * scale);

  const toX = (d: number) => Math.round(d * scale);
  const toY = (d: number) => Math.round(d * scale);
  const toW = (d: number) => Math.max(1, Math.round(d * scale));
  const toH = (d: number) => Math.max(1, Math.round(d * scale));

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground font-mono">
        {layout.widthMm}mm × {layout.heightMm > 0 ? layout.heightMm + "mm" : "auto"} · {widthDots}×{heightDots} dots
      </p>
      <div className="border-2 border-dashed border-gray-300 rounded overflow-hidden bg-white shadow-md" style={{ width: PREVIEW_W, minHeight: PREVIEW_H }}>
        <svg width={PREVIEW_W} height={Math.max(PREVIEW_H, 80)} xmlns="http://www.w3.org/2000/svg">
          {/* background */}
          <rect x={0} y={0} width={PREVIEW_W} height={Math.max(PREVIEW_H, 80)} fill="white" />
          {/* margin guides */}
          <rect x={toX(leftDots)} y={0} width={toW(cw)} height={Math.max(PREVIEW_H,80)} fill="#f8fafc" stroke="none" />

          {rows.map((row, i) => {
            const color = ELEMENT_COLORS[row.key] ?? "#94a3b8";
            if (row.kind === "bar") {
              return <rect key={i} x={toX(leftDots)} y={toY(row.y)} width={toW(cw)} height={Math.max(1, toH(2))} fill={color} />;
            }
            if (row.kind === "qr") {
              const qrW = toW(80); const qrH = toW(80);
              let qx = toX(leftDots);
              if (row.align === "center") qx = toX(leftDots) + Math.round((toW(cw) - qrW) / 2);
              if (row.align === "right")  qx = toX(leftDots) + toW(cw) - qrW;
              return (
                <g key={i}>
                  <rect x={qx} y={toY(row.y)} width={qrW} height={qrH} fill={color} opacity={0.15} rx={2} />
                  <text x={qx + qrW/2} y={toY(row.y) + qrH/2 + 4} textAnchor="middle" fontSize={Math.max(7, toH(12))} fill={color} fontFamily="monospace">QR</text>
                </g>
              );
            }
            // block
            const bh = Math.max(toH(row.h), 8);
            return (
              <g key={i}>
                <rect x={toX(leftDots)} y={toY(row.y)} width={toW(cw)} height={bh} fill={color} opacity={0.12} rx={1} />
                <text
                  x={row.align === "center" ? toX(leftDots) + toW(cw)/2 : row.align === "right" ? toX(leftDots) + toW(cw) - 2 : toX(leftDots) + 2}
                  y={toY(row.y) + bh/2 + 3}
                  textAnchor={row.align === "center" ? "middle" : row.align === "right" ? "end" : "start"}
                  fontSize={Math.max(6, Math.min(9, toH(row.h) - 2))}
                  fill={color}
                  fontFamily="monospace"
                  fontWeight={row.key === "storeName" ? "bold" : "normal"}
                >
                  {(row.text ?? row.label).slice(0, 32)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Element row ──────────────────────────────────────────────────────────────
function ElementRow({
  elKey, config, onChange,
}: {
  elKey: string;
  config: { show: boolean; align: HAlign };
  onChange: (c: { show: boolean; align: HAlign }) => void;
}) {
  const label = ELEMENT_LABELS[elKey] ?? elKey;
  const color = ELEMENT_COLORS[elKey] ?? "#94a3b8";
  const isSep = elKey.startsWith("sep");

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${config.show ? "bg-muted/40" : "opacity-40"}`}>
      {/* renkli nuqta */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />

      {/* nom */}
      <span className="text-xs flex-1 truncate">{label}</span>

      {/* ko'rsat/yashir */}
      <button
        type="button"
        onClick={() => onChange({ ...config, show: !config.show })}
        className="p-1 rounded hover:bg-muted transition-colors"
        title={config.show ? "Yashir" : "Ko'rsat"}
      >
        {config.show ? <Eye className="w-3.5 h-3.5 text-foreground" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {/* hizalash — separator uchun kerak emas */}
      {!isSep && (
        <div className="flex border rounded overflow-hidden">
          {(["left", "center", "right"] as HAlign[]).map(a => (
            <button
              key={a}
              type="button"
              disabled={!config.show}
              onClick={() => onChange({ ...config, align: a })}
              className={`p-1 transition-colors ${config.align === a ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              title={a === "left" ? "Chap" : a === "center" ? "Markazda" : "O'ng"}
            >
              {a === "left"   ? <AlignLeft   className="w-3 h-3" /> :
               a === "center" ? <AlignCenter className="w-3 h-3" /> :
                                <AlignRight  className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
export default function BluetoothPrinterPanel() {
  const {
    printTspl, printRaw, connect, disconnect,
    status, errorMsg, printerName, profileName,
    serviceUuid, charUuid, allServices, isConnected, isSupported,
    printLog, labelBytes,
  } = useBTPrinterContext();

  const [testOrder, setTestOrder] = useState(DEFAULT_TEST_ORDER);
  const [layout, setLayout]       = useState<TsplLayout>(DEFAULT_TSPL_LAYOUT);
  const [showServices, setShowServices] = useState(false);
  const [showLog, setShowLog]       = useState(false);
  const [showDesigner, setShowDesigner] = useState(true);

  const isBusy = status === "connecting" || status === "printing";
  const StatusIcon = STATUS_META[status].icon;

  const getOrder = () => ({
    ...testOrder,
    quantity: parseFloat(testOrder.quantity) || 1,
    createdAt: new Date().toISOString(),
  });

  const rows = computeTsplRows(getOrder(), layout);

  const handleTsplPrint = () => printTspl(getOrder(), layout);

  const handleBrowserPrint = () => {
    const html = buildReceiptHtml(getOrder());
    const w = window.open("", "_blank", "width=300,height=600");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.print(); w.onafterprint = () => w.close(); };
  };

  const handleRawTest = () => {
    const data = buildTsplReceipt(getOrder(), layout);
    printRaw(data, "TSPL raw");
  };

  const setEl = (key: keyof TsplLayout["elements"], cfg: { show: boolean; align: HAlign }) => {
    setLayout(prev => ({ ...prev, elements: { ...prev.elements, [key]: cfg } }));
  };

  const numField = (label: string, key: keyof typeof testOrder, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-8 text-sm"
        value={testOrder[key]}
        placeholder={placeholder}
        onChange={e => setTestOrder(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

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
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Qurilma</span>
              <p className="font-medium truncate">{printerName ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Profil</span>
              <p className="font-mono text-xs">{profileName || "—"}</p>
            </div>
            {serviceUuid && <div className="col-span-2"><span className="text-xs text-muted-foreground">Service</span><p className="font-mono text-xs break-all text-blue-600">{serviceUuid}</p></div>}
            {charUuid    && <div className="col-span-2"><span className="text-xs text-muted-foreground">Char</span><p className="font-mono text-xs break-all text-green-600">{charUuid}</p></div>}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant={isConnected ? "outline" : "default"}
              onClick={connect}
              disabled={isBusy}
            >
              {isBusy
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Ulanmoqda...</>
                : isConnected
                ? <><RefreshCw className="w-4 h-4 mr-2" />Boshqasini ulash</>
                : <><Bluetooth className="w-4 h-4 mr-2" />Bluetooth ulash</>}
            </Button>
            {isConnected && (
              <Button variant="destructive" size="icon" onClick={disconnect} disabled={isBusy} title="Uzish">
                <BluetoothOff className="w-4 h-4" />
              </Button>
            )}
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              Ma'lum profil ({PRINTER_PROFILES.length} ta)
            </summary>
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
              <span className="flex items-center gap-2"><Bluetooth className="w-4 h-4" />UUID lar ({allServices.length})</span>
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
            <span className="flex items-center gap-2"><Ruler className="w-4 h-4" />Label dizayneri</span>
            {showDesigner ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        {showDesigner && (
          <CardContent className="px-4 pb-4 space-y-5">

            {/* O'lchamlar */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">O'lchamlar (mm)</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Kenglik</Label>
                  <Input
                    type="number" className="h-8 text-sm"
                    value={layout.widthMm}
                    min={20} max={120}
                    onChange={e => setLayout(prev => ({ ...prev, widthMm: parseInt(e.target.value) || 58 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Balandlik (0=auto)</Label>
                  <Input
                    type="number" className="h-8 text-sm"
                    value={layout.heightMm}
                    min={0} max={300}
                    onChange={e => setLayout(prev => ({ ...prev, heightMm: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chap chegara</Label>
                  <Input
                    type="number" className="h-8 text-sm"
                    value={layout.leftMarginMm}
                    min={0} max={20}
                    step={0.5}
                    onChange={e => setLayout(prev => ({ ...prev, leftMarginMm: parseFloat(e.target.value) || 3 }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[{w:58,h:0},{w:58,h:40},{w:58,h:60},{w:80,h:0},{w:40,h:30}].map(p => (
                  <button
                    key={`${p.w}x${p.h}`}
                    type="button"
                    onClick={() => setLayout(prev => ({ ...prev, widthMm: p.w, heightMm: p.h }))}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${layout.widthMm===p.w && layout.heightMm===p.h ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"}`}
                  >
                    {p.w}×{p.h || "auto"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Elementlar */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Elementlar (Ko'z=ko'rsat/yashir · L/C/R=hizalash)</p>
              <div className="space-y-1">
                {(Object.keys(layout.elements) as Array<keyof TsplLayout["elements"]>).map(key => (
                  <ElementRow
                    key={key}
                    elKey={key}
                    config={layout.elements[key]}
                    onChange={cfg => setEl(key, cfg)}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Oldindan ko'rish (preview)</p>
              <LabelPreview rows={rows} layout={layout} />
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setLayout(DEFAULT_TSPL_LAYOUT)}>
              Standart holatga qaytarish
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── TEST CHEK MA'LUMOTLARI ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" /> Test buyurtma
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {numField("Do'kon", "storeName")}
            {numField("Xizmat turi", "serviceTypeName")}
            {numField("Miqdor", "quantity")}
            {numField("O'lchov", "unit")}
            {numField("Javon", "shelf")}
            {numField("Mijoz", "clientName")}
          </div>

          <Separator />

          {/* TSPL BLE */}
          <Button className="w-full h-12 text-base font-bold" onClick={handleTsplPrint} disabled={isBusy}>
            {status === "printing"
              ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Chop etmoqda... ({labelBytes}B)</>
              : status === "done"
              ? <><CheckCircle2 className="w-5 h-5 mr-2" />Chop etildi!</>
              : <><Printer className="w-5 h-5 mr-2" />TSPL chop et (XP-365B BLE)</>}
          </Button>

          {/* Brauzer fallback */}
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleBrowserPrint}>
            <FileText className="w-4 h-4 mr-2" />
            Brauzer orqali chop et (BLE shart emas)
          </Button>

          {/* Raw TSPL */}
          <Button className="w-full" variant="outline" size="sm" onClick={handleRawTest} disabled={isBusy}>
            <Zap className="w-4 h-4 mr-2" />
            TSPL raw baytlar (diagnostika)
          </Button>

          {!isConnected && status === "idle" && (
            <p className="text-xs text-center text-muted-foreground">TSPL tugmasi bosilganda qurilma tanlash oynasi ochiladi</p>
          )}
        </CardContent>
      </Card>

      {/* ── CHOP TARIXI ── */}
      {printLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-sm font-semibold" onClick={() => setShowLog(v => !v)}>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" />Tarixi ({printLog.length})</span>
              {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showLog && (
            <CardContent className="px-4 pb-4 space-y-2">
              {printLog.map((e, i) => (
                <div key={i} className={`flex items-start gap-3 p-2 rounded text-xs ${e.status==="done" ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                  {e.status==="done" ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                  <div>
                    <span className="font-medium">{e.time}</span>
                    <span className="text-muted-foreground ml-2">{e.ms}ms</span>
                    <p className="text-muted-foreground break-all mt-0.5">{e.msg}</p>
                  </div>
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
              <p>Web Bluetooth faqat <strong>Chrome Android</strong> da va <strong>HTTPS</strong> saytida ishlaydi. Replit preview da BLOKLANADI.</p>
              <p>Printer: <strong>Xprinter XP-365B</strong> · Protokol: <strong>TSPL</strong> · 203 DPI</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
