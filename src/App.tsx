import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PresenceProvider } from "@/hooks/usePresence";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useEmailSync } from "@/hooks/useEmailSync";
import { useEmailSoundNotification } from "@/hooks/useEmailSoundNotification";
import { useTheme } from "@/hooks/useTheme";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Configure QueryClient with optimized caching for Keep-Alive tabs
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function EmailSyncInit() {
  useEmailSync();
  useEmailSoundNotification();
  return null;
}

/** Gate that blocks rendering until the theme is synced from DB */
function ThemeGate({ children }: { children: React.ReactNode }) {
  const { isSynced } = useTheme();

  if (!isSynced) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[9999]">
        <div className="flex flex-col items-center gap-3">
          <div className="text-2xl font-bold text-primary tracking-tight">CRM</div>
          <div className="h-1 w-16 rounded-full bg-primary/30 overflow-hidden">
            <div className="h-full w-8 rounded-full bg-primary animate-[shimmer_1s_ease-in-out_infinite]" 
                 style={{ animation: 'shimmer 1s ease-in-out infinite alternate', transform: 'translateX(0)' }} />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PresenceProvider>
      <PermissionsProvider>
      <ThemeGate>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <EmailSyncInit />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute />} />
            <Route path="/clients" element={<ProtectedRoute />} />
            <Route path="/sales" element={<ProtectedRoute />} />
            <Route path="/sales-history" element={<ProtectedRoute />} />
            <Route path="/catalog" element={<ProtectedRoute />} />
            <Route path="/policies" element={<ProtectedRoute />} />
            <Route path="/finances" element={<ProtectedRoute />} />
            <Route path="/notifications" element={<ProtectedRoute />} />
            <Route path="/settings" element={<ProtectedRoute />} />
            <Route path="/messenger-settings" element={<ProtectedRoute />} />
            <Route path="/reports" element={<ProtectedRoute />} />
            <Route path="/shift-reports" element={<ProtectedRoute />} />
            <Route path="/prolongation-report" element={<ProtectedRoute />} />
            <Route path="/communication" element={<ProtectedRoute />} />
            <Route path="/europrotocol" element={<ProtectedRoute />} />
            <Route path="/analytics" element={<ProtectedRoute />} />
            <Route path="/team" element={<ProtectedRoute />} />
            <Route path="/event-log" element={<ProtectedRoute />} />
            <Route path="/settings/permissions" element={<ProtectedRoute />} />
            <Route path="/access-logs" element={<ProtectedRoute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeGate>
      </PermissionsProvider>
      </PresenceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
