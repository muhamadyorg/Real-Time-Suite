import { Printer, Loader2, CheckCircle2, AlertCircle, Bluetooth } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBTPrinterContext } from "@/hooks/useBTPrinter";
import { buildReceiptHtml } from "@/lib/printUtils";
import { cn } from "@/lib/utils";

interface PrintLabelButtonProps {
  order: any;
  variant?: "icon" | "full";
  className?: string;
}

export function PrintLabelButton({ order, variant = "full", className }: PrintLabelButtonProps) {
  const {
    printTspl, connect, status, errorMsg,
    printerName, profileName, isConnected, isSupported,
  } = useBTPrinterContext();

  const hasBluetooth = isSupported && !!(navigator as any).bluetooth;
  const isPrinting   = status === "connecting" || status === "printing";

  /** BLE mavjud bo'lsa TSPL, yo'qsa brauzer print */
  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasBluetooth) {
      printTspl(order);
    } else {
      // BLE yo'q — brauzer orqali chop etish
      const html = buildReceiptHtml(order);
      const w = window.open("", "_blank", "width=300,height=600");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.onload = () => { w.focus(); w.print(); w.onafterprint = () => w.close(); };
    }
  };

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    connect();
  };

  if (variant === "icon") {
    return (
      <div className="flex items-center gap-1">
        {hasBluetooth && !isConnected && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={isPrinting}
            title="Printer ulash"
            className={cn("p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-all", className)}
          >
            <Bluetooth className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          title={
            isPrinting     ? "Chop etilmoqda..." :
            !hasBluetooth  ? "Brauzer orqali chop et" :
            isConnected    ? `Chop et (${printerName ?? "ulangan"})` :
            "Chop et (BLE)"
          }
          className={cn(
            "p-1.5 rounded-lg transition-all",
            status === "done"  ? "text-green-600" :
            status === "error" ? "text-destructive" :
            "text-muted-foreground hover:text-primary hover:bg-muted",
            className
          )}
        >
          {isPrinting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : status === "done"
            ? <CheckCircle2 className="w-4 h-4" />
            : status === "error"
            ? <AlertCircle className="w-4 h-4" />
            : <Printer className="w-4 h-4" />
          }
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasBluetooth && !isConnected && (
        <Button
          type="button"
          variant="outline"
          onClick={handleConnect}
          disabled={isPrinting}
          className={cn("w-full gap-2 border-blue-400 text-blue-600 hover:bg-blue-50", className)}
        >
          <Bluetooth className="w-4 h-4" />
          Printer ulash (BLE)
        </Button>
      )}

      <Button
        type="button"
        onClick={handlePrint}
        disabled={isPrinting}
        className={cn(
          "w-full gap-2",
          status === "error"
            ? "bg-destructive hover:bg-destructive/90 text-white"
            : "bg-green-600 hover:bg-green-700 text-white",
          className
        )}
      >
        {isPrinting ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{status === "connecting" ? "Ulanmoqda..." : "Chop etilmoqda..."}</>
        ) : status === "done" ? (
          <><CheckCircle2 className="w-4 h-4" />Chop etildi!</>
        ) : status === "error" ? (
          <><AlertCircle className="w-4 h-4" />Qayta urinish</>
        ) : (
          <>
            <Printer className="w-4 h-4" />
            {hasBluetooth ? (
              <>Chek chop et (TSPL){isConnected && printerName && <span className="text-xs opacity-75 ml-1">({printerName})</span>}</>
            ) : (
              "Chek chop et (Brauzer)"
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
    </div>
  );
}
