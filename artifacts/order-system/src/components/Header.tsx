import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export function Header({ 
  title, 
  showLogout = true, 
  onLogout, 
  rightContent 
}: { 
  title: string, 
  showLogout?: boolean, 
  onLogout?: () => void, 
  rightContent?: React.ReactNode 
}) {
  const { theme, setTheme } = useTheme();
  const { clearPinAuth } = useAuth();
  const logout = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await logout.mutateAsync({});
    } catch (e) {}
    clearPinAuth();
    setLocation("/pin");
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b shadow-sm sticky top-0 z-10">
      <h1 className="text-xl font-bold tracking-tight text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        {rightContent}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        {showLogout && (
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
            <LogOut className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
