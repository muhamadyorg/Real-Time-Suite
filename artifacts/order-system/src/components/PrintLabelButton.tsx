import { Printer, Loader2, CheckCircle2, AlertCircle, Bluetooth, BluetoothSearching } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBTPrinterContext } from "@/hooks/useBTPrinter";
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

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasBluetooth) {
      alert("Iltimos Chrome Android ishlatng — bu brauzer Web Bluetooth'ni qo'llab-quvvatlamaydi.");
      return;
    }
    connect();
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasBluetooth) {
      alert("Iltimos Chrome Android ishlatng — bu brauzer Web Bluetooth'ni qo'llab-quvvatlamaydi.");
      return;
    }
    printTspl(order);
  };

  const isPrinting = status === "connecting" || status === "printing";

  if (variant === "icon") {
    return (
      <div className="flex items-center gap-1">
        {/* Ulash tugmasi — faqat ulanmagan payt */}
        {hasBluetooth && !isConnected && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={isPrinting}
            title="Printer ulash"
            className={cn(
              "p-1.5 rounded-lg transition-all text-blue-500 hover:text-blue-700 hover:bg-blue-50",
              className
            )}
          >
            <BluetoothSearching className="w-4 h-4" />
          </button>
        )}

        {/* TSPL chop etish */}
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          title={
            isPrinting ? "Chop etilmoqda..." :
            isConnected ? `Chop et (${printerName ?? "ulangan"})` :
            "Chop et (avval Ulash bosing)"
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
      {/* Ulash tugmasi — faqat ulanmagan payt ko'rinadi */}
      {hasBluetooth && !isConnected && (
        <Button
          type="button"
          variant="outline"
          onClick={handleConnect}
          disabled={isPrinting}
          className={cn("w-full gap-2 border-blue-400 text-blue-600 hover:bg-blue-50", className)}
        >
          <BluetoothSearching className="w-4 h-4" />
          Printer ulash
        </Button>
      )}

      {/* TSPL chop etish */}
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
          <><Loader2 className="w-4 h-4 animate-spin" />
          {status === "connecting" ? "Ulanmoqda..." : "Chop etilmoqda..."}</>
        ) : status === "done" ? (
          <><CheckCircle2 className="w-4 h-4" />Chop etildi!</>
        ) : status === "error" ? (
          <><AlertCircle className="w-4 h-4" />Qayta urinish</>
        ) : (
          <>
            <Printer className="w-4 h-4" />
            Chek chop et
            {isConnected && printerName && (
              <span className="text-xs opacity-75 ml-1 truncate">({printerName})</span>
            )}
          </>
        )}
      </Button>

      {/* Xatolik xabari */}
      {status === "error" && errorMsg && (
        <p className="text-xs text-destructive text-center leading-tight px-1">{errorMsg}</p>
      )}

      {/* Muvaffaqiyatli chop profili */}
      {status === "done" && profileName && (
        <p className="text-xs text-muted-foreground text-center">{profileName}</p>
      )}

      {/* Ulanmagan holat xabari */}
      {!hasBluetooth && (
        <p className="text-xs text-muted-foreground text-center">
          Chrome Android kerak (BLE)
        </p>
      )}
    </div>
  );
}
