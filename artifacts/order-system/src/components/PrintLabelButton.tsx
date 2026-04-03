import { Printer, Loader2, CheckCircle2, AlertCircle, Bluetooth } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBTPrinter } from "@/hooks/useBTPrinter";
import { cn } from "@/lib/utils";

interface PrintLabelButtonProps {
  order: any;
  variant?: "icon" | "full";
  className?: string;
}

export function PrintLabelButton({ order, variant = "full", className }: PrintLabelButtonProps) {
  const { print, status, errorMsg, printerName, isSupported } = useBTPrinter();

  if (!isSupported) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    print(order);
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "connecting" || status === "printing"}
        title={
          status === "connecting" ? "Ulanmoqda..." :
          status === "printing" ? "Chop etilmoqda..." :
          status === "done" ? "Chop etildi!" :
          status === "error" ? (errorMsg ?? "Xatolik") :
          `Nakleyka chop etish${printerName ? ` (${printerName})` : ""}`
        }
        className={cn(
          "p-1.5 rounded-lg transition-all",
          status === "done" ? "text-green-600" :
          status === "error" ? "text-destructive" :
          "text-muted-foreground hover:text-primary hover:bg-muted",
          className
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
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={status === "connecting" || status === "printing"}
        className={cn("w-full gap-2", className)}
      >
        {status === "connecting" ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Ulanmoqda...</>
        ) : status === "printing" ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Chop etilmoqda...</>
        ) : status === "done" ? (
          <><CheckCircle2 className="w-4 h-4 text-green-600" />Chop etildi!</>
        ) : status === "error" ? (
          <><AlertCircle className="w-4 h-4 text-destructive" />Qayta urinish</>
        ) : (
          <><Printer className="w-4 h-4" />Nakleyka chop etish{printerName && <span className="text-xs text-muted-foreground ml-1">({printerName})</span>}</>
        )}
      </Button>

      {status === "error" && errorMsg && errorMsg !== "Bekor qilindi" && (
        <p className="text-xs text-destructive text-center">{errorMsg}</p>
      )}

      {status === "idle" && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <Bluetooth className="w-3 h-3" />
          XPrinter X-365B • 58×40mm
        </p>
      )}
    </div>
  );
}
