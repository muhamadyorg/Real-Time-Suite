import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Badge } from "@/components/ui/badge";

interface Account {
  id: number;
  name: string;
  role: string;
  serviceTypeId?: number | null;
}

interface ServiceType {
  id: number;
  name: string;
}

interface Rule {
  id: number;
  storeId: number;
  serviceTypeId: number;
  accountId: number;
}

interface Props {
  token: string | null;
  storeId: number;
  apiBase: string;
}

const ROLE_LABELS: Record<string, string> = {
  sudo: "SUDO",
  superadmin: "Superadmin",
  admin: "Admin",
  worker: "Ishchi",
  viewer: "Kuzatuvchi",
};

export function NotificationRulesView({ token, storeId, apiBase }: Props) {
  const { toast } = useToast();
  const { status, subscribe } = usePushNotifications(token, apiBase);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);

  const [selService, setSelService] = useState("");
  const [selAccount, setSelAccount] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/accounts?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${apiBase}/api/service-types?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${apiBase}/api/push/rules?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([accs, svcs, rls]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      setServiceTypes(Array.isArray(svcs) ? svcs : []);
      setRules(Array.isArray(rls) ? rls : []);
    }).catch(() => {
      toast({ title: "Ma'lumot yuklashda xato", variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [token, storeId, apiBase]);

  const handleAdd = async () => {
    if (!selService || !selAccount) return;
    setAddLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/push/rules`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          storeId,
          serviceTypeId: parseInt(selService),
          accountId: parseInt(selAccount),
        }),
      });
      if (!r.ok) throw new Error();
      const rule = await r.json();
      setRules(prev => {
        const exists = prev.some(x => x.id === rule.id);
        return exists ? prev : [...prev, rule];
      });
      toast({ title: "✅ Qoida qo'shildi", duration: 2000 });
      setSelService("");
      setSelAccount("");
    } catch {
      toast({ title: "Qo'shishda xato", variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${apiBase}/api/push/rules/${id}`, { method: "DELETE", headers });
      setRules(prev => prev.filter(r => r.id !== id));
    } catch {
      toast({ title: "O'chirishda xato", variant: "destructive" });
    }
  };

  // Group rules by service type
  const grouped = serviceTypes.map(st => ({
    serviceType: st,
    rules: rules.filter(r => r.serviceTypeId === st.id),
  })).filter(g => g.rules.length > 0);

  const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name ?? `#${id}`;
  const getAccountRole = (id: number) => accounts.find(a => a.id === id)?.role ?? "worker";
  const getServiceName = (id: number) => serviceTypes.find(s => s.id === id)?.name ?? `#${id}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Own push status */}
      <div className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm">Sizning qurilmangiz</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status === "subscribed" && "✅ Bildirishnomalar yoqilgan"}
            {status === "prompt" && "Bildirishnomalar o'chirilgan"}
            {status === "denied" && "⚠️ Brauzer ruxsat bermagan"}
            {status === "unsupported" && "⚠️ Brauzer qo'llab-quvvatlamaydi"}
            {status === "loading" && "Tekshirilmoqda..."}
          </p>
        </div>
        {status === "prompt" && (
          <Button size="sm" onClick={subscribe} className="gap-1.5">
            <BellRing className="h-4 w-4" />
            Yoqish
          </Button>
        )}
        {status === "subscribed" && (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
            <BellRing className="h-4 w-4" /> Faol
          </div>
        )}
        {status === "denied" && (
          <div className="flex items-center gap-1.5 text-red-500 text-sm">
            <BellOff className="h-4 w-4" /> Bloklangan
          </div>
        )}
      </div>

      {/* Add rule */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Yangi qoida qo'shish
        </h3>
        <p className="text-xs text-muted-foreground">
          Qaysi xizmat turi bo'yicha zakaz tushganda kim xabar olishi kerakligini belgilang
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={selService} onValueChange={setSelService}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Xizmat turi" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selAccount} onValueChange={setSelAccount}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Xodim" />
            </SelectTrigger>
            <SelectContent>
              {accounts.filter(a => a.role !== "sudo").map(a => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name} ({ROLE_LABELS[a.role] ?? a.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          className="gap-1.5 w-full"
          onClick={handleAdd}
          disabled={!selService || !selAccount || addLoading}
        >
          {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Qo'shish
        </Button>
      </div>

      {/* Rules list */}
      {grouped.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
          Hali hech qanday qoida yo'q
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide px-1">Qoidalar</h3>
          {grouped.map(({ serviceType, rules: grpRules }) => (
            <div key={serviceType.id} className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-sm">{serviceType.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{grpRules.length} xodim</Badge>
              </div>
              <div className="divide-y">
                {grpRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {getAccountName(rule.accountId).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{getAccountName(rule.accountId)}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[getAccountRole(rule.accountId)] ?? getAccountRole(rule.accountId)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
        <p className="font-medium text-amber-700 dark:text-amber-400">💡 Eslatma</p>
        <p>Xodimlar o'z qurilmalarida bildirishnomalarni yoqishlari kerak (header'dagi 🔔 tugma).</p>
        <p>Bildirishnomalar faqat zakaz yaratilganda yuboriladi.</p>
      </div>
    </div>
  );
}
