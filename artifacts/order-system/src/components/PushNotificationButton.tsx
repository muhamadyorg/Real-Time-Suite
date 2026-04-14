import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

interface Props {
  token: string | null;
  apiBase: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "default";
}

export function PushNotificationButton({ token, apiBase, size = "sm", variant = "ghost" }: Props) {
  const { status, subscribe, unsubscribe } = usePushNotifications(token, apiBase);
  const { toast } = useToast();

  if (status === "unsupported") return null;

  const handleToggle = async () => {
    if (status === "subscribed") {
      const ok = await unsubscribe();
      if (ok) toast({ title: "Bildirishnomalar o'chirildi", duration: 2000 });
    } else if (status === "prompt") {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "✅ Bildirishnomalar yoqildi!", description: "Yangi zakaz tushganda xabar olasiz", duration: 3000 });
      } else {
        toast({ title: "Ruxsat berilmadi", description: "Brauzer sozlamalaridan bildirishnomani yoqing", variant: "destructive", duration: 4000 });
      }
    }
  };

  if (status === "loading") {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (status === "denied") {
    return (
      <Button variant={variant} size={size} disabled title="Bildirishnomaga ruxsat berilmagan">
        <BellOff className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      title={status === "subscribed" ? "Bildirishnomalarni o'chirish" : "Bildirishnomalarni yoqish"}
    >
      {status === "subscribed" ? (
        <BellRing className="h-4 w-4 text-green-500" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </Button>
  );
}
