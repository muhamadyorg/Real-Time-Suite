import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";

import StoreLogin from "@/pages/StoreLogin";
import PinEntry from "@/pages/PinEntry";
import WorkerDashboard from "@/pages/WorkerDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SuperadminDashboard from "@/pages/SuperadminDashboard";
import SudoDashboard from "@/pages/SudoDashboard";

function ProtectedRoute({ path, component: Component, allowedRoles }: { path: string, component: any, allowedRoles: string[] }) {
  return (
    <Route path={path}>
      {(params) => {
        const { role, storeId } = useAuth();
        if (!storeId && path !== "/pin") return <Redirect to="/" />;
        if (!role) return <Redirect to="/pin" />;
        if (!allowedRoles.includes(role)) {
           // Redirect to appropriate dashboard
           if (role === 'worker') return <Redirect to="/worker" />;
           if (role === 'admin' || role === 'viewer') return <Redirect to="/admin" />;
           if (role === 'superadmin') return <Redirect to="/superadmin" />;
           if (role === 'sudo') return <Redirect to="/sudo" />;
        }
        return <Component {...params} />;
      }}
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={StoreLogin} />
      <Route path="/pin">
        {() => {
          const { storeId, role } = useAuth();
          if (!storeId) return <Redirect to="/" />;
          if (role) {
            if (role === 'worker') return <Redirect to="/worker" />;
            if (role === 'admin' || role === 'viewer') return <Redirect to="/admin" />;
            if (role === 'superadmin') return <Redirect to="/superadmin" />;
            if (role === 'sudo') return <Redirect to="/sudo" />;
          }
          return <PinEntry />;
        }}
      </Route>
      <ProtectedRoute path="/worker" component={WorkerDashboard} allowedRoles={['worker']} />
      <ProtectedRoute path="/admin" component={AdminDashboard} allowedRoles={['admin', 'viewer']} />
      <ProtectedRoute path="/viewer" component={AdminDashboard} allowedRoles={['viewer']} />
      <ProtectedRoute path="/superadmin" component={SuperadminDashboard} allowedRoles={['superadmin']} />
      <ProtectedRoute path="/sudo" component={SudoDashboard} allowedRoles={['sudo']} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    })}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
