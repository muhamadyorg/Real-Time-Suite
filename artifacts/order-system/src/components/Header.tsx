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
    try { await logout.mutateAsync({}); } catch (e) {}
    clearPinAuth();
    setLocation("/pin");
  };

  return (
    <header className="flex items-center justify-between px-5 py-0 h-14 bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-accent shrink-0" />
        <h1 className="text-base font-semibold tracking-tight text-foreground truncate max-w-[260px]">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        {rightContent}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}
        >
          {theme === "dark"
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />}
        </Button>
        {showLogout && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Chiqish"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
