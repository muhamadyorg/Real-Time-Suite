import { Card, CardContent } from "@/components/ui/card";
import { Order } from "@workspace/api-client-react";
import { format } from "date-fns";

export function HighlightText({ text, search }: { text?: string | null, search?: string }) {
  if (!text) return null;
  if (!search) return <span>{text}</span>;
  
  const parts = text.toString().split(new RegExp(`(${search})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() ? 
          <mark key={i} className="bg-yellow-300 text-black px-1 rounded-sm">{part}</mark> : part
      )}
    </span>
  );
}

interface OrderCardProps {
  order: Order;
  search?: string;
  actionButton?: React.ReactNode;
}

export function OrderCard({ order, search = "", actionButton }: OrderCardProps) {
  return (
    <Card className="shadow-sm border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: order.status === 'new' ? 'var(--color-chart-1)' : order.status === 'accepted' ? 'var(--color-chart-4)' : 'var(--color-chart-3)' }}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="font-bold text-lg tracking-wider font-mono">
            <HighlightText text={order.orderId} search={search} />
          </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
            {format(new Date(order.createdAt), "HH:mm")}
          </div>
        </div>

        <div className="text-xl font-bold text-primary leading-tight">
          <HighlightText text={order.serviceTypeName} search={search} />
        </div>

        <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg border border-secondary">
          <span className="font-medium text-muted-foreground text-sm uppercase tracking-wider">Miqdor</span>
          <span className="text-xl font-black">
            <HighlightText text={order.quantity.toString()} search={search} /> {order.unit && <span className="text-muted-foreground text-base ml-1"><HighlightText text={order.unit} search={search} /></span>}
          </span>
        </div>

        <div className="grid gap-2 text-sm">
          {order.shelf && (
            <div className="flex justify-between items-center pb-1 border-b border-border/50">
              <span className="text-muted-foreground">Polka:</span>
              <span className="font-semibold text-foreground"><HighlightText text={order.shelf} search={search} /></span>
            </div>
          )}
          
          {order.clientName && (
            <div className="flex justify-between items-center pb-1 border-b border-border/50">
              <span className="text-muted-foreground">Mijoz:</span>
              <span className="font-medium truncate max-w-[200px]"><HighlightText text={order.clientName} search={search} /></span>
            </div>
          )}
        </div>

        {order.notes && (
          <div className="text-sm bg-accent/10 border border-accent/20 p-3 rounded-lg text-foreground italic mt-1">
            <span className="font-semibold block mb-1 text-accent-foreground/80 not-italic text-xs">Izoh:</span>
            <HighlightText text={order.notes} search={search} />
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-2 flex flex-col gap-1 bg-muted/30 p-2 rounded-md">
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
        
        {actionButton && (
          <div className="mt-2">
            {actionButton}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
