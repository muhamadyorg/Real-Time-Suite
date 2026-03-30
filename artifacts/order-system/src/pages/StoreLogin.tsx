import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreLogin } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound } from "lucide-react";

export default function StoreLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { setStoreAuth, storeId } = useAuth();
  const [, setLocation] = useLocation();
  const login = useStoreLogin();
  const { toast } = useToast();

  if (storeId) return <Redirect to="/pin" />;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    login.mutate({ data: { username, password } }, {
      onSuccess: (res) => {
        if (res.store) {
          setStoreAuth(res.token, res.store.id, res.store.username, res.store.name, res.role);
          if (res.role === 'sudo') {
             setLocation('/sudo');
          } else {
             setLocation('/pin');
          }
          toast({ title: "Muvaffaqiyatli", description: "Tizimga kirdingiz" });
        } else if (res.role === 'sudo') {
          // generic superuser
          setStoreAuth(res.token, 0, 'sudo', 'Superuser', 'sudo');
          setLocation('/sudo');
        }
      },
      onError: (err) => {
        toast({ 
          title: "Xatolik", 
          description: err.data?.error || "Login yoki parol noto'g'ri", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Do'kon tizimiga kirish</CardTitle>
          <CardDescription className="text-base">
            Boshqaruv paneliga kirish uchun ma'lumotlarni kiriting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Login</Label>
              <Input 
                id="username" 
                placeholder="Do'kon logini" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 text-lg px-4"
                disabled={login.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-lg px-4 font-mono tracking-widest placeholder:tracking-normal placeholder:font-sans"
                disabled={login.isPending}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-medium mt-6" disabled={login.isPending}>
              {login.isPending ? "Kutib turing..." : "Kirish"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
