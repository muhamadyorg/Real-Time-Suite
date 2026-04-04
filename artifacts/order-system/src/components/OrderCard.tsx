import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { PrintLabelButton } from "./PrintLabelButton";
import { Truck } from "lucide-react";

export function HighlightText({ text, search }: { text?: string | null, search?: string }) {
  if (!text) return null;
  if (!search || !search.trim()) return <span>{text}</span>;
  
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.toString().split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() ? 
          <mark key={i} className="bg-yellow-300 dark:bg-yellow-500 text-black px-0.5 rounded-sm">{part}</mark> : part
      )}
    </span>
  );
}

interface OrderCardProps {
  order: any;
  search?: string;
  actionButton?: React.ReactNode;
  onOrderClick?: () => void;
  canPrint?: boolean;
  canMarkDelivered?: boolean;
  onDeliver?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: "border-l-blue-500",
  accepted: "border-l-amber-500",
  ready: "border-l-green-500",
  topshirildi: "border-l-purple-500",
};

export function OrderCard({ order, search = "", actionButton, onOrderClick, canPrint, canMarkDelivered, onDeliver }: OrderCardProps) {
  return (
    <Card className={`shadow-sm border-l-4 transition-all hover:shadow-md ${STATUS_COLORS[order.status] ?? "border-l-primary"}`}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOrderClick}
              className={`font-bold text-lg tracking-wider font-mono ${onOrderClick ? 'text-primary hover:underline cursor-pointer' : 'cursor-default'}`}
              disabled={!onOrderClick}
            >
              <HighlightText text={order.orderId} search={search} />
            </button>
            {order.splitGroup && order.splitPart != null && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700 shrink-0">
                Part {order.splitPart}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(canPrint !== false) && <PrintLabelButton order={order} variant="icon" />}
            <div className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <HighlightText text={format(new Date(order.createdAt), "HH:mm")} search={search} />
            </div>
          </div>
        </div>

        <div className="text-xl font-bold text-primary leading-tight">
          <HighlightText text={order.serviceTypeName} search={search} />
        </div>

        <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg border border-secondary">
          <span className="font-medium text-muted-foreground text-sm uppercase tracking-wider">Miqdor</span>
          <span className="text-xl font-black">
            <HighlightText text={String(order.quantity)} search={search} />
            {order.unit && <span className="text-muted-foreground text-base ml-1"><HighlightText text={order.unit} search={search} /></span>}
          </span>
        </div>

        <div className="grid gap-2 text-sm">
          {order.shelf && (
            <div className="flex justify-between items-center pb-1 border-b border-border/50">
              <span className="text-muted-foreground">Qolib:</span>
              <span className="font-semibold font-mono text-foreground"><HighlightText text={order.shelf} search={search} /></span>
            </div>
          )}

          {order.product && (
            <div className="flex justify-between items-center pb-1 border-b border-border/50">
              <span className="text-muted-foreground">Mahsulot:</span>
              <span className="font-semibold text-foreground"><HighlightText text={order.product} search={search} /></span>
            </div>
          )}
          
          {order.clientName && (
            <div className="flex justify-between items-center pb-1 border-b border-border/50">
              <span className="text-muted-foreground">Mijoz:</span>
              <span className="font-medium truncate max-w-[180px]"><HighlightText text={order.clientName} search={search} /></span>
            </div>
          )}
        </div>

        {order.notes && (
          <div className="text-sm bg-accent/10 border border-accent/20 p-3 rounded-lg text-foreground italic mt-1">
            <span className="font-semibold block mb-1 text-accent-foreground/80 not-italic text-xs">Izoh:</span>
            <HighlightText text={order.notes} search={search} />
          </div>
        )}

        <div className="text-xs text-muted-foreground flex flex-col gap-1 bg-muted/30 p-2 rounded-md">
          <div className="flex justify-between">
            <span>Yaratdi:</span>
            <span className="font-medium text-foreground"><HighlightText text={order.createdByName} search={search} /></span>
          </div>
          {order.acceptedByName && (
            <div className="flex justify-between">
              <span>Qabul qildi:</span>
              <span className="font-medium text-foreground"><HighlightText text={order.acceptedByName} search={search} /></span>
            </div>
          )}
        </div>
        
        {canMarkDelivered && order.status === "ready" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeliver?.(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-sm transition-all shadow-md"
          >
            <Truck className="w-5 h-5" />
            Olib ketildi
          </button>
        )}
        {actionButton && (
          <div className="mt-1">
            {actionButton}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
