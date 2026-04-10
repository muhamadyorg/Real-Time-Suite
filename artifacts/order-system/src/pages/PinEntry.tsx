import { useState, useCallback } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { usePinLogin } from "@workspace/api-client-react";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Delete, LogOut, Store } from "lucide-react";

export default function PinEntry() {
  const [pin, setPin] = useState("");
  const [, setLocation] = useLocation();
  const { storeId, storeName, setPinAuth, clearStoreAuth, accountId, role } = useAuth();
  const pinLogin = usePinLogin();
  const { toast } = useToast();

  // Timeout: faqat PIN ni tozala, do'kondan chiqma
  const handleTimeout = useCallback(() => {
    setPin("");
  }, []);

  // Explicit chiqish: do'kondan to'liq chiq
  const handleStoreLogout = useCallback(() => {
    clearStoreAuth();
    setLocation("/");
  }, [clearStoreAuth, setLocation]);

  const { secondsLeft } = useInactivityTimer(15, handleTimeout);

  if (pin.length === 4 && storeId && !pinLogin.isPending) {
    pinLogin.mutate({ data: { pin, storeId } }, {
      onSuccess: (data) => {
        setPinAuth(data.token, data.account.id, data.account.name, data.role, data.account.serviceTypeId ?? null, (data.account as any).allowedServiceTypeIds ?? []);
        if (data.role === 'worker') setLocation('/worker');
        else if (data.role === 'admin') setLocation('/admin');
        else if (data.role === 'superadmin') setLocation('/superadmin');
        else if (data.role === 'viewer') setLocation('/viewer');
        else if (data.role === 'sudo') setLocation('/sudo');
        else setLocation('/worker');
        toast({ title: `Xush kelibsiz, ${data.account.name}!` });
      },
      onError: (err) => {
        setPin("");
        toast({
          title: "Xatolik",
          description: err.data?.error || "PIN kod noto'g'ri",
          variant: "destructive"
        });
      }
    });
  }

  if (!storeId) return <Redirect to="/" />;
  if (accountId && role) {
    if (role === 'worker') return <Redirect to="/worker" />;
    if (role === 'admin') return <Redirect to="/admin" />;
    if (role === 'superadmin') return <Redirect to="/superadmin" />;
    if (role === 'viewer') return <Redirect to="/viewer" />;
    if (role === 'sudo') return <Redirect to="/sudo" />;
  }

  const handlePadClick = (num: string) => {
    if (pin.length < 4 && !pinLogin.isPending) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const padNumbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Top gradient decoration */}
      <div className="absolute top-0 inset-x-0 h-72 bg-gradient-to-b from-primary/10 to-transparent rounded-b-[80%] z-0 pointer-events-none" />

      {/* Timer badge */}
      <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full shadow text-sm font-semibold border transition-colors ${
        secondsLeft <= 5 ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-card border-border text-foreground'
      }`}>
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${secondsLeft <= 5 ? 'bg-destructive' : 'bg-primary'}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${secondsLeft <= 5 ? 'bg-destructive' : 'bg-primary'}`} />
        </span>
        {secondsLeft}s
      </div>

      {/* Store name badge */}
      <div className="z-10 flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 text-primary font-semibold mb-4 bg-primary/10 px-5 py-2 rounded-full border border-primary/20 shadow-sm">
          <Store className="w-4 h-4" />
          {storeName}
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">PIN kodni kiriting</h1>
        <p className="text-muted-foreground text-center px-4 max-w-xs text-sm">
          Tizimga kirish uchun o'z PIN kodingizni kiriting
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-10 z-10">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              idx < pin.length
                ? "bg-primary border-primary scale-110 shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                : "bg-transparent border-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4 z-10 w-full max-w-[280px]">
        {padNumbers.map((num) => (
          <Button
            key={num}
            variant="outline"
            className="h-20 w-full rounded-2xl text-3xl font-light shadow-sm bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 active:scale-95 transition-all duration-150"
            onClick={() => handlePadClick(num)}
            disabled={pinLogin.isPending}
          >
            {num}
          </Button>
        ))}

        {/* Chiqish button */}
        <Button
          variant="ghost"
          className="h-20 w-full rounded-2xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex flex-col gap-1 transition-all duration-150"
          onClick={handleStoreLogout}
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Chiqish</span>
        </Button>

        <Button
          variant="outline"
          className="h-20 w-full rounded-2xl text-3xl font-light shadow-sm bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 active:scale-95 transition-all duration-150"
          onClick={() => handlePadClick("0")}
          disabled={pinLogin.isPending}
        >
          0
        </Button>

        <Button
          variant="ghost"
          className="h-20 w-full rounded-2xl text-muted-foreground hover:bg-muted active:scale-95 transition-all duration-150"
          onClick={handleBackspace}
          disabled={pin.length === 0 || pinLogin.isPending}
        >
          <Delete className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
}
