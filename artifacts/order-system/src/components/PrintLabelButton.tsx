import { Printer, Loader2, CheckCircle2, AlertCircle, Bluetooth, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBTPrinter } from "@/hooks/useBTPrinter";
import { cn } from "@/lib/utils";

interface PrintLabelButtonProps {
  order: any;
  variant?: "icon" | "full";
  className?: string;
}

function buildBrowserPrintHtml(order: any): string {
  const widthMm = 58;
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString("uz-UZ")
    : new Date().toLocaleString("uz-UZ");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${widthMm}mm auto; margin: 2mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', monospace; }
  body { width: ${widthMm - 4}mm; font-size: 11px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 16px; font-weight: bold; }
  .medium { font-size: 13px; font-weight: bold; }
  .hr { border-top: 1px dashed #000; margin: 3px 0; }
  .row { display: flex; justify-content: space-between; }
  .lbl { color: #555; }
</style>
</head>
<body>
  <div class="center big">№${order.id ?? "----"}</div>
  <div class="hr"></div>
  <div class="row"><span class="lbl">Xizmat:</span><span>${order.serviceTypeName ?? ""}</span></div>
  <div class="row"><span class="lbl">Mahsulot:</span><span>${order.product ?? ""}</span></div>
  <div class="row"><span class="lbl">Miqdor:</span><span class="bold">${order.quantity ?? ""} ${order.unit ?? ""}</span></div>
  <div class="row"><span class="lbl">Javon:</span><span class="bold">${order.shelf ?? ""}</span></div>
  <div class="hr"></div>
  <div class="row"><span class="lbl">Mijoz:</span><span>${order.clientName ?? ""}</span></div>
  <div class="center" style="font-size:10px;margin-top:2px">${dateStr}</div>
</body>
</html>`;
}

function openBrowserPrint(order: any) {
  const html = buildBrowserPrintHtml(order);
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) { alert("Pop-up bloklangan! Brauzerni ruxsat bering."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

export function PrintLabelButton({ order, variant = "full", className }: PrintLabelButtonProps) {
  const { print, status, errorMsg, printerName, profileName, isSupported } = useBTPrinter();

  const handleBTClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    print(order);
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openBrowserPrint(order);
  };

  if (variant === "icon") {
    return (
      <div className="flex items-center gap-1">
        {/* Browser PDF print — always available */}
        <button
          type="button"
          onClick={handlePdfClick}
          title="Browser orqali chop et (PDF)"
          className={cn(
            "p-1.5 rounded-lg transition-all text-muted-foreground hover:text-green-600 hover:bg-green-50",
            className
          )}
        >
          <FileText className="w-4 h-4" />
        </button>

        {/* BT print — only if supported */}
        {isSupported && (
          <button
            type="button"
            onClick={handleBTClick}
            disabled={status === "connecting" || status === "printing"}
            title={
              status === "connecting" ? "Ulanmoqda..." :
              status === "printing"   ? "Chop etilmoqda..." :
              status === "done"       ? "Chop etildi!" :
              status === "error"      ? (errorMsg ?? "Xatolik — qayta bosing") :
              `BT: Nakleyka${printerName ? ` (${printerName})` : ""}`
            }
            className={cn(
              "p-1.5 rounded-lg transition-all",
              status === "done"  ? "text-green-600" :
              status === "error" ? "text-destructive" :
              "text-muted-foreground hover:text-primary hover:bg-muted",
            )}
          >
            {status === "connecting" || status === "printing"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : status === "done"
              ? <CheckCircle2 className="w-4 h-4" />
              : status === "error"
              ? <AlertCircle className="w-4 h-4" />
              : <Printer className="w-4 h-4" />
            }
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Browser PDF print — always visible */}
      <Button
        type="button"
        variant="default"
        onClick={handlePdfClick}
        className={cn("w-full gap-2 bg-green-600 hover:bg-green-700 text-white", className)}
      >
        <FileText className="w-4 h-4" />
        Browser orqali chop et
      </Button>

      {/* BLE ESC/POS print — only if supported */}
      {isSupported && (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handleBTClick}
            disabled={status === "connecting" || status === "printing"}
            className={cn(
              "w-full gap-2",
              status === "error" && "border-destructive text-destructive hover:bg-destructive/5",
            )}
          >
            {status === "connecting" ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Ulanmoqda...</>
            ) : status === "printing" ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Chop etilmoqda...</>
            ) : status === "done" ? (
              <><CheckCircle2 className="w-4 h-4 text-green-600" />BT: Chop etildi!</>
            ) : status === "error" ? (
              <><AlertCircle className="w-4 h-4" />BT: Qayta urinish</>
            ) : (
              <>
                <Bluetooth className="w-4 h-4" />
                BT: Nakleyka (ESC/POS)
                {printerName && (
                  <span className="text-xs text-muted-foreground ml-1 truncate">({printerName})</span>
                )}
              </>
            )}
          </Button>

          {status === "error" && errorMsg && (
            <p className="text-xs text-destructive text-center leading-tight px-1">{errorMsg}</p>
          )}
          {status === "done" && profileName && (
            <p className="text-xs text-muted-foreground text-center">{profileName}</p>
          )}
        </>
      )}
    </div>
  );
}
