import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Loader2, Plus, X, Zap, Settings2 } from "lucide-react";
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

  const load = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${apiBase}/api/service-types?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${apiBase}/api/push/rules?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
    ]).then(([accs, svcs, rls]) => {
      setAccounts(Array.isArray(accs) ? accs.filter((a: Account) => a.role !== "sudo") : []);
      setServiceTypes(Array.isArray(svcs) ? svcs : []);
      setRules(Array.isArray(rls) ? rls : []);
    }).catch(() => {
      toast({ title: "Yuklashda xato", variant: "destructive" });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token, storeId, apiBase]);

  const handleAdd = async () => {
    if (!selService || !selAccount) return;
    setAddLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/push/rules`, {
        method: "POST",
        headers,
        body: JSON.stringify({ storeId, serviceTypeId: parseInt(selService), accountId: parseInt(selAccount) }),
      });
      if (!r.ok) throw new Error();
      const rule = await r.json();
      setRules(prev => prev.some(x => x.id === rule.id) ? prev : [...prev, rule]);
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

  const getName = (id: number) => accounts.find(a => a.id === id)?.name ?? `#${id}`;
  const getRole = (id: number) => accounts.find(a => a.id === id)?.role ?? "worker";
  const getSvcName = (id: number) => serviceTypes.find(s => s.id === id)?.name ?? `#${id}`;

  // Workers who auto-receive by serviceTypeId
  const autoWorkers = accounts.filter(a => a.serviceTypeId && a.role === "worker");

  // Group auto workers by serviceTypeId
  const autoByService = serviceTypes.map(st => ({
    serviceType: st,
    workers: autoWorkers.filter(w => w.serviceTypeId === st.id),
  })).filter(g => g.workers.length > 0);

  // Group manual rules by serviceTypeId
  const manualByService = serviceTypes.map(st => ({
    serviceType: st,
    rules: rules.filter(r => r.serviceTypeId === st.id),
  })).filter(g => g.rules.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Own subscription status */}
      <div className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Sizning qurilmangiz</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status === "subscribed" && "✅ Bildirishnomalar faol"}
            {status === "prompt" && "Bildirishnomalar o'chirilgan — yoqish uchun bosing"}
            {status === "denied" && "⚠️ Brauzer ruxsat bermagan (sozlamalardan yoqing)"}
            {status === "unsupported" && "⚠️ Brauzer qo'llab-quvvatlamaydi"}
            {status === "loading" && "Tekshirilmoqda..."}
          </p>
        </div>
        {status === "prompt" && (
          <Button size="sm" onClick={subscribe} className="gap-1.5 shrink-0">
            <BellRing className="h-4 w-4" />
            Yoqish
          </Button>
        )}
        {status === "subscribed" && (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium shrink-0">
            <BellRing className="h-4 w-4" /> Faol
          </div>
        )}
        {status === "denied" && (
          <div className="flex items-center gap-1.5 text-red-500 text-sm shrink-0">
            <BellOff className="h-4 w-4" /> Bloklangan
          </div>
        )}
      </div>

      {/* Auto section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Avtomatik (xizmat turi bo'yicha)</h3>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          Ishchiga xizmat turi biriktirilsa, u o'sha xizmat zakazlarini avtomatik oladi — qo'shimcha sozlash shart emas.
          Ishchi faqat qurilmasida 🔔 tugmani bosishi kerak.
        </p>
        {autoByService.length === 0 ? (
          <div className="bg-muted/30 rounded-xl p-4 text-center text-sm text-muted-foreground">
            Xizmat turiga biriktirilgan ishchi yo'q
          </div>
        ) : (
          <div className="space-y-2">
            {autoByService.map(({ serviceType, workers }) => (
              <div key={serviceType.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium text-sm">{serviceType.name}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{workers.length} ishchi</Badge>
                </div>
                <div className="divide-y">
                  {workers.map(w => (
                    <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400">
                        {w.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{w.name}</p>
                        <p className="text-xs text-muted-foreground">Ishchi</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-xs">Avtomatik</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual rules section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Settings2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Qo'shimcha qoidalar (admin/KM uchun)</h3>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          Adminlar yoki boshqa xodimlar muayyan xizmat zakazini olishini istasangiz, quyida qo'shing.
        </p>

        {/* Add rule */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
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
                {accounts.map(a => (
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

        {manualByService.length > 0 && (
          <div className="space-y-2">
            {manualByService.map(({ serviceType, rules: grpRules }) => (
              <div key={serviceType.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/40 border-b flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-sm">{serviceType.name}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{grpRules.length} kishi</Badge>
                </div>
                <div className="divide-y">
                  {grpRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {getName(rule.accountId).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{getName(rule.accountId)}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABELS[getRole(rule.accountId)] ?? getRole(rule.accountId)}</p>
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
      </div>

      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
        <p className="font-medium text-blue-700 dark:text-blue-400">💡 Qanday ishlaydi?</p>
        <p>Har bir xodim o'z qurilmasida header'dagi 🔔 tugmani bosib bildirishnomalarni yoqadi.</p>
        <p>Ishchi o'z xizmat turi zakazlarini, qo'shimcha qoidadagi xodimlar esa belgilangan xizmat zakazlarini oladi.</p>
      </div>
    </div>
  );
}
