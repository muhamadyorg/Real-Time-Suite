import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BTPrinterProvider } from "@/hooks/useBTPrinter";
import { StoreSettingsProvider } from "@/hooks/useStoreSettings";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";

import StoreLogin from "@/pages/StoreLogin";
import PinEntry from "@/pages/PinEntry";
import WorkerDashboard from "@/pages/WorkerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SuperadminDashboard from "@/pages/SuperadminDashboard";
import SudoDashboard from "@/pages/SudoDashboard";
import PublicOrderPage from "@/pages/PublicOrderPage";

// Stable QueryClient — must live outside component so it is never recreated on re-render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 20000, // treat data as fresh for 20 s to suppress duplicate fetches
    },
  },
});

// --- Route guards ---------------------------------------------------------
// useAuth() must be called at component level (Rules of Hooks).
// Render-props of <Route> are not React components, so hooks cannot be used
// directly inside them. We extract the logic into proper components instead.

function ProtectedContent({
  component: Component,
  allowedRoles,
  params,
}: {
  component: React.ComponentType<any>;
  allowedRoles: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { role, storeId } = useAuth();
  if (!storeId) return <Redirect to="/" />;
  if (!role) return <Redirect to="/pin" />;
  if (!allowedRoles.includes(role)) {
    if (role === "worker") return <Redirect to="/worker" />;
    if (role === "admin" || role === "viewer") return <Redirect to="/admin" />;
    if (role === "superadmin") return <Redirect to="/superadmin" />;
    if (role === "sudo") return <Redirect to="/sudo" />;
  }
  return <Component {...params} />;
}

function ProtectedRoute({
  path,
  component,
  allowedRoles,
}: {
  path: string;
  component: React.ComponentType<any>;
  allowedRoles: string[];
}) {
  return (
    <Route path={path}>
      {(params) => (
        <ProtectedContent component={component} allowedRoles={allowedRoles} params={params} />
      )}
    </Route>
  );
}

function PinRouteContent() {
  const { storeId, role } = useAuth();
  if (!storeId) return <Redirect to="/" />;
  if (role) {
    if (role === "worker") return <Redirect to="/worker" />;
    if (role === "admin" || role === "viewer") return <Redirect to="/admin" />;
    if (role === "superadmin") return <Redirect to="/superadmin" />;
    if (role === "sudo") return <Redirect to="/sudo" />;
  }
  return <PinEntry />;
}

// -------------------------------------------------------------------------

function Router() {
  return (
    <Switch>
      <Route path="/" component={StoreLogin} />
      <Route path="/pin">{() => <PinRouteContent />}</Route>
      <ProtectedRoute path="/worker" component={WorkerDashboard} allowedRoles={["worker"]} />
      <ProtectedRoute path="/admin" component={AdminDashboard} allowedRoles={["admin", "viewer"]} />
      <ProtectedRoute path="/viewer" component={AdminDashboard} allowedRoles={["viewer"]} />
      <ProtectedRoute path="/superadmin" component={SuperadminDashboard} allowedRoles={["superadmin"]} />
      <ProtectedRoute path="/sudo" component={SudoDashboard} allowedRoles={["sudo"]} />
      <Route path="/order/:orderId" component={PublicOrderPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { token } = useAuth();
  return (
    <StoreSettingsProvider token={token}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </StoreSettingsProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <TooltipProvider>
            <BTPrinterProvider>
              <AppContent />
            </BTPrinterProvider>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
