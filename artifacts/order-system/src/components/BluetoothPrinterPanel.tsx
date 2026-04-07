import { useState } from "react";
import { buildReceiptHtml } from "@/lib/printUtils";
import {
  useBTPrinterContext,
  PRINTER_PROFILES,
  buildTsplReceipt,
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
  ChevronDown, ChevronUp, Clock, FileText,
} from "lucide-react";

const STATUS_META = {
  idle:       { label: "Tayyor",            color: "bg-gray-100 text-gray-700 border-gray-200",                          icon: Bluetooth },
  connecting: { label: "Ulanmoqda...",      color: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",            icon: BluetoothSearching },
  printing:   { label: "Chop etmoqda...",   color: "bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse",      icon: Printer },
  done:       { label: "✅ Muvaffaqiyatli!", color: "bg-green-100 text-green-700 border-green-200",                      icon: CheckCircle2 },
  error:      { label: "❌ Xatolik",         color: "bg-red-100 text-red-700 border-red-200",                            icon: XCircle },
};

const DEFAULT_ORDER = {
  id: 42,
  storeName: "Alshib shop",
  serviceTypeName: "Kimyoviy tozalash",
  quantity: "3",
  unit: "dona",
  shelf: "A-12",
  clientName: "Alisher Karimov",
  createdAt: new Date().toISOString(),
};

export default function BluetoothPrinterPanel() {
  const {
    printTspl, printRaw, connect, disconnect,
    status, errorMsg,
    printerName, profileName, serviceUuid, charUuid,
    allServices, isConnected, isSupported,
    printLog, labelBytes,
  } = useBTPrinterContext();

  const [testOrder, setTestOrder] = useState(DEFAULT_ORDER);
  const [showServices, setShowServices] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const isBusy = status === "connecting" || status === "printing";
  const StatusIcon = STATUS_META[status].icon;

  const getOrder = () => ({
    ...testOrder,
    quantity: parseFloat(testOrder.quantity) || 1,
    createdAt: new Date().toISOString(),
  });

  const handleTsplPrint = () => printTspl(getOrder());

  const handleBrowserPrint = () => {
    const html = buildReceiptHtml(getOrder());
    const w = window.open("", "_blank", "width=300,height=600");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); w.onafterprint = () => w.close(); };
  };

  const handleRawTest = () => {
    const data = buildTsplReceipt(getOrder());
    printRaw(data, "TSPL raw test");
  };

  const field = (label: string, key: keyof typeof testOrder, type: "text" | "number" = "text") => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-8 text-sm"
        type={type}
        value={testOrder[key]}
        onChange={e => setTestOrder(prev => ({ ...prev, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
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
              {errorMsg && (
                <p className="text-xs mt-0.5 font-mono whitespace-pre-wrap break-all opacity-90">{errorMsg}</p>
              )}
            </div>
          </div>
          {isConnected
            ? <BluetoothConnected className="w-5 h-5 text-green-600" />
            : <BluetoothOff className="w-5 h-5 text-gray-400" />
          }
        </CardContent>
      </Card>

      {/* ── QURILMA MA'LUMOTI ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bluetooth className="w-4 h-4" /> Printer qurilma
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Qurilma nomi</span>
              <p className="font-medium truncate">{printerName ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Profil</span>
              <p className="font-medium font-mono text-xs">{profileName || "—"}</p>
            </div>
            {serviceUuid && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Service UUID</span>
                <p className="font-mono text-xs break-all text-blue-600">{serviceUuid}</p>
              </div>
            )}
            {charUuid && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Characteristic UUID</span>
                <p className="font-mono text-xs break-all text-green-600">{charUuid}</p>
              </div>
            )}
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
                : <><Bluetooth className="w-4 h-4 mr-2" />Bluetooth ulash</>
              }
            </Button>
            {isConnected && (
              <Button variant="destructive" size="icon" onClick={disconnect} disabled={isBusy} title="Uzish">
                <BluetoothOff className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Ma'lum profil ro'yxati */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              Ma'lum printer profillari ({PRINTER_PROFILES.length} ta)
            </summary>
            <div className="mt-2 space-y-1">
              {PRINTER_PROFILES.map(p => (
                <div key={p.char} className="flex items-center gap-2">
                  <Badge variant={profileName === p.name ? "default" : "outline"} className="text-xs font-normal">
                    {p.name}
                  </Badge>
                  <span className="font-mono text-muted-foreground truncate">{p.svc.slice(4,8)}/{p.char.slice(4,8)}</span>
                  {profileName === p.name && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto flex-shrink-0" />}
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* ── BLE SERVICES (scan natijalari) ── */}
      {allServices.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button
              className="flex items-center justify-between w-full text-sm font-semibold"
              onClick={() => setShowServices(v => !v)}
            >
              <span className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4" />
                Topilgan UUID lar ({allServices.length} servis)
              </span>
              {showServices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showServices && (
            <CardContent className="px-4 pb-4 space-y-3">
              {allServices.map(svc => (
                <div key={svc.uuid} className="rounded-lg border p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Service:</p>
                  <p className="font-mono text-xs break-all">{svc.uuid}</p>
                  {svc.chars.map(ch => (
                    <div key={ch.uuid} className={`ml-3 pl-3 border-l-2 ${ch.isWritable ? "border-green-400" : "border-gray-200"}`}>
                      <p className="font-mono text-xs break-all">{ch.uuid}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ch.props.map(p => (
                          <Badge key={p} variant={p.includes("write") ? "default" : "secondary"} className="text-xs py-0 h-4">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── TEST CHEK ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" /> Test chek ma'lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Do'kon nomi", "storeName")}
            {field("Xizmat turi", "serviceTypeName")}
            {field("Miqdor", "quantity")}
            {field("O'lchov", "unit")}
            {field("Javon", "shelf")}
            {field("Mijoz", "clientName")}
          </div>

          <Separator />

          {/* TSPL BLE — asosiy tugma */}
          <Button
            className="w-full h-12 text-base font-bold"
            onClick={handleTsplPrint}
            disabled={isBusy}
          >
            {status === "printing"
              ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Chop etmoqda... ({labelBytes} bayt)</>
              : status === "done"
              ? <><CheckCircle2 className="w-5 h-5 mr-2" />Chop etildi!</>
              : <><Printer className="w-5 h-5 mr-2" />TSPL chop et (XP-365B BLE)</>
            }
          </Button>

          {/* Brauzer chop — zaxira */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={handleBrowserPrint}
          >
            <FileText className="w-4 h-4 mr-2" />
            Brauzer orqali chop et (BLE shart emas)
          </Button>

          {/* Raw TSPL test */}
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={handleRawTest}
            disabled={isBusy}
          >
            <Zap className="w-4 h-4 mr-2" />
            TSPL raw baytlar yuborish (diagnostika)
          </Button>

          {!isConnected && status === "idle" && (
            <p className="text-xs text-center text-muted-foreground">
              TSPL tugmasi bosilganda BLE qurilma tanlash oynasi avtomatik ochiladi
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── CHOP TARIXI ── */}
      {printLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button
              className="flex items-center justify-between w-full text-sm font-semibold"
              onClick={() => setShowLog(v => !v)}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Chop tarixi ({printLog.length} ta)
              </span>
              {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showLog && (
            <CardContent className="px-4 pb-4 space-y-2">
              {printLog.map((entry, i) => (
                <div key={i} className={`flex items-start gap-3 p-2 rounded-lg text-xs ${entry.status === "done" ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                  {entry.status === "done"
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.time}</span>
                      <span className="text-muted-foreground">{entry.ms}ms</span>
                    </div>
                    <p className="text-muted-foreground break-all mt-0.5">{entry.msg}</p>
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
              <p>Web Bluetooth faqat <strong>Chrome Android</strong> da va <strong>HTTPS</strong> saytida ishlaydi.</p>
              <p>Replit preview da BLOKLANADI — to'g'ridan-to'g'ri <strong>zakaz.muhamadyorg.uz</strong> ga kiring.</p>
              <p className="mt-1">Printer: <strong>Xprinter XP-365B</strong> · Protokol: <strong>TSPL</strong> · 58mm × avtomatik balandlik</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
