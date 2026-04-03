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
  const { print, status, errorMsg, printerName, profileName, isSupported } = useBTPrinter();

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
          status === "printing"   ? "Chop etilmoqda..." :
          status === "done"       ? "Chop etildi!" :
          status === "error"      ? (errorMsg ?? "Xatolik — qayta bosing") :
          `Nakleyka chop etish${printerName ? ` (${printerName})` : ""}`
        }
        className={cn(
          "p-1.5 rounded-lg transition-all",
          status === "done"  ? "text-green-600" :
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
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={status === "connecting" || status === "printing"}
        className={cn(
          "w-full gap-2",
          status === "error" && "border-destructive text-destructive hover:bg-destructive/5",
          className
        )}
      >
        {status === "connecting" ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Ulanmoqda...</>
        ) : status === "printing" ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Chop etilmoqda...</>
        ) : status === "done" ? (
          <><CheckCircle2 className="w-4 h-4 text-green-600" />Chop etildi!</>
        ) : status === "error" ? (
          <><AlertCircle className="w-4 h-4" />Qayta urinish</>
        ) : (
          <>
            <Printer className="w-4 h-4" />
            Nakleyka chop etish
            {printerName && (
              <span className="text-xs text-muted-foreground ml-1 truncate">({printerName})</span>
            )}
          </>
        )}
      </Button>

      {/* Error message */}
      {status === "error" && errorMsg && (
        <p className="text-xs text-destructive text-center leading-tight px-1">{errorMsg}</p>
      )}

      {/* Connected + profile info */}
      {status === "done" && profileName && (
        <p className="text-xs text-muted-foreground text-center">{profileName}</p>
      )}

      {/* Idle hint */}
      {(status === "idle" || !status) && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <Bluetooth className="w-3 h-3" />
          Bluetooth • 30×30mm
        </p>
      )}
    </div>
  );
}
