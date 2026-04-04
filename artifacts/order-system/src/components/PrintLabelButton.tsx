import { Printer, Loader2, CheckCircle2, AlertCircle, Bluetooth, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBTPrinterContext } from "@/hooks/useBTPrinter";
import { printOrderLabel } from "@/lib/printUtils";
import { cn } from "@/lib/utils";

interface PrintLabelButtonProps {
  order: any;
  variant?: "icon" | "full";
  className?: string;
}

export function PrintLabelButton({ order, variant = "full", className }: PrintLabelButtonProps) {
  const { print, status, errorMsg, printerName, profileName, isSupported } = useBTPrinterContext();

  const handleBTClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    print(order);
  };

  const handlePdfClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    printOrderLabel(order, 58);
  };

  if (variant === "icon") {
    return (
      <div className="flex items-center gap-1">
        {/* Browser print — always available */}
        <button
          type="button"
          onClick={handlePdfClick}
          title="Browser orqali chop et"
          className={cn(
            "p-1.5 rounded-lg transition-all text-muted-foreground hover:text-green-600 hover:bg-green-50",
            className
          )}
        >
          <FileText className="w-4 h-4" />
        </button>

        {/* BT print — only if Bluetooth supported */}
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
              `BT: ${printerName ?? "Nakleyka"}`
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
      {/* Browser print — always visible, no BLE needed */}
      <Button
        type="button"
        onClick={handlePdfClick}
        className={cn("w-full gap-2 bg-green-600 hover:bg-green-700 text-white", className)}
      >
        <FileText className="w-4 h-4" />
        Nakleyka chop et (Browser)
      </Button>

      {/* BLE ESC/POS — only if Bluetooth supported */}
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
                BT: ESC/POS
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
