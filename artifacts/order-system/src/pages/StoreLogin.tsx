import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreLogin } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Building2, Lock, User } from "lucide-react";

export default function StoreLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { setStoreAuth, storeId, role } = useAuth();
  const [, setLocation] = useLocation();
  const login = useStoreLogin();
  const { toast } = useToast();

  // Already logged in
  if (storeId) {
    if (role === 'sudo') return <Redirect to="/sudo" />;
    return <Redirect to="/pin" />;
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    login.mutate({ data: { username, password } }, {
      onSuccess: (res) => {
        if (res.store) {
          setStoreAuth(res.token, res.store.id, res.store.username, res.store.name, res.role);
          if (res.role === 'sudo') setLocation('/sudo');
          else setLocation('/pin');
          toast({ title: "Xush kelibsiz!", description: res.store.name });
        } else if (res.role === 'sudo') {
          setStoreAuth(res.token, -1, 'sudo', 'Superuser', 'sudo');
          setLocation('/sudo');
          toast({ title: "SUDO paneliga xush kelibsiz!" });
        }
      },
      onError: (err) => {
        toast({
          title: "Kirish muvaffaqiyatsiz",
          description: err.data?.error || "Login yoki parol noto'g'ri",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/6 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-md mx-4">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary rounded-t-2xl" />

        <div className="bg-card border border-border/60 rounded-b-2xl shadow-2xl p-8">
          {/* Logo & title */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg">
              <img src="/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Buyurtma tizimi</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Do'kon loginini kiriting</p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Login</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  placeholder="Do'kon logini"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-12 text-base bg-muted/30 border-border/60 focus-visible:ring-primary/30 focus-visible:border-primary/50"
                  disabled={login.isPending}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-12 h-12 text-base bg-muted/30 border-border/60 focus-visible:ring-primary/30 focus-visible:border-primary/50 font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal"
                  disabled={login.isPending}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold mt-2 bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
              disabled={login.isPending || !username || !password}
            >
              {login.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Tekshirilmoqda...
                </span>
              ) : "Kirish"}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-border/40 text-center">
            <p className="text-xs text-muted-foreground">Buyurtma boshqaruv tizimi &copy; 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
}
