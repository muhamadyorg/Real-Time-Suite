import { useState, useCallback } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { usePinLogin } from "@workspace/api-client-react";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Delete, LogOut, Store } from "lucide-react";

export default function PinEntry() {
  const [pin, setPin] = useState("");
  const [, setLocation] = useLocation();
  const { storeId, storeName, setPinAuth, clearStoreAuth, accountId, role } = useAuth();
  const pinLogin = usePinLogin();
  const { toast } = useToast();

  const handleTimeout = useCallback(() => {
    clearStoreAuth();
    setLocation("/");
  }, [clearStoreAuth, setLocation]);

  // Use 15 seconds as specified
  const { secondsLeft } = useInactivityTimer(15, handleTimeout);

  // Add effect to auto-login when pin length reaches 6
  if (pin.length === 6 && storeId && !pinLogin.isPending) {
    pinLogin.mutate({ data: { pin, storeId } }, {
      onSuccess: (data) => {
        setPinAuth(data.token, data.account.id, data.account.name, data.role);
        if (data.role === 'worker') setLocation('/worker');
        else if (data.role === 'admin') setLocation('/admin');
        else if (data.role === 'superadmin') setLocation('/superadmin');
        else if (data.role === 'viewer') setLocation('/viewer');
        else if (data.role === 'sudo') setLocation('/sudo');
        else setLocation('/worker');
        
        toast({ title: `Xush kelibsiz, ${data.account.name}` });
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
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const padNumbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-64 bg-primary/5 rounded-b-[100%] z-0" />
      
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card px-3 py-1.5 rounded-full shadow-sm border text-sm font-medium">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
        </span>
        Vaqt: {secondsLeft}s
      </div>

      <div className="z-10 flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 text-primary/80 font-medium mb-4 bg-primary/10 px-4 py-2 rounded-full">
          <Store className="w-5 h-5" />
          {storeName}
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">PIN kodni kiriting</h1>
        <p className="text-muted-foreground text-center px-4 max-w-sm">Tizimga kirish uchun o'z parolingizni kiriting</p>
      </div>

      <Card className="w-full max-w-sm border-0 shadow-none bg-transparent z-10">
        <CardContent className="p-4 sm:p-6 flex flex-col items-center">
          
          <div className="flex gap-4 mb-10 h-6">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div 
                key={idx} 
                className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                  idx < pin.length 
                    ? "bg-primary border-primary scale-110" 
                    : "bg-transparent border-muted-foreground/30"
                }`} 
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-4 sm:gap-x-8 sm:gap-y-6 w-full max-w-[280px]">
            {padNumbers.map((num) => (
              <Button 
                key={num} 
                variant="outline" 
                className="h-20 w-20 rounded-full text-3xl font-light shadow-sm bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                onClick={() => handlePadClick(num)}
                disabled={pinLogin.isPending}
              >
                {num}
              </Button>
            ))}
            
            <div className="flex items-center justify-center">
              <Button 
                variant="ghost" 
                className="h-16 w-16 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex flex-col gap-1"
                onClick={handleTimeout}
              >
                <LogOut className="h-6 w-6" />
                <span className="text-[10px] font-medium uppercase">Chiqish</span>
              </Button>
            </div>

            <Button 
              variant="outline" 
              className="h-20 w-20 rounded-full text-3xl font-light shadow-sm bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
              onClick={() => handlePadClick("0")}
              disabled={pinLogin.isPending}
            >
              0
            </Button>

            <div className="flex items-center justify-center">
              <Button 
                variant="ghost" 
                className="h-16 w-16 rounded-full text-muted-foreground hover:bg-muted"
                onClick={handleBackspace}
                disabled={pin.length === 0 || pinLogin.isPending}
              >
                <Delete className="h-8 w-8" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
